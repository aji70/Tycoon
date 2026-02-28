# 3D vs 2D AI Board — Parity Checklist

Comparison of the **3D board** (`app/(room)/board-3d/page.tsx`) with the **2D AI board** (`components/game/ai-board/ai-board.tsx`) to identify missing or different behavior.

---

## ✅ Already in parity (3D has it)

| Feature | 2D | 3D |
|--------|----|----|
| Roll dice, change-position, movement animation | ✅ | ✅ |
| Buy / Skip on landing | ✅ | ✅ |
| Chance/Community Chest card modal + final position from API | ✅ | ✅ |
| Jail: Pay $50, Use card, Stay, Roll for doubles | ✅ | ✅ |
| End turn (manual + auto after delay) | ✅ | ✅ |
| AI turn: strategy (trades, building), then roll, buy decision | ✅ | ✅ |
| Timed game + GameDurationCountdown + finish-by-time | ✅ | ✅ |
| End game by net worth (untimed): button + vote + confirm modal | ✅ | ✅ |
| Winner / Time's up modal (YOU WIN vs loser message) | ✅ | ✅ |
| Bankruptcy modal + declare bankruptcy | ✅ | ✅ |
| Card modal (Chance/Community Chest) | ✅ | ✅ |
| Property detail modal (build, sell, mortgage, sell to bank) | ✅ PropertyActionModal | ✅ PropertyDetailModal3D |
| Trades: propose, accept/decline, cancel all, decline all | ✅ | ✅ (TradeSection3D, PlayerSection3D) |
| Game refetch / polling | ✅ 8s interval | ✅ 5s refetchInterval |
| Roll result display (die1 + die2 = total) | ✅ | ✅ |
| AI “thinking” indicator | ✅ (center area) | ✅ (center above dice) |

---

## ❌ Gaps (on 2D but not on 3D)

### 1. **Post-game on-chain claim (wallet / ERC-8004)**

- **2D:** After time’s up or game end, winner modal has **“Claim & go home”** which:
  - Calls `endGame()` from `useEndAIGameAndClaim` (on-chain claim).
  - Calls `onFinishGameByTime` (backend sync).
  - Optionally calls `POST /games/:id/erc8004-feedback`.
  - Shows “Prize claimed!” / “Consolation collected” and can then go home.
- **3D:** Winner modal only has a **“Go home”** link. No wallet/contract claim, no ERC-8004 feedback.
- **Impact:** If 3D games are meant to be the same AI/on-chain games, players on 3D cannot claim rewards from the wallet flow.

---

### 2. **AI tips (buy suggestion when landed)**

- **2D:** 
  - Toggle “AI tips” (persisted in `localStorage`).
  - When it’s your turn, you’re on a buy prompt and have a `justLandedProperty`, a `useEffect` calls `POST /agent-registry/decision` with `decisionType: "tip"` and shows the tip in the center area.
- **3D:** No AI tips toggle, no tip request, no tip UI.
- **Impact:** 3D does not show the same “should I buy?” AI suggestion when landing on a property.

---

### 3. **Trade alert pill (incoming trades)**

- **2D:** `TradeAlertPill` fixed top-right: shows count of **incoming** trades and “View trades” (e.g. scroll/focus to trades in sidebar).
- **3D:** Trades live in the sidebar (TradeSection3D) but there is no floating pill when there are new incoming trades.
- **Impact:** Easier to miss incoming trades on 3D.

---

### 4. **Perks / collectibles (special landings)**

- **2D:** 
  - **Sparkles** button opens “My Perks” modal.
  - Modal contains `CollectibleInventoryBar` (game, game_properties, ROLL_DICE, END_TURN, `triggerLandingLogic`, `endTurnAfterSpecialMove`).
  - Supports special landings (e.g. perks that affect the next roll or turn).
- **3D:** No perks button, no collectibles bar, no special-landing hooks.
- **Impact:** Any gameplay that depends on collectibles/perks is 2D-only.

---

### 5. **Bankruptcy: on-chain end game**

- **2D:** `handleDeclareBankruptcy` calls `endGame()` from contract hooks, then shows `BankruptcyModal`.
- **3D:** `handleDeclareBankruptcy` only calls `PUT /games/:id` with `status: "FINISHED"` and `winner_id: opponent`, then shows `BankruptcyModal`. No contract `endGame()`.
- **Impact:** If AI games are on-chain, 3D bankruptcy may not update chain state (e.g. no claim/consolation from contract).

---

### 6. **Double-submit guards (buy / jail / finish)**

- **2D:** Uses `usePreventDoubleSubmit` for buy (`buyGuard`), jail actions (`jailGuard`), and finish-by-time (`finishByTimeGuard`). Buttons show “…” or “Claiming…” and are disabled while submitting.
- **3D:** No equivalent guards; buy and jail buttons can potentially be double-clicked.
- **Impact:** Slight risk of double API calls on 3D (buy, pay jail, use card, stay in jail).

---

## Optional / design differences

- **Property transfer:** 2D has `handlePropertyTransfer` in ai-board (e.g. for transfer-to-creditor flows); it is **not** exposed in the property modal. 3D has no transfer in the property modal either, so parity is the same unless 2D uses transfer elsewhere (e.g. bankruptcy) and 3D should mirror that.
- **Exit prompt flow:** 2D can show an “exit prompt” and separate “Claim & go home” vs “Go home”. 3D only has “Go home” in the winner modal. This is tied to (1) post-game claim.

---

## Summary

- **Core game flow** (roll, move, buy/skip, jail, cards, turn end, AI strategy, timed/untimed end, trades, property modal, bankruptcy modal) is in parity.
- **Missing on 3D:**  
  - Post-game **on-chain claim** and ERC-8004.  
  - **AI tips** (toggle + tip when on buy prompt).  
  - **Trade alert pill** for incoming trades.  
  - **Perks / collectibles** (Sparkles modal + special landings).  
  - **Contract** usage for bankruptcy (endGame).  
  - **Double-submit guards** for buy/jail/finish.

If you want to bring 3D to full parity, the next logical steps are: (1) post-game claim + ERC-8004 when applicable, (2) AI tips, (3) trade alert pill, (4) double-submit guards, then (5) perks/collectibles and (6) contract bankruptcy if 3D games are on-chain.
