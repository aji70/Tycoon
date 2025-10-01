export const seed = async (knex) => {
  await knex("chances").del();

  await knex("chances").insert([
    {
      id: 1,
      instruction: "Advance to Go (Collect $200)",
      type: "credit_and_move",
      amount: 200,
      position: 0,
      extra: null,
    },
    {
      id: 2,
      instruction: "Advance to Illinois Ave. If you pass Go, collect $200",
      type: "move",
      amount: null,
      position: 24,
      extra: null,
    },
    {
      id: 3,
      instruction: "Advance to St. Charles Place. If you pass Go, collect $200",
      type: "move",
      amount: null,
      position: 11,
      extra: null,
    },
    {
      id: 4,
      instruction:
        "Advance token to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total ten times the amount thrown.",
      type: "special",
      amount: null,
      position: null,
      extra: JSON.stringify({ rule: "nearest_utility" }),
    },
    {
      id: 5,
      instruction:
        "Advance token to the nearest Railroad and pay owner twice the rental. If Railroad is unowned, you may buy it.",
      type: "special",
      amount: null,
      position: null,
      extra: JSON.stringify({ rule: "nearest_railroad" }),
    },
    {
      id: 6,
      instruction: "Bank pays you dividend of $50",
      type: "credit",
      amount: 50,
      position: null,
      extra: null,
    },
    {
      id: 7,
      instruction:
        "Get Out of Jail Free – This card may be kept until needed, or traded/sold",
      type: "special",
      amount: null,
      position: null,
      extra: JSON.stringify({ rule: "get_out_of_jail_free" }),
    },
    {
      id: 8,
      instruction: "Go Back Three Spaces",
      type: "move",
      amount: null,
      position: -3,
      extra: null,
    },
    {
      id: 9,
      instruction:
        "Go to Jail – Go directly to jail – Do not pass Go – Do not collect $200",
      type: "debit_and_move",
      amount: 0,
      position: null,
      extra: JSON.stringify({ rule: "go_to_jail" }),
    },
    {
      id: 10,
      instruction:
        "Make general repairs on all your property – For each house pay $25 – For each hotel $100",
      type: "debit",
      amount: null,
      position: null,
      extra: JSON.stringify({ per_house: 25, per_hotel: 100 }),
    },
    {
      id: 11,
      instruction: "Pay poor tax of $15",
      type: "debit",
      amount: 15,
      position: null,
      extra: null,
    },
    {
      id: 12,
      instruction:
        "Take a trip to Reading Railroad. If you pass Go, collect $200",
      type: "move",
      amount: null,
      position: 5,
      extra: null,
    },
    {
      id: 13,
      instruction: "Take a walk on the Boardwalk. Advance token to Boardwalk.",
      type: "move",
      amount: null,
      position: 39,
      extra: null,
    },
    {
      id: 14,
      instruction:
        "You have been elected Chairman of the Board – Pay each player $50",
      type: "debit",
      amount: 50,
      position: null,
      extra: JSON.stringify({ per_player: true }),
    },
    {
      id: 15,
      instruction: "Your building loan matures – Collect $150",
      type: "credit",
      amount: 150,
      position: null,
      extra: null,
    },
    {
      id: 16,
      instruction: "You have won a crossword competition – Collect $100",
      type: "credit",
      amount: 100,
      position: null,
      extra: null,
    },
  ]);
};
