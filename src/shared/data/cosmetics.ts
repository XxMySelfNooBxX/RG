export type CosmeticCard = {
  id: string;
  emoji: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
};

export const COSMETIC_CARDS: CosmeticCard[] = [
  { id: 'card_1', emoji: '📷', name: 'Vintage Camera', rarity: 'Common' },
  { id: 'card_2', emoji: '🔍', name: 'Brass Magnifying Glass', rarity: 'Common' },
  { id: 'card_3', emoji: '🎙️', name: 'Tape Recorder', rarity: 'Common' },
  { id: 'card_4', emoji: '📝', name: 'Case Files', rarity: 'Common' },
  { id: 'card_5', emoji: '🏷️', name: 'Evidence Tag', rarity: 'Common' },
  { id: 'card_6', emoji: '🗂️', name: 'Archived Dossier', rarity: 'Common' },
  { id: 'card_7', emoji: '🪶', name: 'Fountain Pen', rarity: 'Rare' },
  { id: 'card_8', emoji: '🔑', name: 'Golden Key', rarity: 'Rare' },
  { id: 'card_9', emoji: 'Candle', name: 'Wax Candle', rarity: 'Rare' }, // Let's use 🕯️ emoji
  { id: 'card_10', emoji: '💼', name: 'Leather Briefcase', rarity: 'Rare' },
  { id: 'card_11', emoji: '🔦', name: 'Pocket Flashlight', rarity: 'Rare' },
  { id: 'card_12', emoji: '🧪', name: 'Chemical Flask', rarity: 'Epic' },
  { id: 'card_13', emoji: '🧬', name: 'DNA Strand', rarity: 'Epic' },
  { id: 'card_14', emoji: '🎭', name: 'Tragedy Mask', rarity: 'Epic' },
  { id: 'card_15', emoji: '📯', name: 'Brass Horn', rarity: 'Epic' },
  { id: 'card_16', emoji: '🩹', name: 'Adhesive Bandage', rarity: 'Epic' },
  { id: 'card_17', emoji: '🎩', name: 'Detective Fedora', rarity: 'Legendary' },
  { id: 'card_18', emoji: '🧊', name: 'Ice Block', rarity: 'Legendary' },
  { id: 'card_19', emoji: '⚖️', name: 'Scales of Justice', rarity: 'Legendary' },
  { id: 'card_20', emoji: '⏳', name: 'Hourglass of Clues', rarity: 'Legendary' },
];

// Fix card_9 emoji to 🕯️
COSMETIC_CARDS[8]!.emoji = '🕯️';
