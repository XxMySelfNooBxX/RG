import { PlayerProgress, SubmittedTheory, DailyLeaderboardEntry } from '../../shared/types';
import { COSMETIC_CARDS } from '../../shared/data/cosmetics';
import { getRank } from '../../shared/utils/ranks';

export type RedisClient = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<string>;
  incrBy(key: string, value: number): Promise<number>;
  zAdd(key: string, options: { member: string; score: number }): Promise<number>;
  zRange(key: string, min: number, max: number, options?: any): Promise<{ member: string; score: number }[]>;
};

const DEFAULT_PROGRESS = (_username: string): PlayerProgress => ({
  rank: 'Rookie',
  casesSolved: 0,
  theories: [],
  evidenceCards: [],
  lastCase: 0,
});

export async function getPlayerProgress(redis: RedisClient, username: string): Promise<PlayerProgress> {
  try {
    const data = await redis.get(`player:${username}:progress`);
    if (!data) {
      return DEFAULT_PROGRESS(username);
    }
    const progress = JSON.parse(data) as PlayerProgress;
    
    // Ensure back-compatibility or correct defaults
    if (!progress.evidenceCards) progress.evidenceCards = [];
    if (!progress.theories) progress.theories = [];
    
    // Update rank based on current casesSolved just in case
    const rankInfo = getRank(progress.casesSolved);
    progress.rank = rankInfo.name;

    return progress;
  } catch (error) {
    console.error('Error getting player progress:', error);
    return DEFAULT_PROGRESS(username);
  }
}

export async function savePlayerProgress(redis: RedisClient, username: string, progress: PlayerProgress): Promise<void> {
  await redis.set(`player:${username}:progress`, JSON.stringify(progress));
}

export async function getDailyTheories(redis: RedisClient, dayNumber: number): Promise<SubmittedTheory[]> {
  try {
    const data = await redis.get(`daily:${dayNumber}:theories`);
    if (!data) return [];
    return JSON.parse(data) as SubmittedTheory[];
  } catch (error) {
    console.error('Error getting daily theories:', error);
    return [];
  }
}

export async function saveDailyTheories(redis: RedisClient, dayNumber: number, theories: SubmittedTheory[]): Promise<void> {
  await redis.set(`daily:${dayNumber}:theories`, JSON.stringify(theories));
}

export async function getDailyVotes(redis: RedisClient, dayNumber: number): Promise<Record<string, string[]>> {
  try {
    const data = await redis.get(`daily:${dayNumber}:votes`);
    if (!data) return {};
    return JSON.parse(data) as Record<string, string[]>;
  } catch (error) {
    console.error('Error getting daily votes:', error);
    return {};
  }
}

export async function saveDailyVotes(redis: RedisClient, dayNumber: number, votes: Record<string, string[]>): Promise<void> {
  await redis.set(`daily:${dayNumber}:votes`, JSON.stringify(votes));
}

export async function getDailyLeaderboard(redis: RedisClient, dayNumber: number): Promise<DailyLeaderboardEntry[]> {
  try {
    const data = await redis.get(`daily:${dayNumber}:leaderboard`);
    if (!data) return [];
    return JSON.parse(data) as DailyLeaderboardEntry[];
  } catch (error) {
    console.error('Error getting daily leaderboard:', error);
    return [];
  }
}

export async function saveDailyLeaderboard(redis: RedisClient, dayNumber: number, leaderboard: DailyLeaderboardEntry[]): Promise<void> {
  await redis.set(`daily:${dayNumber}:leaderboard`, JSON.stringify(leaderboard));
}

