import { useCallback } from "react";
import { Account, AccountInterface, BigNumberish } from "starknet";
import { useDojoSDK } from "@dojoengine/sdk/react";

export function useSessionActions() {
  const { client } = useDojoSDK();

  const createSessionKey = useCallback((
    account: Account | AccountInterface,
    duration: BigNumberish,
    maxTransactions: BigNumberish,
    sessionType: BigNumberish
  ) => {
    return client.session.createSessionKey(account, duration, maxTransactions, sessionType);
  }, [client]);

  const validateSession = useCallback((
    account: Account | AccountInterface,
    sessionId: string
  ) => {
    return client.session.validateSession(account, sessionId);
  }, [client]);

  const renewSession = useCallback((
    account: Account | AccountInterface,
    sessionId: string,
    newDuration: BigNumberish,
    newMaxTx: BigNumberish
  ) => {
    return client.session.renewSession(account, sessionId, newDuration, newMaxTx);
  }, [client]);

  const revokeSession = useCallback((
    account: Account | AccountInterface,
    sessionId: string
  ) => {
    return client.session.revokeSession(account, sessionId);
  }, [client]);

  const getSessionInfo = useCallback((
    sessionId: string
  ) => {
    return client.session.getSessionInfo(sessionId);
  }, [client]);

  const calculateSessionTimeRemaining = useCallback((
    sessionId: string
  ) => {
    return client.session.calculateSessionTimeRemaining(sessionId);
  }, [client]);

  const checkSessionNeedsRenewal = useCallback((
    sessionId: string
  ) => {
    return client.session.checkSessionNeedsRenewal(sessionId);
  }, [client]);

  const calculateRemainingTransactions = useCallback((
    sessionId: string
  ) => {
    return client.session.calculateRemainingTransactions(sessionId);
  }, [client]);

  return {
    createSessionKey,
    validateSession,
    renewSession,
    revokeSession,
    getSessionInfo,
    calculateSessionTimeRemaining,
    checkSessionNeedsRenewal,
    calculateRemainingTransactions
  };
}