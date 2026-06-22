import { CaseTemplate } from '../types';

export const CASE_TEMPLATES: CaseTemplate[] = [
  {
    id: 'case_01',
    title: 'The Silent Subreddit',
    description: 'A popular subreddit has gone completely quiet. No posts, no comments. Find out who or what silenced the community.',
    difficulty: 'easy',
    clues: [
      { id: 'clue_1', title: 'Broken Server Log', description: 'A server log showing a sudden burst of 500 errors.', found: false },
      { id: 'clue_2', title: 'Anonymous Mod Note', description: 'A note saying "The silence is only the beginning."', found: false },
    ],
    suspects: [
      { id: 'suspect_1', name: 'AutoModerator', description: 'The automated moderator bot. Known for aggressive spam filtering.', status: 'suspect' },
      { id: 'suspect_2', name: 'Admin Spez', description: 'The chief administrator. Has access to all levers.', status: 'suspect' },
    ]
  }
];
