const { ethers } = require("ethers");
async function main() {
    const rpc = "https://rpc.ankr.com/celo";
    const provider = new ethers.JsonRpcProvider(rpc);
    const contractAddy = "0xDd600328edc1fA24a5E8A06A5527D2ef34102319";
    const walletAddy = "0xAe7A6921E986019f1867139C19AE7Be3bD9B9C47";
    const tokenId = 1000000002;
    // minimal abi for balanceOf
    const abi = ["function balanceOf(address account, uint256 id) view returns (uint256)"];
    const contract = new ethers.Contract(contractAddy, abi, provider);
    const bal = await contract.balanceOf(walletAddy, tokenId);
    console.log("Balance:", bal.toString());
}
main().catch(console.error);
