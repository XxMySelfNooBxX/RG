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
