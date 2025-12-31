'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Dice1, ShoppingBag, AlertTriangle, Wallet, Send, Zap, Sparkles, Gem, Shield, Ticket, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import RewardABI from '@/context/abi/rewardabi.json';
import TycoonABI from '@/context/abi/tycoonabi.json';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const getPerkMetadata = (perk: number) => {
  const data = [
    null,
    { name: 'Extra Turn', icon: <Zap className="w-8 h-8" />, color: 'text-yellow-400' },
    { name: 'Get Out of Jail Free', icon: <Crown className="w-8 h-8" />, color: 'text-purple-400' },
    { name: 'Double Rent', icon: <Coins className="w-8 h-8" />, color: 'text-green-400' },
    { name: 'Roll Boost', icon: <Sparkles className="w-8 h-8" />, color: 'text-blue-400' },
    { name: 'Instant Cash', icon: <Gem className="w-8 h-8" />, color: 'text-cyan-400' },
    { name: 'Teleport', icon: <Zap className="w-8 h-8" />, color: 'text-pink-400' },
    { name: 'Shield', icon: <Shield className="w-8 h-8" />, color: 'text-indigo-400' },
    { name: 'Property Discount', icon: <Coins className="w-8 h-8" />, color: 'text-orange-400' },
    { name: 'Tax Refund', icon: <Gem className="w-8 h-8" />, color: 'text-teal-400' },
    { name: 'Exact Roll', icon: <Sparkles className="w-8 h-8" />, color: 'text-amber-400' },
  ];
  return data[perk] || { name: `Perk #${perk}`, icon: <Gem className="w-8 h-8" />, color: 'text-gray-400' };
};

const getImage = (index: number): string => {
  const images = ["/game/shop/a.jpeg", "/game/shop/b.jpeg", "/game/shop/c.jpeg"];
  return images[index % 3];
};

