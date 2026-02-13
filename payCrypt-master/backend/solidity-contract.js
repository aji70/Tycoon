import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.STARKNET_RPC_URL);
// const provider = new ethers.WebSocketProvider(process.env.WS_RPC_URL);
const wallet = new ethers.Wallet(process.env.STARKNET_PRIVATE_KEY, provider);

import starknetContractABI from "./abis/StarknetContractABI.json" assert { type: "json" };

const contractAddress = process.env.STARKNET_CONTRACT_ADDRESS;
const starknet_contract = new ethers.Contract(contractAddress, starknetContractABI, wallet);

export default starknet_contract;