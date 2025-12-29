'use client';

import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import RewardABI from '@/context/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

export default function RewardAdminTester() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  // Voucher Mint State
  const [voucherRecipient, setVoucherRecipient] = useState<string>('');
  const [voucherTycAmount, setVoucherTycAmount] = useState<string>('');

  // Collectible Mint State
  const [collectibleRecipient, setCollectibleRecipient] = useState<string>('');
  const [collectiblePerk, setCollectiblePerk] = useState<number>(1); // 1 = EXTRA_TURN, etc.
  const [collectibleStrength, setCollectibleStrength] = useState<string>('1');
  const [collectibleShopPrice, setCollectibleShopPrice] = useState<string>('0'); // 0 = not for sale

  // Stock Shop State
  const [stockAmount, setStockAmount] = useState<string>('1');
  const [stockPerk, setStockPerk] = useState<number>(1);
  const [stockStrength, setStockStrength] = useState<string>('1');
  const [stockPrice, setStockPrice] = useState<string>('');

  const { writeContract, data: txHash, isPending: writing, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const isLoading = writing || confirming;

  const perkOptions = [
    { id: 1, name: 'EXTRA_TURN' },
    { id: 2, name: 'JAIL_FREE' },
    { id: 3, name: 'DOUBLE_RENT' },
    { id: 4, name: 'ROLL_BOOST' },
    { id: 5, name: 'CASH_TIERED' },
  ];

  const handleMintVoucher = async () => {
    if (!contractAddress) return alert('Contract not deployed on this chain');
    if (!voucherRecipient || !voucherTycAmount) return alert('Fill recipient and TYC amount');

    const amountWei = parseUnits(voucherTycAmount, 18);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintVoucher',
      args: [voucherRecipient as `0x${string}`, amountWei],
    });
  };

  const handleMintCollectible = async () => {
    if (!contractAddress) return alert('Contract not deployed');
    if (!collectibleRecipient) return alert('Enter recipient');

    const shopPriceWei = parseUnits(collectibleShopPrice, 18);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintCollectible',
      args: [
        collectibleRecipient as `0x${string}`,
        collectiblePerk,
        BigInt(collectibleStrength),
        shopPriceWei,
      ],
    });
  };

  const handleStockShop = async () => {
    if (!contractAddress) return alert('Contract not deployed');
    if (!stockAmount || !stockPrice) return alert('Fill amount and price');

    const amount = BigInt(stockAmount);
    const priceWei = parseUnits(stockPrice, 18);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [amount, stockPerk, BigInt(stockStrength), priceWei],
    });
  };

  const resetForm = () => {
    setVoucherRecipient('');
    setVoucherTycAmount('');
    setCollectibleRecipient('');
    setCollectiblePerk(1);
    setCollectibleStrength('1');
    setCollectibleShopPrice('0');
    setStockAmount('1');
    setStockPerk(1);
    setStockStrength('1');
    setStockPrice('');
    reset();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-12 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          TycoonRewardSystem Admin Tester
        </h1>

        {!isConnected ? (
          <div className="text-center text-red-400 text-2xl">Connect your wallet to continue</div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-xl p-6 mb-10 text-center">
              <p className="text-gray-400">Connected Address:</p>
              <p className="font-mono text-lg break-all">{address}</p>
              <p className="text-gray-400 mt-2">Chain ID: {chainId}</p>
              {contractAddress ? (
                <p className="text-green-400 mt-2">✓ Reward contract found</p>
              ) : (
                <p className="text-red-400 mt-2">✗ No contract on this chain</p>
              )}
            </div>

            {/* Mint Voucher */}
            <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-2xl p-8 mb-10 shadow-xl">
              <h2 className="text-3xl font-bold mb-6">mintVoucher() — onlyOwner</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg mb-2">Recipient Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={voucherRecipient}
                    onChange={(e) => setVoucherRecipient(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">TYC Amount (human readable)</label>
                  <input
                    type="text"
                    placeholder="100"
                    value={voucherTycAmount}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setVoucherTycAmount(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={handleMintVoucher}
                disabled={isLoading || !contractAddress}
                className="mt-6 w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded-xl font-bold text-xl"
              >
                {isLoading ? 'Processing...' : 'Mint Voucher'}
              </button>
            </div>

            {/* Mint Collectible */}
            <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-8 mb-10 shadow-xl">
              <h2 className="text-3xl font-bold mb-6">mintCollectible() — onlyBackend</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg mb-2">Recipient Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={collectibleRecipient}
                    onChange={(e) => setCollectibleRecipient(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">Perk</label>
                  <select
                    value={collectiblePerk}
                    onChange={(e) => setCollectiblePerk(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  >
                    {perkOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-lg mb-2">Strength / Tier</label>
                  <input
                    type="text"
                    placeholder="1"
                    value={collectibleStrength}
                    onChange={(e) => {
                      if (/^\d+$/.test(e.target.value) || e.target.value === '') setCollectibleStrength(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                  {collectiblePerk === 5 && (
                    <p className="text-sm text-gray-400 mt-1">Tier 1→10, 2→25, 3→50, 4→100, 5→250 cash</p>
                  )}
                </div>
                <div>
                  <label className="block text-lg mb-2">Shop Price (TYC) — 0 = not for sale</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={collectibleShopPrice}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setCollectibleShopPrice(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={handleMintCollectible}
                disabled={isLoading || !contractAddress}
                className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-xl font-bold text-xl"
              >
                {isLoading ? 'Processing...' : 'Mint Collectible'}
              </button>
            </div>

            {/* Stock Shop */}
            <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-2xl p-8 mb-10 shadow-xl">
              <h2 className="text-3xl font-bold mb-6">stockShop() — onlyBackend</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg mb-2">Amount to Stock</label>
                  <input
                    type="text"
                    placeholder="5"
                    value={stockAmount}
                    onChange={(e) => {
                      if (/^\d+$/.test(e.target.value) || e.target.value === '') setStockAmount(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">Perk</label>
                  <select
                    value={stockPerk}
                    onChange={(e) => setStockPerk(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  >
                    {perkOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-lg mb-2">Strength / Tier</label>
                  <input
                    type="text"
                    placeholder="1"
                    value={stockStrength}
                    onChange={(e) => {
                      if (/^\d+$/.test(e.target.value) || e.target.value === '') setStockStrength(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">Shop Price (TYC) — required</label>
                  <input
                    type="text"
                    placeholder="50"
                    value={stockPrice}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setStockPrice(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={handleStockShop}
                disabled={isLoading || !contractAddress}
                className="mt-6 w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-xl font-bold text-xl"
              >
                {isLoading ? 'Processing...' : 'Stock Shop'}
              </button>
            </div>

            {/* Transaction Feedback */}
            {writeError && (
              <div className="bg-red-900 rounded-xl p-6 mb-8">
                <strong>Error:</strong> {writeError.message}
              </div>
            )}

            {confirmed && txHash && (
              <div className="bg-green-900 rounded-xl p-6 text-center">
                <strong>Success!</strong> Transaction confirmed.
                <br />
                <a
                  href={`https://${chainId === 42220 ? 'explorer.celo.org' : 'sepolia.etherscan.io'}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 px-6 py-3 bg-green-700 hover:bg-green-600 rounded-lg font-bold"
                >
                  View on Explorer
                </a>
                <button
                  onClick={resetForm}
                  className="ml-4 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold"
                >
                  Reset Form
                </button>
              </div>
            )}

            <div className="mt-12 text-center text-gray-500">
              <p className="text-sm">
                This page allows testing of <strong>all admin/minter functions</strong>:
              </p>
              <ul className="text-left inline-block mt-4 space-y-1">
                <li>• mintVoucher() — onlyOwner</li>
                <li>• mintCollectible() — onlyBackend</li>
                <li>• stockShop() — onlyBackend</li>
              </ul>
              <p className="mt-6">Use responsibly on testnet or private deployment.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}