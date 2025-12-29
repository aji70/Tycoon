'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import {
  useRewardVoucherRedeemValue,
  useRewardCollectiblePerk,
  useRewardGetCashTierValue,
  useRewardCollectibleShopPrice,
  useRewardRedeemVoucher,
  useRewardBurnCollectible,
  useRewardBuyCollectible,
  useRewardTokenBalance,
  isVoucherToken,
  isCollectibleToken,
  VOUCHER_ID_START,
  COLLECTIBLE_ID_START,
} from '@/context/ContractProvider'; // Adjust path to your hooks file
import { formatUnits } from 'viem';

export default function RewardContractTester() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [tokenId, setTokenId] = useState<bigint | ''>('');
  const [tier, setTier] = useState<number | ''>('');

  // Convert input to bigint safely
  const tokenIdBigInt = tokenId === '' ? undefined : BigInt(tokenId);

  // Read Hooks
  const { data: voucherValue, isLoading: loadingVoucherValue } = useRewardVoucherRedeemValue(tokenIdBigInt);
  const { data: collectiblePerk, isLoading: loadingPerk } = useRewardCollectiblePerk(tokenIdBigInt);
  const { data: cashTierValue, isLoading: loadingCashTier } = useRewardGetCashTierValue(tier || undefined);
  const { price: shopPrice, isLoading: loadingShopPrice } = useRewardCollectibleShopPrice(tokenIdBigInt);
  const { balance, isLoading: loadingBalance } = useRewardTokenBalance(address, tokenIdBigInt);

  // Write Hooks
  const { redeem, isPending: redeeming, isSuccess: redeemed, error: redeemError, txHash: redeemTx } = useRewardRedeemVoucher();
  const { burn, isPending: burning, isSuccess: burned, error: burnError, txHash: burnTx } = useRewardBurnCollectible();
  const { buy, isPending: buying, isSuccess: bought, error: buyError, txHash: buyTx } = useRewardBuyCollectible();

  const handleRedeem = async () => {
    if (!tokenIdBigInt) return alert('Enter a token ID');
    if (!isVoucherToken(tokenIdBigInt)) return alert('This is not a voucher token ID');
    await redeem(tokenIdBigInt);
  };

  const handleBurn = async () => {
    if (!tokenIdBigInt) return alert('Enter a token ID');
    if (!isCollectibleToken(tokenIdBigInt)) return alert('This is not a collectible token ID');
    await burn(tokenIdBigInt);
  };

  const handleBuy = async () => {
    if (!tokenIdBigInt) return alert('Enter a token ID');
    if (!isCollectibleToken(tokenIdBigInt)) return alert('This is not a collectible token ID');
    if (shopPrice === BigInt(0) || shopPrice === undefined) return alert('This collectible is not for sale');
    await buy(tokenIdBigInt);
  };

  const getTokenType = (id: bigint) => {
    if (isVoucherToken(id)) return 'Voucher (Redeemable for TYC)';
    if (isCollectibleToken(id)) return 'Collectible (Burnable for Perk)';
    return 'Unknown / Invalid';
  };

  const perkName = (perkId: number) => {
    const names = {
      0: 'NONE',
      1: 'EXTRA_TURN',
      2: 'JAIL_FREE',
      3: 'DOUBLE_RENT',
      4: 'ROLL_BOOST',
      5: 'CASH_TIERED',
    };
    return names[perkId as keyof typeof names] || 'UNKNOWN';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">TycoonRewardSystem Contract Tester</h1>

        {!isConnected ? (
          <div className="text-center text-red-400 text-xl">Please connect your wallet</div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <p className="text-sm text-gray-400">Connected Address:</p>
              <p className="font-mono text-lg break-all">{address}</p>
              <p className="text-sm text-gray-400 mt-2">Chain ID: {chainId}</p>
            </div>

            {/* Token ID Input */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4">Test Token ID</h2>
              <input
                type="number"
                placeholder="Enter Token ID (e.g. 1000000001 or 2000000001)"
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white mb-4"
                value={tokenId === '' ? '' : tokenId.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  setTokenId(val === '' ? '' : BigInt(val));
                }}
              />

              {tokenIdBigInt && (
                <div className="mt-4 p-4 bg-gray-700 rounded">
                  <p><strong>Token Type:</strong> {getTokenType(tokenIdBigInt)}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Vouchers: ≥ {VOUCHER_ID_START.toString()} <br />
                    Collectibles: ≥ {COLLECTIBLE_ID_START.toString()}
                  </p>
                </div>
              )}
            </div>

            {/* Read Functions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Voucher Value */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-3">voucherRedeemValue()</h3>
                {loadingVoucherValue ? <p>Loading...</p> : 
                 voucherValue !== undefined ? (
                  <p className="text-2xl font-bold text-green-400">
                    {formatUnits(voucherValue, 18)} TYC
                  </p>
                 ) : <p className="text-gray-400">Not a voucher or value = 0</p>}
              </div>

              {/* Collectible Perk */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-3">getCollectiblePerk()</h3>
                {loadingPerk ? <p>Loading...</p> :
                 collectiblePerk ? (
                  <div>
                    <p><strong>Perk:</strong> {perkName(collectiblePerk.perk)}</p>
                    <p><strong>Strength/Tier:</strong> {collectiblePerk.strength.toString()}</p>
                    {collectiblePerk.perk === 5 && (
                      <p className="text-sm text-gray-300 mt-2">
                        Cash Amount: {collectiblePerk.strength >= 1 && collectiblePerk.strength <= 5 
                          ? [0, 10, 25, 50, 100, 250][Number(collectiblePerk.strength)] 
                          : 'Invalid'} in-game cash
                      </p>
                    )}
                  </div>
                 ) : <p className="text-gray-400">No perk data</p>}
              </div>

              {/* Shop Price */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-3">collectibleShopPrice()</h3>
                {loadingShopPrice ? <p>Loading...</p> :
                 shopPrice !== undefined ? (
                  shopPrice > BigInt(0) ? (
                    <p className="text-2xl font-bold text-yellow-400">
                      {formatUnits(shopPrice, 18)} TYC
                    </p>
                  ) : (
                    <p className="text-red-400">Not for sale</p>
                  )
                 ) : <p className="text-gray-400">Not a collectible</p>}
              </div>

              {/* Balance */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-3">Your Balance (balanceOf)</h3>
                {loadingBalance ? <p>Loading...</p> :
                 balance !== undefined ? (
                  <p className="text-2xl font-bold">{balance.toString()} × Token #{tokenIdBigInt?.toString()}</p>
                 ) : <p className="text-gray-400">No balance data</p>}
              </div>
            </div>

            {/* Cash Tier Tester */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4">Test getCashTierValue(tier)</h2>
              <input
                type="number"
                min="1"
                max="5"
                placeholder="Enter tier (1-5)"
                className="w-48 px-4 py-3 bg-gray-700 rounded-lg text-white"
                value={tier === '' ? '' : tier}
                onChange={(e) => setTier(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <div className="mt-4">
                {loadingCashTier ? <p>Loading...</p> :
                 cashTierValue !== undefined ? (
                  <p className="text-xl">
                    Tier {tier}: <strong>{cashTierValue.toString()} in-game cash</strong>
                  </p>
                 ) : <p className="text-gray-400">Invalid tier</p>}
              </div>
              <p className="text-sm text-gray-400 mt-4">
                Tiers: 1→10, 2→25, 3→50, 4→100, 5→250
              </p>
            </div>

            {/* Write Functions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Redeem Voucher */}
              <div className="bg-gradient-to-br from-purple-800 to-purple-900 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">redeemVoucher()</h3>
                <button
                  onClick={handleRedeem}
                  disabled={redeeming || !tokenIdBigInt || !isVoucherToken(tokenIdBigInt)}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded-lg font-bold"
                >
                  {redeeming ? 'Redeeming...' : 'Redeem Voucher'}
                </button>
                {redeemed && <p className="text-green-400 mt-3">Success! Tx: {redeemTx?.slice(0, 10)}...</p>}
                {redeemError && <p className="text-red-400 mt-3">Error: {redeemError.message}</p>}
              </div>

              {/* Burn Collectible */}
              <div className="bg-gradient-to-br from-red-800 to-red-900 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">burnCollectibleForPerk()</h3>
                <button
                  onClick={handleBurn}
                  disabled={burning || !tokenIdBigInt || !isCollectibleToken(tokenIdBigInt)}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 rounded-lg font-bold"
                >
                  {burning ? 'Burning...' : 'Burn for Perk'}
                </button>
                {burned && <p className="text-green-400 mt-3">Burned! Tx: {burnTx?.slice(0, 10)}...</p>}
                {burnError && <p className="text-red-400 mt-3">Error: {burnError.message}</p>}
              </div>

              {/* Buy Collectible */}
              <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">buyCollectible()</h3>
                 <button
  onClick={handleBuy}
  disabled={
    buying || 
    !tokenIdBigInt || 
    !isCollectibleToken(tokenIdBigInt) || 
    shopPrice === undefined || 
    shopPrice === BigInt(0)
  }
  className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg font-bold transition"
>
  {buying
    ? 'Buying...'
    : shopPrice !== undefined && shopPrice > 0
      ? `Buy for ${formatUnits(shopPrice, 18)} TYC`
      : shopPrice === undefined
        ? 'Loading price...'
        : 'Not for sale'
  }
</button>
                {bought && <p className="text-green-400 mt-3">Purchased! Tx: {buyTx?.slice(0, 10)}...</p>}
                {buyError && <p className="text-red-400 mt-3 break-all">Error: {buyError.message}</p>}
                <p className="text-xs text-gray-300 mt-4">
                  Note: You must approve TYC spending first!
                </p>
              </div>
            </div>

            <div className="mt-12 text-center text-gray-500 text-sm">
              <p>Use this page to test all functions of TycoonRewardSystem</p>
              <p className="mt-2">Make sure you're on the correct network and have TYC tokens</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}