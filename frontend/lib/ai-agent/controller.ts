// lib/ai-agent/controller.ts
import { AIWalletManager } from './wallet-manager';
import { MonopolyAIDecisionEngine } from './decision-engine';
import { apiClient } from '@/lib/api';
import { pickMonopolyDevelopmentTarget } from '@/lib/pickMonopolyDevelopmentTarget';

export class MonopolyAIController {
  private walletManager: AIWalletManager;
  private decisionEngine: MonopolyAIDecisionEngine;

  constructor() {
    this.walletManager = new AIWalletManager();
    this.decisionEngine = new MonopolyAIDecisionEngine();
  }

  async handleAITurn(gameId: number, aiPlayer: any): Promise<void> {
    console.log(`🤖 AI ${aiPlayer.username} is thinking...`);

    // 1. Strategic phase (before rolling)
    await this.executeStrategy(gameId, aiPlayer);

    // 2. Roll dice (your existing backend logic)
    const diceRoll = await this.rollDice(gameId, aiPlayer);

    // 3. Handle landing (property purchase, rent, etc.)
    await this.handleLanding(gameId, aiPlayer, diceRoll.newPosition);

    // 4. Building phase (if applicable)
    await this.considerBuilding(gameId, aiPlayer);

    // 5. End turn
    await this.endTurn(gameId, aiPlayer);
  }

  private async executeStrategy(gameId: number, aiPlayer: any) {
    const gameState = await this.getGameState(gameId);
    if (!gameState?.players) return;

    const pendingTrades = (gameState.trades ?? []).filter(
      (t: any) => t.target_player_id === aiPlayer.user_id && t.status === 'pending'
    );

    for (const trade of pendingTrades) {
      const decision = await this.decisionEngine.evaluateTrade(trade, {
        myBalance: aiPlayer.balance,
        myPosition: aiPlayer.position ?? 0,
        myProperties: this.getPlayerProperties(gameState, aiPlayer),
        opponents: (gameState.players ?? []).filter((p: any) => p.user_id !== aiPlayer.user_id),
        gameState,
      });

      if (decision.action === 'accept') {
        await apiClient.post('/game-trade-requests/accept', { id: trade.id });
        console.log(`✅ AI accepted trade: ${decision.reasoning}`);
      } else {
        await apiClient.post('/game-trade-requests/decline', { id: trade.id });
        console.log(`❌ AI declined trade: ${decision.reasoning}`);
      }
    }

    // AI proposes trades
    await this.proposeStrategicTrades(gameId, aiPlayer, gameState);
  }

  private async handleLanding(gameId: number, aiPlayer: any, position: number) {
    const gameState = await this.getGameState(gameId);
    if (!gameState?.properties) return;

    const property = (gameState.properties as any[]).find((p: any) => p.id === position || (p.position !== undefined && p.position === position));

    if (!property || (property.type && property.type !== 'property')) return;

    const gameProps = gameState.game_properties ?? [];
    const isOwned = gameProps.some((gp: any) => gp.property_id === position);
    if (isOwned) return;

    // Ask Claude whether to buy
    const decision = await this.decisionEngine.makePropertyDecision({
      myBalance: aiPlayer.balance,
      myPosition: position,
      myProperties: this.getPlayerProperties(gameState, aiPlayer),
      opponents: (gameState.players ?? []).filter((p: any) => p.user_id !== aiPlayer.user_id),
      landedProperty: {
        ...property,
        completesMonopoly: this.wouldCompleteMonopoly(gameState, aiPlayer, property),
        landingRank: this.getLandingRank(property.id),
      },
      gameState,
    });

    const price = property.price ?? 0;
    const balanceAfter = (aiPlayer.balance ?? 0) - price;
    const completesMonopoly = this.wouldCompleteMonopoly(gameState, aiPlayer, property);
    const reserveOk = balanceAfter >= 500;
    const canBuy = aiPlayer.balance >= price && (reserveOk || completesMonopoly);
    if (decision.action === 'buy' && canBuy) {
      const order = aiPlayer.turn_order ?? aiPlayer.order;
      if (order != null) this.walletManager.getWallet(order);

      await apiClient.post('/game-properties/buy', {
        user_id: aiPlayer.user_id,
        game_id: gameId,
        property_id: property.id,
      });

      console.log(`💰 AI bought ${property.name}: ${decision.reasoning}`);
    } else {
      console.log(`🚫 AI skipped ${property.name}: ${decision.reasoning}`);
    }
  }

