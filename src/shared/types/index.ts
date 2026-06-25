export type ClueType = 'image' | 'text' | 'audio';

export type Clue = {
  id: string;
  title: string;
  type: ClueType;
  content: string;
};

export type Case = {
  id: string;
  title: string;
  backstory: string;
  solution: string;
  evidenceClueIds: string[];
  clues: Clue[];
};

export type DailyCase = Case & {
  dayNumber: number;
};

export type SubmittedTheory = {
  id: string;
  username: string;
  theory: string;
  score: number;
  connections: { clueA_id: string; clueB_id: string }[];
  votes: number;
  dayNumber: number;
  caseId: string;
  submittedAt: number;
};

export type PlayerProgress = {
  rank: string;
  casesSolved: number;
  theories: {
    dayNumber: number;
    theory: string;
    score: number;
    connections: any;
  }[];
  evidenceCards: string[];
  lastCase: number;
};

export type DailyLeaderboardEntry = {
  username: string;
  score: number;
  rank: string;
};

