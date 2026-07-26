/**
 * Soft perk IDs shared with TycoonSoftPerkCatalog (keccak256 of UTF-8 label).
 */

import { id as keccakId } from "ethers";

/** On-chain label → bytes32 perkId (ethers.id = keccak256(utf8)). */
export const SOFT_PERK_LABELS = {
  AI_TIP_PACK_V1: "ai_tip_pack_v1",
};

export function softPerkIdFromLabel(label) {
  return keccakId(String(label));
}

export const AI_TIP_PACK_PERK_ID = softPerkIdFromLabel(SOFT_PERK_LABELS.AI_TIP_PACK_V1);

export function getSoftPerkCatalogAddress() {
  return (
    process.env.SOFT_PERK_CATALOG_ADDRESS ||
    process.env.TYCOON_SOFT_PERK_CATALOG ||
    null
  );
}

export function isSoftPerkCatalogConfigured() {
  const addr = getSoftPerkCatalogAddress();
  return Boolean(addr && String(addr).startsWith("0x") && addr.length === 42);
}
