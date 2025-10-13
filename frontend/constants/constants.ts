// constants.ts
export const PLAYER_TOKENS = ['🎩', '🚗', '🐕', '🚢', '🛒', '👞', '🧵', '🧼'];

export const tokenValueToEmoji: { [key: number]: string } = {
  1: '🎩',
  2: '🚗',
  3: '🐕',
  4: '🚢',
  5: '🛒',
  6: '👞',
  7: '🧵',
  8: '🧼',
};

export const CHANCE_CARDS: string[] = [
  'Advance to Go (Collect $200)',
  'Advance to MakerDAO Avenue - If you pass Go, collect $200',
  'Advance to Arbitrium Avenue - If you pass Go, collect $200',
  'Advance token to nearest Utility. Pay 10x dice.',
  'Advance token to nearest Railroad. Pay 2x rent.',
  'Bank pays you dividend of $50',
  'Get out of Jail Free',
  'Go Back 3 Spaces',
  'Go to Jail directly, do not pass Go, do not collect $200', // Fixed typo
  'Make general repairs - $25 house, $100 hotel',
  'Pay poor tax of $15',
  'Take a trip to IPFS Railroad',
  'Take a walk on the Bitcoin Lane',
  'Speeding fine $200',
  'Building loan matures - collect $150',
];

export const COMMUNITY_CHEST_CARDS: string[] = [
  'Advance to Go (Collect $200)',
  'Bank error in your favor - Collect $200',
  'Doctor fee - Pay $50',
  'From sale of stock - Collect $50',
  'Get Out of Jail Free',
  'Go to Jail',
  'Grand Opera Night - collect $50 from every player',
  'Holiday Fund matures - Receive $100',
  'Income tax refund - Collect $20',
  'Life insurance matures - Collect $100',
  'Pay hospital fees of $100',
  'Pay school fees of $150',
  'Receive $25 consultancy fee',
  'Street repairs - $40 per house, $115 per hotel',
  'Won second prize in beauty contest - Collect $10',
  'You inherit $100',
];