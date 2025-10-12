import { useCallback } from "react";
import { Account, AccountInterface, BigNumberish } from "starknet";
import { useDojoSDK } from "@dojoengine/sdk/react";

export function useTradeActions() {
  const { client } = useDojoSDK();

  const offerTrade = useCallback((account: Account | AccountInterface, gameId: BigNumberish, to: string, offeredProperties: BigNumberish[], requestedProperties: BigNumberish[], cash_offer: BigNumberish, cash_request: BigNumberish, trade_type: BigNumberish) => {
    return client.trade.offerTrade(account, gameId, to, offeredProperties, requestedProperties, cash_offer, cash_request, trade_type);
  }, [client]);

  const acceptTrade = useCallback((account: Account | AccountInterface, tradeId: BigNumberish, gameId: BigNumberish) => {
    return client.trade.acceptTrade(account, tradeId, gameId);
  }, [client]);

  const rejectTrade = useCallback((account: Account | AccountInterface, tradeId: BigNumberish, gameId: BigNumberish) => {
    return client.trade.rejectTrade(account, tradeId, gameId);
  }, [client]);

  const getTrade = useCallback((tradeId: BigNumberish) => {
    return client.trade.getTrade(tradeId);
  }, [client]);

  const counterTrade = useCallback((account: Account | AccountInterface, gameId: BigNumberish, originalOfferId: BigNumberish, offeredProperties: BigNumberish[], requestedProperties: BigNumberish[], cash_offer: BigNumberish, cash_request: BigNumberish, trade_type: BigNumberish) => {
    return client.trade.counterTrade(account, gameId, originalOfferId, offeredProperties, requestedProperties, cash_offer, cash_request, trade_type);
  }, [client]);

  const approveCounterTrade = useCallback((account: Account | AccountInterface, tradeId: BigNumberish) => {
    return client.trade.approveCounterTrade(account, tradeId);
  }, [client]);

  return {
    offerTrade,
    acceptTrade,
    rejectTrade,
    getTrade,
    counterTrade,
    approveCounterTrade,
  };
}
