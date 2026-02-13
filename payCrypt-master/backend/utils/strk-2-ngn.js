import { AutoSwappr, TOKEN_ADDRESSES } from "autoswappr-sdk";

const Strk2Ngn = async (amount) => {
  const autoswappr = new AutoSwappr({
    contractAddress:
      "0x05582ad635c43b4c14dbfa53cbde0df32266164a0d1b36e5b510e5b34aeb364b",
    rpcUrl: process.env.STARKNET_RPC_URL,
    accountAddress: process.env.STARKNET_ACCOUNT_ADDRESS,
    privateKey: process.env.STARKNET_PRIVATE_KEY,
  });

  const result = await autoswappr.executeSwap(
    TOKEN_ADDRESSES.STRK,
    TOKEN_ADDRESSES.USDC,
    {
      amount,
    }
  );
  console.log("Swap result:", result);
  return result;
};
export default Strk2Ngn;