export async function saveTheory(
  redis: RedisClient,
  username: string,
  dayNumber: number,
  caseId: string,
  theoryText: string,
  score: number,
  connections: any,
  isSolved: boolean
): Promise<{ progress: PlayerProgress; unlockedCard: string | null }> {
  const progress = await getPlayerProgress(redis, username);
  
  // 1. Check if they already solved this day's case
  const alreadySolved = progress.theories.some(t => t.dayNumber === dayNumber) || progress.lastCase === dayNumber;
  let unlockedCard: string | null = null;

  if (isSolved && !alreadySolved) {
    progress.casesSolved += 1;
    progress.lastCase = dayNumber;
    
    // Unlock a random cosmetic card they don't already have
    const lockedCards = COSMETIC_CARDS.filter(c => !progress.evidenceCards.includes(c.id));
    if (lockedCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * lockedCards.length);
      const chosenCard = lockedCards[randomIndex]!;
      progress.evidenceCards.push(chosenCard.id);
      unlockedCard = chosenCard.id;
    }
  }

  // Update rank
  const rankInfo = getRank(progress.casesSolved);
  progress.rank = rankInfo.name;

  // Add theory to player progress
  progress.theories.push({
    dayNumber,
    theory: theoryText,
    score,
    connections,
  });

  // Save progress
  await savePlayerProgress(redis, username, progress);

  // 2. Add to daily theories
  const dailyTheories = await getDailyTheories(redis, dayNumber);
  const existingTheoryIndex = dailyTheories.findIndex(t => t.username === username);

  const newTheory: SubmittedTheory = {
    id: `${caseId}:${username}`,
    username,
    theory: theoryText,
    score,
    connections,
    votes: 0,
    dayNumber,
    caseId,
    submittedAt: Date.now(),
  };

  if (existingTheoryIndex !== -1) {
    // Preserve votes if it already exists
    newTheory.votes = dailyTheories[existingTheoryIndex]!.votes;
    dailyTheories[existingTheoryIndex] = newTheory;
  } else {
    dailyTheories.push(newTheory);
  }

  await saveDailyTheories(redis, dayNumber, dailyTheories);

  // 3. Update Daily Leaderboard
  const dailyLeaderboard = await getDailyLeaderboard(redis, dayNumber);
  const existingEntryIndex = dailyLeaderboard.findIndex(e => e.username === username);

  const newEntry: DailyLeaderboardEntry = {
    username,
    score,
    rank: `${rankInfo.emoji} ${rankInfo.name}`,
  };

  if (existingEntryIndex !== -1) {
    dailyLeaderboard[existingEntryIndex] = newEntry;
  } else {
    dailyLeaderboard.push(newEntry);
  }

  // Sort daily leaderboard by score DESC
  dailyLeaderboard.sort((a, b) => b.score - a.score);
  // Keep top 10
  const top10 = dailyLeaderboard.slice(0, 10);
  await saveDailyLeaderboard(redis, dayNumber, top10);

  return { progress, unlockedCard };
}

export async function upvoteTheory(
  redis: RedisClient,
  dayNumber: number,
  theorySId: string,
  userId: string
): Promise<{ success: boolean; votes: number; message?: string }> {
  // Prevent duplicate votes: check if userId has already voted for this theorySId
  const dailyVotes = await getDailyVotes(redis, dayNumber);
  if (!dailyVotes[theorySId]) {
    dailyVotes[theorySId] = [];
  }

  const voters = dailyVotes[theorySId]!;
  if (voters.includes(userId)) {
    // User already voted for this theory
    const dailyTheories = await getDailyTheories(redis, dayNumber);
    const theory = dailyTheories.find(t => t.username === theorySId || t.id === theorySId);
    return { success: false, votes: theory ? theory.votes : 0, message: 'You have already voted for this theory.' };
  }

  // Add user to voters
  voters.push(userId);
  await saveDailyVotes(redis, dayNumber, dailyVotes);

  // Increment vote count in daily theories list
  const dailyTheories = await getDailyTheories(redis, dayNumber);
  const theory = dailyTheories.find(t => t.username === theorySId || t.id === theorySId);
  let updatedVotes = 0;

  if (theory) {
    theory.votes += 1;
    updatedVotes = theory.votes;
    await saveDailyTheories(redis, dayNumber, dailyTheories);
  }

  return { success: true, votes: updatedVotes };
}
