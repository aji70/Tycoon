export const seed = async (knex) => {
  // Deletes ALL existing entries
  await knex("chains").del();
  await knex("chains").insert([
    {
      id: 1,
      symbol: "STRK",
      name: "Starknet",
      native_currency: { name: "Starknet Token", symbol: "STRK" },
      rpc_url: "https://starknet-mainnet.g.alchemy.com/public",
      block_explorer: "https://starkscan.co",
    },
    {
      id: 2,
      symbol: "LSK",
      name: "Lisk",
      native_currency: { name: "Lisk", symbol: "LSK" },
      rpc_url: "https://rpc.api.lisk.com",
      block_explorer: "https://blockscout.lisk.com",
    },
    {
      id: 3,
      symbol: "BASE",
      name: "Base",
      native_currency: { name: "Ether", symbol: "ETH" },
      rpc_url: "https://mainnet.base.org",
      block_explorer: "https://basescan.org",
    },
    {
      id: 4,
      symbol: "XLM",
      name: "Stellar",
      native_currency: { name: "Lumen", symbol: "XLM" },
      rpc_url: "https://horizon.stellar.org",
      block_explorer: "https://stellar.expert/explorer/public",
    },
  ]);
};
