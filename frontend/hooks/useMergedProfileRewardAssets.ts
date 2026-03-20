'use client';

import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import RewardABI from '@/context/abi/rewardabi.json';

const VOUCHER_ID_START = 1_000_000_000n;
const COLLECTIBLE_ID_START = 2_000_000_000n;

function isVoucherToken(tokenId: bigint): boolean {
  return tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;
}

export type MergedCollectibleRow = {
  tokenId: bigint;
  perk: number;
  strength: number;
  shopStock: number;
  heldBy: Address;
};

export type MergedVoucherRow = {
  tokenId: bigint;
  value: string;
  heldBy: Address;
};

/**
 * Load ERC-1155-style reward "perks" and vouchers from every holder address (deduped).
 * Shop / Naira fulfillment mints to the smart wallet while profile used to read only one address — this merges both.
 */
export function useMergedProfileRewardAssets(
  rewardAddress: Address | undefined,
  chainId: number | undefined,
  holderCandidates: (Address | undefined | null)[]
) {
  const holders = useMemo(() => {
    const out: Address[] = [];
    const seen = new Set<string>();
    for (const raw of holderCandidates) {
      if (!raw) continue;
      const a = raw as Address;
      const k = a.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(a);
    }
    return out;
  }, [holderCandidates]);

  const ownedCountContracts = useMemo(() => {
    if (!rewardAddress || holders.length === 0) return [];
    return holders.map((owner) => ({
      address: rewardAddress,
      abi: RewardABI as Abi,
      functionName: 'ownedTokenCount' as const,
      args: [owner] as const,
      ...(chainId != null ? { chainId } : {}),
    }));
  }, [rewardAddress, holders, chainId]);

  const ownedCountRes = useReadContracts({
    contracts: ownedCountContracts,
    query: { enabled: !!rewardAddress && holders.length > 0 },
  });

  const tokenCalls = useMemo(() => {
    if (!rewardAddress || !ownedCountRes.data) return [];
    const calls: Array<{
      address: Address;
      abi: Abi;
      functionName: 'tokenOfOwnerByIndex';
      args: readonly [Address, bigint];
      chainId?: number;
    }> = [];
    ownedCountRes.data.forEach((res, oi) => {
      if (res.status !== 'success') return;
      const owner = holders[oi];
      if (!owner) return;
      const n = Number(res.result as bigint);
      for (let i = 0; i < n; i++) {
        calls.push({
          address: rewardAddress,
          abi: RewardABI as Abi,
          functionName: 'tokenOfOwnerByIndex',
          args: [owner, BigInt(i)],
          ...(chainId != null ? { chainId } : {}),
        });
      }
    });
    return calls;
  }, [ownedCountRes.data, holders, rewardAddress, chainId]);

  const tokenRes = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: tokenCalls.length > 0 },
  });

  const { tokenIds, heldBy } = useMemo(() => {
    const ids: bigint[] = [];
    const hs: Address[] = [];
    tokenRes.data?.forEach((r, i) => {
      if (r.status !== 'success') return;
      const c = tokenCalls[i];
      if (!c?.args?.[0]) return;
      ids.push(r.result as bigint);
      hs.push(c.args[0] as Address);
    });
    return { tokenIds: ids, heldBy: hs };
  }, [tokenRes.data, tokenCalls]);

  const infoCalls = useMemo(
    () =>
      tokenIds.map((id) => ({
        address: rewardAddress!,
        abi: RewardABI as Abi,
        functionName: 'getCollectibleInfo' as const,
        args: [id] as const,
        ...(chainId != null ? { chainId } : {}),
      })),
    [rewardAddress, tokenIds, chainId]
  );

  const infoRes = useReadContracts({
    contracts: infoCalls,
    query: { enabled: tokenIds.length > 0 && !!rewardAddress },
  });

  const ownedCollectibles: MergedCollectibleRow[] = useMemo(() => {
    const rows: MergedCollectibleRow[] = [];
    infoRes.data?.forEach((res, i) => {
      if (res?.status !== 'success') return;
      const tokenId = tokenIds[i];
      const h = heldBy[i];
      if (tokenId == null || !h) return;
      if (isVoucherToken(tokenId)) return;
      const [perkNum, strength, , , shopStock] = res.result as [bigint, bigint, bigint, bigint, bigint];
      const perk = Number(perkNum);
      if (perk === 0) return;
      rows.push({
        tokenId,
        perk,
        strength: Number(strength),
        shopStock: Number(shopStock),
        heldBy: h,
      });
    });
    return rows;
  }, [infoRes.data, tokenIds, heldBy]);

  const voucherEntries = useMemo(() => {
    const out: { tokenId: bigint; heldBy: Address }[] = [];
    tokenIds.forEach((id, i) => {
      if (isVoucherToken(id) && heldBy[i]) out.push({ tokenId: id, heldBy: heldBy[i]! });
    });
    return out;
  }, [tokenIds, heldBy]);

  const voucherTokenIds = useMemo(() => voucherEntries.map((e) => e.tokenId), [voucherEntries]);
  const voucherHolders = useMemo(() => voucherEntries.map((e) => e.heldBy), [voucherEntries]);

  const voucherInfoCalls = useMemo(
    () =>
      voucherTokenIds.map((id) => ({
        address: rewardAddress!,
        abi: RewardABI as Abi,
        functionName: 'voucherRedeemValue' as const,
        args: [id] as const,
        ...(chainId != null ? { chainId } : {}),
      })),
    [rewardAddress, voucherTokenIds, chainId]
  );

  const voucherInfoRes = useReadContracts({
    contracts: voucherInfoCalls,
    query: { enabled: voucherTokenIds.length > 0 && !!rewardAddress },
  });

  const myVouchers: MergedVoucherRow[] = useMemo(() => {
    return (
      voucherInfoRes.data
        ?.map((res, i) => {
          if (res?.status !== 'success') return null;
          return {
            tokenId: voucherTokenIds[i]!,
            value: formatUnits(res.result as bigint, 18),
            heldBy: voucherHolders[i]!,
          };
        })
        .filter((v): v is MergedVoucherRow => v != null) ?? []
    );
  }, [voucherInfoRes.data, voucherTokenIds, voucherHolders]);

  const isLoadingPerks =
    ownedCountRes.isPending ||
    (tokenCalls.length > 0 && tokenRes.isPending) ||
    (tokenIds.length > 0 && infoRes.isPending);

  const isLoadingVouchers =
    ownedCountRes.isPending ||
    (tokenCalls.length > 0 && tokenRes.isPending) ||
    (voucherTokenIds.length > 0 && voucherInfoRes.isPending);

  return {
    holders,
    ownedCollectibles,
    myVouchers,
    isLoadingPerks,
    isLoadingVouchers,
  };
}
