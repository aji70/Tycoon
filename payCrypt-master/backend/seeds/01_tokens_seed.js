export const seed = async (knex) => {
  await knex("tokens").del();
  await knex("tokens").insert([
    {
      id: 1,
      address: "0xCa14007Eff0dB1f8135f4C25B34De49AB0d42766",
      symbol: "STRK",
      name: "Starknet",
      decimals: 18,
      logo_url: "strk.svg",
      chain: "Starknet (Ethereum L2)",
      price: 0.143654,
    },
    {
      id: 2,
      address: "native",
      symbol: "LSK",
      name: "Lisk",
      decimals: 8,
      logo_url: "lsk.svg",
      chain: "Lisk",
      price: 0.42895,
    },
    {
      id: 3,
      address: "0x4200000000000000000000000000000000000006",
      symbol: "BASE",
      name: "Base",
      decimals: 18,
      logo_url: "base.svg",
      chain: "Base (Ethereum L2)",
      price: 1.0,
    },
    {
      id: 4,
      address: "native",
      symbol: "XLM",
      name: "Stellar",
      decimals: 7,
      logo_url: "xlm.svg",
      chain: "Stellar",
      price: 0.112,
    },
  ]);
};
