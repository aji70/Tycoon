import { useCallback } from "react";
import { Account, AccountInterface, BigNumberish } from "starknet";
import { useDojoSDK } from "@dojoengine/sdk/react";

export function useGameActions() {
  const { client } = useDojoSDK();

  const createGame = useCallback((account: Account | AccountInterface, gameType: BigNumberish, playerSymbol: BigNumberish, numPlayers: BigNumberish) => {
    return client.game.createGame(account, gameType, playerSymbol, numPlayers);
  }, [client]);

  const joinGame = useCallback((account: Account | AccountInterface, playerSymbol: BigNumberish, gameId: BigNumberish) => {
    return client.game.joinGame(account, playerSymbol, gameId);
  }, [client]);

  const startGame = useCallback((account: Account | AccountInterface, gameId: BigNumberish) => {
    return client.game.startGame(account, gameId);
  }, [client]);

  const endGame = useCallback((account: Account | AccountInterface, gameId: BigNumberish) => {
    return client.game.endGame(account, gameId);
  }, [client]);

    const leaveGame = useCallback((account: Account | AccountInterface, gameId: BigNumberish) => {
    return client.game.leaveGame(account, gameId);
  }, [client]);

  const getGame = useCallback((gameId: BigNumberish) => {
    return client.game.retrieveGame(gameId);
  }, [client]);

  const mint = useCallback((account: Account | AccountInterface, address: string, gameId: BigNumberish, amount: BigNumberish) => {
    return client.game.mint(account, address, gameId, amount);
  }, [client]);

  const getPlayer = useCallback((address: string, gameId: BigNumberish) => {
    return client.game.getGamePlayer(address, gameId);
  }, [client]);

  const getGamePlayerBalance = useCallback((address: string, gameId: BigNumberish) => {
    return client.game.getGamePlayerBalance(address, gameId);
  }, [client]);

  const lastGame = useCallback(() => {
    return client.game.lastGame();
  }, [client]);

  return {
    createGame,
    joinGame,
    startGame,
    endGame,
    getGame,
    mint,
    getPlayer,
    getGamePlayerBalance,
    leaveGame,
    lastGame,
  };
}
