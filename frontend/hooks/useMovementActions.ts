import { useCallback } from "react";
import { Account, AccountInterface, BigNumberish } from "starknet";
import { useDojoSDK } from "@dojoengine/sdk/react";
import { byteArray } from 'starknet';

export function useMovementActions() {
  const { client } = useDojoSDK();

  console.log(client);

  const movePlayer = useCallback((account: Account | AccountInterface, gameId: BigNumberish, steps: BigNumberish) => {
    return client.movement.movePlayer(account, gameId, steps);
  }, [client]);

  const payJailFine = useCallback((account: Account | AccountInterface, gameId: BigNumberish) => {
    return client.movement.payJailFine(account, gameId);
  }, [client]);

  const payGetoutOfJailChance = useCallback((account: Account | AccountInterface, gameId: BigNumberish) => {
    return client.movement.payGetoutOfJailChance(account, gameId);
  }, [client]);

  const payGetoutOfJailCommunity = useCallback((account: Account | AccountInterface, gameId: BigNumberish) => {
    return client.movement.payGetoutOfJailCommunity(account, gameId);
  }, [client]);

  const getCurrentPlayer = useCallback((gameId: BigNumberish) => {
    return client.movement.currentPlayer(gameId);
  }, [client]);

  const getCurrentPlayerName = useCallback((gameId: BigNumberish) => {
    return client.movement.currentPlayername(gameId);
  }, [client]);

  const processCommunityChestCard = useCallback((account: Account | AccountInterface, gameId: BigNumberish, card: any) => {
    return client.movement.processCommunityChestCard(account, gameId, card);
  }, [client]);

  const processChanceCard = useCallback((account: Account | AccountInterface, gameId: BigNumberish, card: any) => {
    return client.movement.processChanceCard(account, gameId, card);
  }, [client]);
  
   const payTax = useCallback((account: Account | AccountInterface, taxId: BigNumberish, gameId: BigNumberish) => {
    return client.movement.payTax(account, taxId, gameId);
  }, [client]);
  

  return {
    movePlayer,
    payJailFine,
    payGetoutOfJailChance,
    payGetoutOfJailCommunity,
    getCurrentPlayer,
    getCurrentPlayerName,
    processCommunityChestCard,
    processChanceCard,
    payTax
  };
}
