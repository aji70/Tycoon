# Tycoon — Complete Game Mechanics & Calculations Reference

This document describes **every rule, formula, and calculation** used in the Tycoon game. Nothing is left out.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Board Layout & Positions](#2-board-layout--positions)
3. [Game Setup](#3-game-setup)
4. [Turn Flow](#4-turn-flow)
5. [Dice Mechanics](#5-dice-mechanics)
6. [Rent Calculations](#6-rent-calculations)
7. [Property Development (Houses & Hotels)](#7-property-development-houses--hotels)
8. [Mortgage & Unmortgage](#8-mortgage--unmortgage)
9. [Chance & Community Chest Cards](#9-chance--community-chest-cards)
10. [Jail](#10-jail)
11. [Bankruptcy & Winning](#11-bankruptcy--winning)
12. [Turn Timer & Timeouts](#12-turn-timer--timeouts)
13. [AI Buy Score Calculation](#13-ai-buy-score-calculation)
14. [Net Worth & Time-Based Victory](#14-net-worth--time-based-victory)
15. [Trading](#15-trading)

---

## 1. Overview

Tycoon is a Monopoly-inspired board game with a 40-space board. Players take turns rolling dice, moving, buying properties, paying rent, and building houses/hotels. The last player standing (or the highest net worth when time runs out in AI mode) wins.

---

## 2. Board Layout & Positions

The board has **40 positions** (0–39):

| Position | Type | Name / Notes |
|----------|------|--------------|
| 0 | **Go** | Collect $200 when passing |
| 1, 3 | Property | Brown group (2 properties) |
| 2 | Community Chest | Draw card |
| 4 | Income Tax | Pay `property.price` ($100) |
| 5, 15, 25, 35 | Railroad | Special rent (see §6.2) |
| 6, 8, 9 | Property | Light blue group |
| 7 | Chance | Draw card |
| 10 | Visiting Jail | Just visiting |
| 11, 13, 14 | Property | Pink group |
| 12 | Utility | Electric Company |
| 16, 18, 19 | Property | Orange group |
| 17 | Community Chest | Draw card |
| 20 | Free Parking | No effect |
| 21, 23, 24 | Property | Red group |
| 22 | Chance | Draw card |
| 26, 27, 29 | Property | Yellow group |
| 25 | Railroad | |
| 28 | Utility | Water Works |
| 30 | **Go to Jail** | Sent to jail, no $200 |
| 31, 32, 34 | Property | Green group |
| 33 | Community Chest | Draw card |
| 36 | Chance | Draw card |
| 37, 39 | Property | Dark blue group |
| 38 | Luxury Tax | Pay `property.price` ($100) |

**Color groups (for monopolies):**

- `brown`: [1, 3]  
- `lightblue`: [6, 8, 9]  
- `pink`: [11, 13, 14]  
- `orange`: [16, 18, 19]  
- `red`: [21, 23, 24]  
- `yellow`: [26, 27, 29]  
- `green`: [31, 32, 34]  
- `darkblue`: [37, 39]  
- `railroad`: [5, 15, 25, 35]  
- `utility`: [12, 28]

---

## 3. Game Setup

### Starting Cash

- **Default:** $1,500 per player (from `game_settings.starting_cash`)
- Each player begins with this balance and position 0.

### Game Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `starting_cash` | Starting balance | 1500 |
| `auction` | Auction when player declines purchase | false |
| `mortgage` | Mortgaging allowed | false |
| `even_build` | Must build evenly across monopoly | false |
| `randomize_play_order` | Randomize turn order at start | false |

---

## 4. Turn Flow

1. **Roll** — Current player rolls two dice (2d6).
2. **Move** — Token advances by the total (2–12, except 12 is re-rolled; see §5).
3. **Land action** — Resolve the space (buy, pay rent, draw card, tax, jail, etc.).
4. **Optional actions** — Build, mortgage, unmortgage, trade (any time during your turn).
5. **End turn** — Pass turn to next player.

### Round structure

- Each player rolls once per round.
- When all players have rolled, `rolls` is reset to 0 for everyone and the next round starts.

---

## 5. Dice Mechanics

### Roll

- **Two six-sided dice** (2d6).
- Each die: 1–6.
- Total: 2–12.

### Special rule: double 6

- If **total = 12** (double 6), the roll is treated as **invalid**.
- The player must **roll again** (no move).
- This is implemented as returning `null` for a 12; the UI keeps the Roll Dice button until a valid roll.

### Movement

- `new_position = (old_position + total) % 40`
- Passing Go: when `new_position < old_position`, player receives **$200**.

---

## 6. Rent Calculations

### 6.1 Standard properties (colored groups)

Rent depends on **development level** (0–5):

| Development | Meaning | Rent field |
|-------------|---------|------------|
| 0 | Vacant (site only) | `rent_site_only` |
| 1 | 1 house | `rent_one_house` |
| 2 | 2 houses | `rent_two_houses` |
| 3 | 3 houses | `rent_three_houses` |
| 4 | 4 houses | `rent_four_houses` |
| 5 | Hotel | `rent_hotel` |

**Formula:**

```
rent = property[rentFields[development]]
```

Where `rentFields = [rent_site_only, rent_one_house, rent_two_houses, rent_three_houses, rent_four_houses, rent_hotel]`.

**Conditions for paying rent:**

- Property is owned.
- Owner is not the landing player.
- Property is **not mortgaged** (mortgaged = no rent).

### 6.2 Railroads (positions 5, 15, 25, 35)

Rent depends on **how many railroads** the owner has:

| Railroads owned | Rent |
|-----------------|------|
| 1 | $25 |
| 2 | $50 |
| 3 | $100 |
| 4 | $200 |

**Formula:**

```javascript
RAILWAY_RENT = { 1: 25, 2: 50, 3: 100, 4: 200 };
rent = RAILWAY_RENT[count] || 0;
```

### 6.3 Utilities (positions 12, 28)

Rent depends on **how many utilities** the owner has and the **dice total**:

| Utilities owned | Multiplier |
|-----------------|------------|
| 1 | 4× dice total |
| 2 | 10× dice total |

**Formula:**

```javascript
UTILITY_MULTIPLIER = { 1: 4, 2: 10 };
rent = diceTotal × UTILITY_MULTIPLIER[ownedCount];
```

**Example:** Own both utilities, opponent rolls 7 → rent = 7 × 10 = **$70**.

---

## 7. Property Development (Houses & Hotels)

### Prerequisites

1. Own **all** properties in the color group (monopoly).
2. Property is **not mortgaged**.
3. Player is **not in jail** (no build from jail).
4. Sufficient balance: `balance >= cost_of_house`.

### Building (add house/hotel)

- **Cost per house:** `property.cost_of_house` (e.g. $50 for brown/pink, $100 for orange/red/yellow/green, $150 for light blue, $200 for dark blue).
- **Max level:** 5 (hotel = development 5).
- **Even build (optional):** If `even_build` is true, development levels in the group must differ by at most 1 (e.g. 2–2–1 allowed, 3–1–0 not).
- You can only add one house if that keeps the group within the even-build rule.
- **Effect:** `balance -= cost_of_house`, `development += 1`.

### Selling buildings (downgrade)

- **Refund:** Half of `cost_of_house` per house/hotel sold.
- **Formula:** `balance += cost_of_house / 2`, `development -= 1`.
- Must have at least 1 house/hotel to sell.
- Must not be in jail.

---

## 8. Mortgage & Unmortgage

### Mortgage

**Conditions:**

- Own the property.
- Not in jail.
- `development === 0` (no houses/hotels).

**Cash received:**

```
cash = property.price / 2
```

**Effect:** `balance += price/2`, `mortgaged = true`. No rent while mortgaged.

### Unmortgage

**Conditions:**

- Property is mortgaged.
- Not in jail.
- `balance >= property.price` (full price, not half).

**Cost:**

```
cost = property.price
```

**Effect:** `balance -= price`, `mortgaged = false`.

**Note:** Unmortgage cost is the **full** price, not 110%. The 110% rule appears only in AI unmortgage logic, not in core rules.

---

## 9. Chance & Community Chest Cards

Cards are chosen **at random** from the deck. Each card has:

- `type`: `credit_and_move`, `debit_and_move`, `move`, `credit`, `debit`, or special
- `amount`: fixed amount (if used)
- `position`: target space (if move)
- `extra`: JSON with optional rules

### Card types

| Type | Effect |
|------|--------|
| `credit_and_move` | Add `amount` to balance, move to `position`, collect $200 if passing Go |
| `debit_and_move` | Subtract `amount` from balance, move to `position` |
| `move` | Move to `position` (relative if negative, e.g. -3 = go back 3) |
| `credit` | Add `amount` to balance |
| `debit` | Subtract `amount` from balance |

### Special rules (`extra.rule`)

| Rule | Effect |
|------|--------|
| `nearest_utility` | Move to nearest utility (12 or 28). If passed Go, collect $200. Utility rent not applied in same turn. |
| `nearest_railroad` | Move to nearest railroad. If passed Go, collect $200. |
| `get_out_of_jail_free` | Add one Get Out of Jail Free card for this deck |
| `go_to_jail` | Move to 10 (Visiting Jail), set `in_jail = true`, `in_jail_rolls = 0`, `position = 10`. No $200. |
| `per_player` | Pay `amount × (number of other players)` to the bank; each other player receives `amount` |

### Position in `move` cards

- Absolute: `position >= 0` (e.g. 0, 5, 11, 24, 39).
- Relative: `position < 0` (e.g. -3) →  
  `new_position = (current_position + position + 40) % 40`

### Repair cards (per house/hotel)

Cards like “Make general repairs” and “Street repairs” use `extra.per_house` and `extra.per_hotel`. The current backend does not compute or apply these; they are stored but the per-building logic is not wired in.

---

## 10. Jail

### How you get to jail

1. **Land on Go to Jail (30):** Moved to position 10, `in_jail = true`, `in_jail_rolls = 0`.
2. **Draw Go to Jail card:** Same result.

### Leaving jail

You can leave when **any** of these is true:

1. **Third roll in jail:** `in_jail_rolls >= 2` (you’ve already rolled twice in jail).
2. **Double:** `die1 === die2`.
3. **Roll 12:** Total equals 12.

If you leave, you move by the dice total from position 10. If you pass Go, you collect $200.

### While in jail

- You still roll each turn (from position 10).
- `in_jail_rolls` increases each failed attempt.
- You **cannot** build, mortgage, unmortgage, or sell buildings from jail.
- Get Out of Jail Free can be used (handled by frontend; backend does not apply it automatically).

---

## 11. Bankruptcy & Winning

### Bankruptcy

- When a player **cannot pay** a debt (rent, tax, card, etc.):
  1. Try to raise funds (sell buildings, mortgage, trade).
  2. If still insufficient, **declare bankruptcy**.
- On bankruptcy: player is removed. Their properties return to the bank (`player_id = null`, `mortgaged = false`, `development = 0`).

### Win condition (last player standing)

- When only **one** player remains, the game ends.
- That player wins and the game status becomes `FINISHED`.

### Win condition (AI / time-based)

- In AI games, when time runs out, the winner is determined by **net worth** (see §14).
- The human player is removed after **3 consecutive** 90-second timeouts; the AI wins.

---

## 12. Turn Timer & Timeouts

### 90-second roll timer

- Each turn starts a **90-second** countdown.
- The current player must **roll** within 90 seconds.
- After rolling, the remaining time is for finishing the turn (buy, build, end turn).
- Timer resets when the turn passes to the next player.

### Multiplayer timeouts

- If the current player does not roll in time, a **timeout** is recorded.
- `consecutive_timeouts` increases by 1; it resets to 0 when the turn ends normally.
- After a timeout, other players can **vote to remove** that player.
- **Vote rules:**
  - 2 players: need 1 vote (the other player).
  - 3+ players: need votes from all other players.
- If the target has **3 consecutive timeouts**, they can be removed without voting (legacy path).

### AI games

- 3 consecutive 90s timeouts by the human → human is removed, AI wins.

---

## 13. AI Buy Score Calculation

When the AI considers buying a property, it computes a **buy score** (0–98):

**Base:** `score = 50`

### Cash

| Condition | Adjustment |
|-----------|------------|
| `cash < price × 1.3` | -70 |
| `cash > price × 3` | +20 |
| `cash > price × 2` | +10 |

### Monopoly potential (colored groups)

| Owned in group | Adjustment |
|----------------|------------|
| All but one | +90 |
| At least one | +35 |

(Excludes railroads and utilities.)

### Railroads

- +28 per railroad already owned.

### Utilities

- +35 per utility already owned.

### Landing rank

- Rank 1–30 by how often the space is landed on (from `MONOPOLY_STATS.landingRank`).
- `score += (30 - rank)`.

### Return on investment (ROI)

- `roi = rent_site_only / price`
- `roi > 0.12` → +25
- `roi > 0.08` → +12

### Opponent blocking

- If an opponent owns part of the group and group size ≤ 3: +30.

**Final:** `score = clamp(score, 5, 98)`.

### Build priority (for monopolies)

Order of preference when building:

```
orange > red > yellow > pink > lightblue > green > brown > darkblue
```

---

## 14. Net Worth & Time-Based Victory

### Net worth formula

```
net_worth = cash
          + property_value
          + building_value
          + one_turn_rent_potential
```

### Property value

- Not mortgaged: `property.price`
- Mortgaged: `floor(price / 2)`

### Building value

- Resale value of houses/hotels (half of build cost):
  - `building_value = development × cost_of_house / 2`
- Development 5 (hotel) counts as 5 “buildings” for this.

### One-turn rent potential

- For each owned property (not mortgaged), add the rent that would be charged if an opponent landed on it:
  - Standard: rent from development level.
  - Railroad: from number of railroads owned.
  - Utility: `7 × multiplier` (7 = average dice roll).

### Valid win

- In AI games, a win by net worth is valid only if the winner has completed **≥ 20 turns** (`turn_count >= 20`).

---

## 15. Trading

### Trade structure

- **Offer:** cash and/or property IDs.
- **Request:** cash and/or property IDs.

### Favorability (for AI)

**For human:**  
`ratio = (offer_value - request_value) / request_value × 100`  
Clamped to -100..100.

**For AI:**  
Same ratio, but from AI’s perspective (what AI gets vs gives).  
`ai_favorability = (ai_gets - ai_gives) / ai_gives × 100`.

### Property values in trades

- Properties valued at their `price` from the master property list.

---

## Summary of Key Formulas

| Calculation | Formula |
|-------------|---------|
| Rent (standard) | `rent = property.rent_[level]` (level 0–5) |
| Rent (railroad) | $25 / $50 / $100 / $200 for 1–4 railroads |
| Rent (utility) | `diceTotal × (4 or 10)` for 1–2 utilities |
| Mortgage receive | `price / 2` |
| Unmortgage cost | `price` |
| Build cost | `cost_of_house` per house |
| Sell building refund | `cost_of_house / 2` |
| Pass Go | +$200 |
| Tax spaces | `property.price` (e.g. $100) |
| Net worth | cash + property value + building value + rent potential |

---

*This document reflects the implementation as of the codebase snapshot. For exact behavior, refer to `backend/controllers/gamePlayerController.js`, `backend/controllers/gamePropertyController.js`, `frontend/utils/gameUtils.ts`, and `frontend/utils/monopolyUtils.ts`.*
