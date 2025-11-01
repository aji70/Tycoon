import { useCallback } from "react";
import { Account, AccountInterface, BigNumberish } from "starknet";
import { useDojoSDK } from "@dojoengine/sdk/react";

export function usePropertyActions() {
  const { client } = useDojoSDK();

  const buyProperty = useCallback((account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
    return client.property.buyProperty(account, propertyId, gameId);
  }, [client]);

  const mortgageProperty = useCallback((account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
    return client.property.mortgageProperty(account, propertyId, gameId);
  }, [client]);

  const unmortgageProperty = useCallback((account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
    return client.property.unmortgageProperty(account, propertyId, gameId);
  }, [client]);

  const payRent = useCallback((account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
    return client.property.payRent(account, propertyId, gameId);
  }, [client]);

  const buyHouseOrHotel = useCallback((account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
    return client.property.buyHouseOrHotel(account, propertyId, gameId);
  }, [client]);

  const sellHouseOrHotel = useCallback((account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
    return client.property.sellHouseOrHotel(account, propertyId, gameId);
  }, [client]);

  const finishTurn = useCallback((account: Account | AccountInterface, gameId: BigNumberish) => {
    return client.property.finishTurn(account, gameId);
  }, [client]);

  const getProperty = useCallback((propertyId: BigNumberish, gameId: BigNumberish) => {
    return client.property.getProperty(propertyId, gameId);
  }, [client]);

  return {
    buyProperty,
    mortgageProperty,
    unmortgageProperty,
    payRent,
    buyHouseOrHotel,
    sellHouseOrHotel,
    finishTurn,
    getProperty,
  };
}