export default function ProfilePage() {
  const { address: walletAddress, isConnected, chainId } = useAccount();

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendAddress, setSendAddress] = useState('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: ethBalance } = useBalance({ address: walletAddress });

  const tycTokenAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  // === TYC & USDC Balances ===
  const tycBalance = useBalance({ address: walletAddress, token: tycTokenAddress, query: { enabled: !!walletAddress && !!tycTokenAddress } });
  const usdcBalance = useBalance({ address: walletAddress, token: usdcTokenAddress, query: { enabled: !!walletAddress && !!usdcTokenAddress } });

  // === Username & Player Stats ===
  const { data: username } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!tycoonAddress },
  });

  const { data: playerData } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username as string] : undefined,
    query: { enabled: !!username && !!tycoonAddress },
  });

  // === Collectibles (Perks) Owned ===
  const ownedCount = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!rewardAddress },
  });

  const ownedCountNum = Number(ownedCount.data ?? 0);

  const tokenCalls = useMemo(() =>
    Array.from({ length: ownedCountNum }, (_, i) => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [walletAddress!, BigInt(i)],
    } as const)),
  [rewardAddress, walletAddress, ownedCountNum]);

  const tokenResults = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCountNum > 0 && !!rewardAddress && !!walletAddress },
  });

  const allOwnedTokenIds = tokenResults.data
    ?.map(r => r.status === 'success' ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null) ?? [];

  const infoCalls = useMemo(() =>
    allOwnedTokenIds.map(id => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'getCollectibleInfo',
      args: [id],
    } as const)),
  [rewardAddress, allOwnedTokenIds]);

  const infoResults = useReadContracts({
    contracts: infoCalls,
    query: { enabled: allOwnedTokenIds.length > 0 },
  });

  const ownedCollectibles = useMemo(() => {
    return infoResults.data?.map((res, i) => {
      if (res?.status !== 'success') return null;
      const [perkNum, strength, , , shopStock] = res.result as [bigint, bigint, bigint, bigint, bigint];
      const perk = Number(perkNum);
      if (perk === 0) return null; // Not a valid collectible

      const tokenId = allOwnedTokenIds[i];
      const balance = tokenResults.data?.[i]?.status === 'success' ? 1 : 0; // ERC1155, usually 1 per type

      const meta = getPerkMetadata(perk);

      return {
        tokenId,
        name: meta.name,
        icon: meta.icon,
        color: meta.color,
        image: getImage(i),
        count: 1,
        strength: Number(strength),
        shopStock: Number(shopStock),
        isTiered: perk === 5 || perk === 9,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null) ?? [];
  }, [infoResults.data, allOwnedTokenIds, tokenResults.data]);

  // === Vouchers Owned ===
  const voucherTokenIds = allOwnedTokenIds.filter(isVoucherToken);

  const voucherInfoCalls = useMemo(() =>
    voucherTokenIds.map(id => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'getCollectibleInfo',
      args: [id],
    } as const)),
  [rewardAddress, voucherTokenIds]);

  const voucherInfoResults = useReadContracts({
    contracts: voucherInfoCalls,
    query: { enabled: voucherTokenIds.length > 0 },
  });

  const myVouchers = useMemo(() => {
    return voucherInfoResults.data?.map((res, i) => {
      if (res?.status !== 'success') return null;
      const [, , tycPrice] = res.result as [bigint, bigint, bigint, bigint, bigint]; // tycPrice holds voucher value
      return {
        tokenId: voucherTokenIds[i],
        value: formatUnits(tycPrice, 18),
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null) ?? [];
  }, [voucherInfoResults.data, voucherTokenIds]);

  // === Load Player Stats ===
  React.useEffect(() => {
    if (playerData && username) {
      const d = playerData as any;
      setUserData({
        username: username || 'Unknown',
        address: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '',
        gamesPlayed: Number(d.gamesPlayed || 0),
        wins: Number(d.gamesWon || 0),
        losses: Number(d.gamesLost || 0),
        winRate: d.gamesPlayed > 0 ? ((Number(d.gamesWon) / Number(d.gamesPlayed)) * 100).toFixed(1) + '%' : '0%',
        totalEarned: Number(d.totalEarned || 0),
      });
      setLoading(false);
    } else if (playerData === null && !loading) {
      setError('No player data found');
      setLoading(false);
    }
  }, [playerData, username, walletAddress]);

  // === Send Perk ===
   // === Send Perk (safeTransferFrom) ===
  const handleSend = (tokenId: bigint) => {
    if (!walletAddress || !rewardAddress) {
      toast.error("Wallet or contract not available");
      return;
    }

    if (!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress)) {
      toast.error('Please enter a valid wallet address');
      return;
    }

    setSendingTokenId(tokenId);

    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'safeTransferFrom',
      args: [
        walletAddress as `0x${string}`,
        sendAddress as `0x${string}`,
        tokenId,
        1,
        '0x',
      ],
    });
  };

  // === Redeem Voucher ===
  const handleRedeemVoucher = (tokenId: bigint) => {
    if (!rewardAddress) {
      toast.error("Reward contract not available");
      return;
    }

    setRedeemingId(tokenId);

    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  };

  // === Transaction Success Handler ===
  React.useEffect(() => {
    if (txSuccess && txHash) {
      toast.success('Transaction successful!');
      reset();
      setSendingTokenId(null);
      setRedeemingId(null);
      // Refetch TYC balance after successful tx
      tycBalance.refetch();
    }
  }, [txSuccess, txHash, reset, tycBalance]);
  React.useEffect(() => {
    if (txSuccess && txHash) {
      toast.success('Transaction successful!');
      reset();
      setSendingTokenId(null);
      setRedeemingId(null);
      // Refetch balances
      tycBalance.refetch();
    }
  }, [txSuccess, txHash, reset, tycBalance]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center">
        <div className="text-center p-10 bg-red-950/60 rounded-3xl border border-red-700/50">
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Wallet Not Connected</h2>
          <p className="mt-4 text-lg">Connect your wallet to view your profile</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00F0FF] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-xl">Loading your Tycoon profile...</p>
        </div>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center text-red-400 text-2xl">
        Error: {error || 'No profile data'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] font-orbitron">
      <header className="w-full h-[87px] flex items-center justify-between px-4 md:px-8 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm border-b border-[#003B3E]">
        <Link href="/" className="text-[#00F0FF] text-xl font-bold">← Back to Tycoon</Link>
        <h1 className="text-2xl uppercase font-kronaOne text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC]">Profile</h1>
        <div className="w-10" />
      </header>

      <main className="w-full max-w-6xl mx-auto p-4 md:p-8">
        {/* Avatar & Username */}
        <section className="text-center mb-12">
          <div className="relative mx-auto w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-[#00F0FF] mb-6 shadow-2xl">
            <Image src={avatar} alt="Avatar" width={200} height={200} className="object-cover w-full h-full" />
            <div className="absolute bottom-2 right-2 bg-[#00F0FF] p-2 rounded-full shadow-lg">
              <Crown className="w-6 h-6 text-[#010F10]" />
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#00F0FF] mb-2">{userData.username}</h2>
          <p className="text-lg text-[#AFBAC0]">Wallet: <span className="text-[#00F0FF] font-mono">{userData.address}</span></p>
        </section>

        {/* Balances */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Coins className="w-10 h-10 text-[#FFD700] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#FFD700]">TYC Balance</h3>
            <p className="text-3xl font-bold mt-2">
              {tycBalance.isLoading ? <Loader2 className="inline w-6 h-6 animate-spin" /> : Number(tycBalance.data?.formatted || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Wallet className="w-10 h-10 text-[#00F0FF] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#00F0FF]">USDC Balance</h3>
            <p className="text-3xl font-bold mt-2">
              {usdcBalance.isLoading ? <Loader2 className="inline w-6 h-6 animate-spin" /> : Number(usdcBalance.data?.formatted || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <div className="w-10 h-10 bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] rounded-full mx-auto mb-3 flex items-center justify-center text-black font-bold">ETH</div>
            <h3 className="text-xl font-bold text-[#0FF0FC]">Base ETH</h3>
            <p className="text-3xl font-bold mt-2">{ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0.0000'}</p>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <BarChart2 className="w-8 h-8 text-[#00F0FF] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#00F0FF]">Games Played</h3>
            <p className="text-2xl font-bold">{userData.gamesPlayed}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Crown className="w-8 h-8 text-[#FFD700] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#FFD700]">Wins</h3>
            <p className="text-2xl font-bold">{userData.wins}</p>
            <p className="text-sm text-[#AFBAC0]">{userData.winRate} Win Rate</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Dice1 className="w-8 h-8 text-[#0FF0FC] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#0FF0FC]">Losses</h3>
            <p className="text-2xl font-bold">{userData.losses}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Coins className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-xl font-bold text-emerald-400">Total Earned</h3>
            <p className="text-2xl font-bold">{userData.totalEarned} BLOCK</p>
          </div>
        </section>

        {/* My Vouchers */}
        <section className="mb-12">
          <h3 className="text-3xl font-bold text-amber-400 mb-8 flex items-center gap-3">
            <Ticket className="w-10 h-10" />
            My Vouchers ({myVouchers.length})
          </h3>
          {myVouchers.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-xl">No vouchers yet. Win games to earn them!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {myVouchers.map((voucher) => (
                <motion.div
                  key={voucher.tokenId.toString()}
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border-2 border-amber-600/50 text-center"
                >
                  <Ticket className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                  <p className="text-3xl font-bold text-amber-300 mb-2">{voucher.value} TYC</p>
                  <p className="text-xs text-gray-400 mb-6">ID: {voucher.tokenId.toString()}</p>
                  <button
                    onClick={() => handleRedeemVoucher(voucher.tokenId)}
                    disabled={redeemingId === voucher.tokenId || isWriting || isConfirming}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
                      redeemingId === voucher.tokenId || isWriting || isConfirming
                        ? 'bg-gray-700 text-gray-400 cursor-wait'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black'
                    }`}
                  >
                    {redeemingId === voucher.tokenId && (isWriting || isConfirming) ? (
                      <> <Loader2 className="w-5 h-5 animate-spin" /> Redeeming... </>
                    ) : (
                      <> <Coins className="w-5 h-5" /> Redeem Now </>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Collectibles (Perks) */}
        <section className="mb-12">
          <h3 className="text-3xl font-bold text-[#00F0FF] mb-8 flex items-center gap-3">
            <ShoppingBag className="w-8 h-8" />
            Collectibles Owned ({ownedCollectibles.length})
          </h3>
          {ownedCollectibles.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-xl">No collectibles yet. Visit the shop!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {ownedCollectibles.map((item, idx) => (
                <div
                  key={item.tokenId.toString()}
                  className="rounded-2xl p-6 bg-[#0E1415]/80 border-2 border-[#003B3E] hover:border-[#00F0FF] transition-all hover:scale-105"
                >
                  <div className="flex justify-center mb-4">{React.cloneElement(item.icon, { className: `w-12 h-12 ${item.color}` })}</div>
                  <h4 className="font-bold text-xl mb-2 text-center">{item.name}</h4>
                  {item.isTiered && item.strength > 0 && (
                    <p className="text-center text-cyan-300 text-sm mb-2">Tier {item.strength}</p>
                  )}
                  <p className="text-3xl font-bold text-[#00F0FF] text-center my-3">×{item.count}</p>
                  <p className="text-xs text-gray-400 text-center mb-4">
                    Shop Stock: <span className={item.shopStock < 50 && item.shopStock > 0 ? 'text-orange-400' : 'text-emerald-300'}>
                      {item.shopStock || 'N/A'}
                    </span>
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="0x... address"
                      value={sendAddress}
                      onChange={(e) => setSendAddress(e.target.value.trim())}
                      className="w-full px-3 py-2 bg-gray-800/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      onClick={() => handleSend(item.tokenId)}
                      disabled={isWriting || isConfirming || sendingTokenId === item.tokenId}
                      className="w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? 'Sending...' : 'Send 1'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-4">ID: {item.tokenId.toString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}