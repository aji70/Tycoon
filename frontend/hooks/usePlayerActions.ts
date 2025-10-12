import { useCallback } from "react";
import { Account, AccountInterface } from "starknet";
import { useDojoSDK } from "@dojoengine/sdk/react";
import { stringToFelt } from "@/utils/starknet";

export function usePlayerActions() {
  const { client } = useDojoSDK();

  const register = useCallback((account: Account | AccountInterface, username: string) => {
    const usernameFelt = stringToFelt(username);
    return client.player.registerNewPlayer(account, usernameFelt);
  }, [client]);

  const isRegistered = useCallback(async (address: string) => {
    return await client.player.isRegistered(address);
  }, [client]);

  const getUsernameFromAddress = useCallback(async (address: string) => {
    return await client.player.getUsernameFromAddress(address);
  }, [client]);

  const retrievePlayer = useCallback(async (address: string) => {
    return await client.player.retrievePlayer(address);
  }, [client]);

  return { register, isRegistered, getUsernameFromAddress, retrievePlayer };
}
