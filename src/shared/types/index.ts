export type Clue = {
  id: string;
  title: string;
  description: string;
  image?: string;
  found: boolean;
};

export type Suspect = {
  id: string;
  name: string;
  description: string;
  image?: string;
  status: 'innocent' | 'suspect' | 'guilty';
};

export type CaseTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  clues: Clue[];
  suspects: Suspect[];
};
