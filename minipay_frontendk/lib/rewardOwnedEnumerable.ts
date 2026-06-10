import type { Abi, Address } from 'viem';

/**
 * TycoonRewardSystem stores owner token types in _ownedIds[]. `ownedTokenCount(owner)` counts only
 * ids with balance &gt; 0, but `tokenOfOwnerByIndex(owner, i)` indexes the full array. After burns,
 * zero-balance ids could remain in older deployments, so count &lt; length and the UI would miss
 * later perks. Scanning slots until the first revert fixes reads without an upgraded contract.
 */
export const REWARD_OWNED_SLOT_SCAN_CAP = 96;

type ReadContractResult = { status: string; result?: unknown };

export function takeTokenIdsUntilFirstFailure(results: ReadContractResult[] | undefined): bigint[] {
  const out: bigint[] = [];
  if (!results) return out;
  for (const r of results) {
    if (r.status !== 'success') break;
    out.push(r.result as bigint);
  }
  return out;
}

export function buildTokenOfOwnerByIndexSlotCalls(
  rewardAddress: Address,
  abi: Abi,
  owner: Address,
  chainId: number | undefined,
  slotCap = REWARD_OWNED_SLOT_SCAN_CAP
) {
  const calls = [];
  for (let i = 0; i < slotCap; i++) {
    calls.push({
      address: rewardAddress,
      abi,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [owner, BigInt(i)] as const,
      ...(chainId != null ? { chainId } : {}),
    });
  }
  return calls;
}

/** One contiguous block of slot-scan results per holder, in holder order. */
export function mergeSlotScanResultsForHolders(
  holders: Address[],
  batchResults: ReadContractResult[] | undefined,
  slotCap = REWARD_OWNED_SLOT_SCAN_CAP
): { tokenIds: bigint[]; heldBy: Address[] } {
  const tokenIds: bigint[] = [];
  const heldBy: Address[] = [];
  if (!batchResults?.length || holders.length === 0) return { tokenIds, heldBy };

  let offset = 0;
  for (const owner of holders) {
    for (let i = 0; i < slotCap; i++) {
      const r = batchResults[offset + i];
      if (!r || r.status !== 'success') break;
      tokenIds.push(r.result as bigint);
      heldBy.push(owner);
    }
    offset += slotCap;
  }
  return { tokenIds, heldBy };
}

export function buildMergedHolderSlotCalls(
  rewardAddress: Address,
  abi: Abi,
  holders: Address[],
  chainId: number | undefined,
  slotCap = REWARD_OWNED_SLOT_SCAN_CAP
) {
  const calls = [];
  for (const owner of holders) {
    for (let i = 0; i < slotCap; i++) {
      calls.push({
        address: rewardAddress,
        abi,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [owner, BigInt(i)] as const,
        ...(chainId != null ? { chainId } : {}),
      });
    }
  }
  return calls;
}
