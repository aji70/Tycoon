'use client';

import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import RewardABI from '@/context/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

export default function RewardAdminTester() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  // Voucher Mint State
  const [voucherRecipient, setVoucherRecipient] = useState<string>('');
  const [voucherTycAmount, setVoucherTycAmount] = useState<string>('');

  // Collectible Mint State (non-shop rewards)
  const [collectibleRecipient, setCollectibleRecipient] = useState<string>('');
  const [collectiblePerk, setCollectiblePerk] = useState<number>(1);
  const [collectibleStrength, setCollectibleStrength] = useState<string>('1');

  // Stock Shop State (new item with dual prices)
  const [stockAmount, setStockAmount] = useState<string>('1');
  const [stockPerk, setStockPerk] = useState<number>(1);
  const [stockStrength, setStockStrength] = useState<string>('1');
  const [stockTycPrice, setStockTycPrice] = useState<string>('0');
  const [stockUsdcPrice, setStockUsdcPrice] = useState<string>('0');

  // Restock Existing Collectible
  const [restockTokenId, setRestockTokenId] = useState<string>('');
  const [restockAmount, setRestockAmount] = useState<string>('1');

  // Update Prices for Existing Collectible
  const [updatePriceTokenId, setUpdatePriceTokenId] = useState<string>('');
  const [updateTycPrice, setUpdateTycPrice] = useState<string>('0');
  const [updateUsdcPrice, setUpdateUsdcPrice] = useState<string>('0');

  const { writeContract, data: txHash, isPending: writing, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const isLoading = writing || confirming;

  const perkOptions = [
    { id: 1, name: 'EXTRA_TURN' },
    { id: 2, name: 'JAIL_FREE' },
    { id: 3, name: 'DOUBLE_RENT' },
    { id: 4, name: 'ROLL_BOOST' },
    { id: 5, name: 'CASH_TIERED' },
    { id: 6, name: 'TELEPORT' },
    { id: 7, name: 'SHIELD' },
    { id: 8, name: 'PROPERTY_DISCOUNT' },
    { id: 9, name: 'TAX_REFUND' },
    { id: 10, name: 'ROLL_EXACT' },
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

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintCollectible',
      args: [
        collectibleRecipient as `0x${string}`,
        collectiblePerk,
        BigInt(collectibleStrength),
      ],
    });
  };

  const handleStockShop = async () => {
    if (!contractAddress) return alert('Contract not deployed');
    if (!stockAmount) return alert('Fill amount');

    const amount = BigInt(stockAmount);
    const tycPriceWei = stockTycPrice ? parseUnits(stockTycPrice, 18) : BigInt(0);
    const usdcPriceWei = stockUsdcPrice ? parseUnits(stockUsdcPrice, 6) : BigInt(0); // USDC typically 6 decimals

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [amount, stockPerk, BigInt(stockStrength), tycPriceWei, usdcPriceWei],
    });
  };

  const handleRestock = async () => {
    if (!contractAddress) return alert('Contract not deployed');
    if (!restockTokenId || !restockAmount) return alert('Fill tokenId and amount');

    const tokenId = BigInt(restockTokenId);
    const amount = BigInt(restockAmount);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'restockCollectible',
      args: [tokenId, amount],
    });
  };

  const handleUpdatePrices = async () => {
    if (!contractAddress) return alert('Contract not deployed');
    if (!updatePriceTokenId) return alert('Enter tokenId');

    const tokenId = BigInt(updatePriceTokenId);
    const tycPriceWei = updateTycPrice ? parseUnits(updateTycPrice, 18) : BigInt(0);
    const usdcPriceWei = updateUsdcPrice ? parseUnits(updateUsdcPrice, 6) : BigInt(0);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'updateCollectiblePrices',
      args: [tokenId, tycPriceWei, usdcPriceWei],
    });
  };

  const resetForm = () => {
    setVoucherRecipient('');
    setVoucherTycAmount('');
    setCollectibleRecipient('');
    setCollectiblePerk(1);
    setCollectibleStrength('1');
    setStockAmount('1');
    setStockPerk(1);
    setStockStrength('1');
    setStockTycPrice('0');
    setStockUsdcPrice('0');
    setRestockTokenId('');
    setRestockAmount('1');
    setUpdatePriceTokenId('');
    setUpdateTycPrice('0');
    setUpdateUsdcPrice('0');
    reset();
  };

  const explorerBase = chainId === 42220 ? 'explorer.celo.org' : chainId === 11155111 ? 'sepolia.etherscan.io' : 'etherscan.io';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-12 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          TycoonRewardSystem Admin Tester (Updated)
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
                <p className="text-green-400 mt-2">✓ Reward contract found: {contractAddress}</p>
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

            {/* Mint Collectible (non-shop reward) */}
            <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-8 mb-10 shadow-xl">
              <h2 className="text-3xl font-bold mb-6">mintCollectible() — onlyBackend (Direct Reward)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  {(collectiblePerk === 5 || collectiblePerk === 9) && (
                    <p className="text-sm text-gray-400 mt-1">Tier 1→10, 2→25, 3→50, 4→100, 5→250</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleMintCollectible}
                disabled={isLoading || !contractAddress}
                className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-xl font-bold text-xl"
              >
                {isLoading ? 'Processing...' : 'Mint Direct Collectible'}
              </button>
            </div>

            {/* Stock Shop (create new shop item) */}
            <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-2xl p-8 mb-10 shadow-xl">
              <h2 className="text-3xl font-bold mb-6">stockShop() — onlyBackend (Create New Shop Item)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-lg mb-2">Amount to Stock</label>
                  <input
                    type="text"
                    placeholder="10"
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
                  <label className="block text-lg mb-2">TYC Price (0 = not for sale in TYC)</label>
                  <input
                    type="text"
                    placeholder="50"
                    value={stockTycPrice}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setStockTycPrice(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">USDC Price (0 = not for sale in USDC, 6 decimals)</label>
                  <input
                    type="text"
                    placeholder="2.5"
                    value={stockUsdcPrice}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setStockUsdcPrice(e.target.value);
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
                {isLoading ? 'Processing...' : 'Stock New Shop Item'}
              </button>
            </div>

            {/* Restock Existing Item */}
            <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-2xl p-8 mb-10 shadow-xl">
              <h2 className="text-3xl font-bold mb-6">restockCollectible() — onlyBackend</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg mb-2">Token ID to Restock</label>
                  <input
                    type="text"
                    placeholder="2000000001"
                    value={restockTokenId}
                    onChange={(e) => {
                      if (/^\d*$/.test(e.target.value)) setRestockTokenId(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">Additional Amount</label>
                  <input
                    type="text"
                    placeholder="5"
                    value={restockAmount}
                    onChange={(e) => {
                      if (/^\d+$/.test(e.target.value) || e.target.value === '') setRestockAmount(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={handleRestock}
                disabled={isLoading || !contractAddress}
                className="mt-6 w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 rounded-xl font-bold text-xl"
              >
                {isLoading ? 'Processing...' : 'Restock Item'}
              </button>
            </div>

            {/* Update Prices */}
            <div className="bg-gradient-to-br from-teal-900 to-teal-800 rounded-2xl p-8 mb-10 shadow-xl">
              <h2 className="text-3xl font-bold mb-6">updateCollectiblePrices() — onlyBackend</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-lg mb-2">Token ID</label>
                  <input
                    type="text"
                    placeholder="2000000001"
                    value={updatePriceTokenId}
                    onChange={(e) => {
                      if (/^\d*$/.test(e.target.value)) setUpdatePriceTokenId(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">New TYC Price (0 to disable)</label>
                  <input
                    type="text"
                    placeholder="30"
                    value={updateTycPrice}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setUpdateTycPrice(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-lg mb-2">New USDC Price (0 to disable)</label>
                  <input
                    type="text"
                    placeholder="1.5"
                    value={updateUsdcPrice}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setUpdateUsdcPrice(e.target.value);
                    }}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={handleUpdatePrices}
                disabled={isLoading || !contractAddress}
                className="mt-6 w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-600 rounded-xl font-bold text-xl"
              >
                {isLoading ? 'Processing...' : 'Update Prices'}
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
                  href={`https://${explorerBase}/tx/${txHash}`}
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
                  Reset All Forms
                </button>
              </div>
            )}

            <div className="mt-12 text-center text-gray-500">
              <p className="text-sm">
                This tester supports the <strong>latest TycoonRewardSystem contract</strong> with:
              </p>
              <ul className="text-left inline-block mt-4 space-y-1 max-w-2xl">
                <li>• mintVoucher() — onlyOwner</li>
                <li>• mintCollectible() — onlyBackend (direct rewards)</li>
                <li>• stockShop() — dual TYC/USDC pricing</li>
                <li>• restockCollectible() — add more stock to existing item</li>
                <li>• updateCollectiblePrices() — dynamic pricing & sales</li>
                <li>• All new perks: TELEPORT, SHIELD, ROLL_EXACT, etc.</li>
              </ul>
              <p className="mt-6">Use responsibly. Only backend/owner can call these.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}