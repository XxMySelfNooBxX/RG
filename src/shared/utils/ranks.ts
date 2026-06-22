export type RankInfo = {
    name: string;
    emoji: string;
    minCases: number;
    maxCases: number;
};

export const RANKS: RankInfo[] = [
    { name: 'Rookie', emoji: '🔰', minCases: 0, maxCases: 4 },
    { name: 'Investigator', emoji: '🔍', minCases: 5, maxCases: 14 },
    { name: 'Detective', emoji: '🕵️', minCases: 15, maxCases: 29 },
    { name: 'Inspector', emoji: '🚔', minCases: 30, maxCases: 49 },
    { name: 'Chief Detective', emoji: '👑', minCases: 50, maxCases: Infinity }
];

export function getRank(casesSolved: number): RankInfo {
    for (let i = 0; i < RANKS.length; i++) {
        const rank = RANKS[i]!;
        if (casesSolved >= rank.minCases && casesSolved <= rank.maxCases) {
            return rank;
        }
    }
    return RANKS[RANKS.length - 1]!;
}

export function getRankProgress(casesSolved: number) {
    const currentRank = getRank(casesSolved);
    let nextRankName = 'MAX RANK';
    let progressPercent = 100;
    let casesToNext = 0;

    const currentIndex = RANKS.findIndex(r => r.name === currentRank.name);
    
    if (currentIndex < RANKS.length - 1) {
        const nextRank = RANKS[currentIndex + 1]!;
        nextRankName = nextRank.name;
        
        const rankRange = currentRank.maxCases - currentRank.minCases + 1;
        const casesInCurrentRank = casesSolved - currentRank.minCases;
        
        progressPercent = Math.min(100, Math.max(0, (casesInCurrentRank / rankRange) * 100));
        casesToNext = nextRank.minCases - casesSolved;
    }

    return {
        currentRank: `${currentRank.emoji} ${currentRank.name}`,
        nextRank: nextRankName,
        progressPercent,
        casesToNext
    };
}