  private async considerBuilding(gameId: number, aiPlayer: any) {
    const gameState = await this.getGameState(gameId);
    if (!gameState?.players) return;

    const decision = await this.decisionEngine.decideBuildingStrategy({
      myBalance: aiPlayer.balance,
      myPosition: aiPlayer.position,
      myProperties: this.getPlayerProperties(gameState, aiPlayer),
      opponents: (gameState.players ?? []).filter((p: any) => p.user_id !== aiPlayer.user_id),
      gameState,
    });

    if (decision.action === 'build' && decision.propertyId) {
      const gameStub = { settings: gameState?.settings };
      const properties = (gameState?.properties ?? []) as Array<{ id: number; type?: string; group_id: number; cost_of_house: number; name?: string }>;
      const game_properties = gameState?.game_properties ?? [];
      const resolved = pickMonopolyDevelopmentTarget({
        game: gameStub,
        properties,
        game_properties,
        player: aiPlayer,
        preferredPropertyId: decision.propertyId,
      });
      if (resolved == null) return;

      await apiClient.post('/game-properties/development', {
        game_id: gameId,
        user_id: aiPlayer.user_id,
        property_id: resolved,
      });

      console.log(`🏠 AI built on property ${resolved}: ${decision.reasoning}`);
    }
  }

  // Helper methods...
  private async getGameState(gameId: number) {
    const res = await apiClient.get<{ data?: any }>(`/games/${gameId}`);
    const raw = res?.data?.data ?? res?.data ?? null;
    return raw as { players?: any[]; trades?: any[]; properties?: any[]; game_properties?: any[]; [key: string]: any } | null;
  }

  private getPlayerProperties(gameState: any, player: any) {
    const gameProps = gameState?.game_properties ?? [];
    return gameProps
      .filter((gp: any) => gp.address?.toLowerCase() === player?.address?.toLowerCase())
      .map((gp: any) => ({
        ...gp,
        ...(gameState?.properties ?? []).find((p: any) => p.id === gp.property_id),
      }));
  }

  private wouldCompleteMonopoly(gameState: any, player: any, property: any): boolean {
    // Your monopoly completion logic
    return false;
  }

  private getLandingRank(propertyId: number): number {
    const LANDING_RANKS: Record<number, number> = {
      5: 1, 6: 2, 7: 3, 16: 9, 18: 10, 19: 11, 21: 12, 23: 13, 24: 14,
      // ... your full ranking
    };
    return LANDING_RANKS[propertyId] || 99;
  }

  private async rollDice(gameId: number, aiPlayer: any) {
    const BOARD_SQUARES = 40;
    const rollOnce = (): { die1: number; die2: number; total: number } => {
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      return { die1, die2, total: die1 + die2 };
    };
    let value = rollOnce();
    while (value.total === 12) value = rollOnce();

    const gameState = await this.getGameState(gameId);
    const currentPos = aiPlayer.position ?? 0;
    const newPosition = (currentPos + value.total) % BOARD_SQUARES;

    await apiClient.post('/game-players/change-position', {
      user_id: aiPlayer.user_id,
      game_id: gameId,
      position: newPosition,
      rolled: value.total,
      is_double: value.die1 === value.die2,
    });

    return { die1: value.die1, die2: value.die2, total: value.total, newPosition };
  }

  private async endTurn(gameId: number, aiPlayer: any) {
    await apiClient.post('/game-players/end-turn', {
      user_id: aiPlayer.user_id,
      game_id: gameId,
    });
  }

  private async proposeStrategicTrades(gameId: number, aiPlayer: any, gameState: any) {
    const myProperties = this.getPlayerProperties(gameState, aiPlayer);
    const opponents = (gameState.players ?? []).filter((p: any) => p.user_id !== aiPlayer.user_id);
    if (opponents.length === 0) return;

    const proposals = await this.decisionEngine.suggestProposedTrades({
      myBalance: aiPlayer.balance ?? 0,
      myPosition: aiPlayer.position ?? 0,
      myProperties,
      opponents,
      gameState,
      aiPlayer,
      gameId,
    });

    for (const p of proposals) {
      if (!p?.target_player_id || !Array.isArray(p.offer_properties) || !Array.isArray(p.requested_properties)) continue;
      const offerProps = p.offer_properties.filter((id: number) =>
        myProperties.some((mp: any) => (mp.id ?? mp.property_id) === id)
      );
      const target = opponents.find((o: any) => o.user_id === p.target_player_id);
      if (!target) continue;

      try {
        await apiClient.post('/game-trade-requests', {
          game_id: gameId,
          player_id: aiPlayer.user_id,
          target_player_id: p.target_player_id,
          offer_properties: offerProps,
          offer_amount: p.offer_amount ?? 0,
          requested_properties: p.requested_properties,
          requested_amount: p.requested_amount ?? 0,
          status: 'pending',
        });
        console.log(`🤖 AI proposed trade to ${target.username}: ${p.reasoning ?? 'strategic'}`);
      } catch (err) {
        console.warn('AI trade proposal failed:', err);
      }
    }
  }
}