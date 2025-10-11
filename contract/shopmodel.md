# Blockopoly Shop & Addons Revenue Model

## 1. Item Categories

### 🎮 Gameplay Addons (Consumables)
- **Purpose:** Boost player experience, provide temporary gameplay advantages.
- **Usage:** Burned on use.
- **Examples:**
  - Lucky Roll → reroll dice once per turn.
  - Jail Escape Kit → skip jail without paying.
  - Rent Shield → reduce rent cost for one turn.
  - Extra Move → move additional spaces in a turn.
  - Swap Property → swap one owned property with another player.
- **Revenue Model:** Sold for in-game tokens; drives repeat purchases.

### 🎨 Cosmetic Addons (Permanent / NFT)
- **Purpose:** Personalize the game experience.
- **Usage:** Permanent, tradable, collectible.
- **Examples:**
  - Dice Skin (Gold, Neon, Classic)
  - Player Token Skins (Dragon, Car, Hat variants)
  - Game Board Themes (Forest, Space, Retro)
  - Animated Avatars & Icons
  - Victory Banners / Trophies
- **Revenue Model:** Sell as NFTs in shop or marketplace; secondary sales generate royalties.

### ⚡ Hybrid Addons (Limited-Use + Cosmetic)
- **Purpose:** Mix of gameplay effect + visual flair.
- **Usage:** Limited-use in-game, remains visible in inventory.
- **Examples:**
  - Power-Up Card → increases chance of landing on bonus tiles + glow effect.
  - Golden Token → temporarily boosts rent collection + gold aura.
  - Jackpot Dice → chance to double dice result once + visual sparkle.
- **Revenue Model:** Priced higher than consumables due to added cosmetic value.

---

## 2. Shop Pricing Strategy

| Category          | Type        | Pricing Example          | Burnable? | Notes                             |
|------------------|------------|------------------------|-----------|----------------------------------|
| Gameplay Addons   | Consumable | 5-50 tokens            | Yes       | Encourages repeat purchases      |
| Cosmetic Addons   | NFT        | 50-500 tokens / ETH    | No        | Tradable, collectible, rare      |
| Hybrid Addons     | Limited    | 100-300 tokens         | Partially | Visual effect + gameplay impact  |

---

## 3. Revenue Opportunities

1. **Direct Sales** – Sell addons in shop for tokens or ETH.
2. **Bundles & Seasonal Packs** – Holiday-themed packs, bulk purchases.
3. **Player Progression Rewards** – Unlock rare items for achievements.
4. **Limited Editions** – Scarcity creates hype; drives urgency.
5. **Secondary Market Royalties** – Cosmetic NFTs can generate ongoing revenue.
6. **Cross-Promotion** – Special branded or event-based addons.

---

## 4. Implementation Notes

- **Gameplay Addons** → burn on use to maintain scarcity.
- **Cosmetic Addons** → permanent NFTs, tradable.
- **Hybrid Addons** → limited use, visible in inventory.
- **Metadata** → include `name`, `type`, `effect`, `rarity`, `iconURL` for each addon.
- **Frontend Shop** → display all categories, rarity, price, and visual preview.
- **Smart Contract** → track ownership, burnables, NFT minting, and shop purchases.

---

## 5. Metadata Example (JSON)

```json
{
  "name": "Lucky Roll",
  "type": "Gameplay",
  "effect": "Reroll dice once per turn",
  "rarity": "Common",
  "iconURL": "https://example.com/icons/lucky_roll.png",
  "burnable": true
}
