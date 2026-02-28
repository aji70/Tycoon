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
| Post-game on-chain claim (Claim & go home, ERC-8004 feedback) | ✅ | ✅ |
| AI tips (toggle + tip when on buy prompt) | ✅ | ✅ |
| Trade alert pill (incoming count + view trades) | ✅ | ✅ |
| Perks / collectibles (Sparkles modal + CollectibleInventoryBar) | ✅ | ✅ |
| Bankruptcy: contract endGame when on-chain AI game | ✅ | ✅ |
| Double-submit guards (buy, jail actions) | ✅ | ✅ |

---

## Optional / design differences

- **Property transfer:** 2D has `handlePropertyTransfer` in ai-board (e.g. for transfer-to-creditor flows); it is **not** exposed in the property modal. 3D has no transfer in the property modal either, so parity is the same unless 2D uses transfer elsewhere (e.g. bankruptcy) and 3D should mirror that.
- **Exit prompt flow:** 2D can show an “exit prompt” and separate “Claim & go home” vs “Go home”. 3D only has “Go home” in the winner modal. This is tied to (1) post-game claim.

---

## Summary

- **Core game flow** and the former parity gaps are now implemented on the 3D board: post-game claim + ERC-8004, AI tips, trade alert pill, perks/collectibles modal, contract bankruptcy, and double-submit guards. The 3D AI board is in feature parity with the 2D AI board for the items in this checklist.
