export const PROPERTY_POSITION = [
  1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37,
  39,
];

export const NO_PROPERTY_POSITION = [
  0, 2, 4, 5, 7, 10, 12, 15, 17, 20, 22, 25, 28, 30, 33, 35, 36,
];

export const RAILWAY_POSITION = [5, 15, 25, 35];

export const UTILITY_POSITION = [12, 28];

export const COMMUNITY_CHEST_POSITION = [2, 17, 33];

export const CHANCE_POSITION = [7, 22, 36];

export const GOTO_JAIL_POSITION = [30];

export const VISITING_JAIL_POSITION = [10];

export const START_POSITION = [0];

export const FREE_PACKING_POSITION = [20];

export const INCOME_TAX_POSITION = [4];

export const LUXURY_TAX_POSITION = [38];

export const CardTypesArray = [
  "land",
  "railway",
  "utility",
  "community_chest",
  "chance",
  "goto_jail",
  "visiting_jail",
  "start",
  "free_packing",
  "income_tax",
  "luxury_tax",
];

export const POSITION_MAP = {
  land: PROPERTY_POSITION,
  railway: RAILWAY_POSITION,
  utility: UTILITY_POSITION,
  community_chest: COMMUNITY_CHEST_POSITION,
  chance: CHANCE_POSITION,
  goto_jail: GOTO_JAIL_POSITION,
  visiting_jail: VISITING_JAIL_POSITION,
  start: START_POSITION,
  free_packing: FREE_PACKING_POSITION,
  income_tax: INCOME_TAX_POSITION,
  luxury_tax: LUXURY_TAX_POSITION,
};

export const PROPERTY_ACTION = (position) => {
  for (const [type, positions] of Object.entries(POSITION_MAP)) {
    if (positions.includes(position)) return type;
  }
  return null;
};
