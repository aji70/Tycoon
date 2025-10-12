import { useCallback } from "react";
import {
  Account,
  AccountInterface,
  BigNumberish,
  shortString,
  CairoCustomEnum,
} from "starknet";
import { stringToFelt } from "@/utils/starknet";
import { Player, Game } from "../typescript/models.gen";
// import { setupWorld } from "../../contract/bindings/typescript/contracts.gen";
import { setupWorld } from "../typescript/contracts.gen";
// import {Player, Game} from "../../contract/bindings/typescript/models.gen"
import { useDojoSDK } from "@dojoengine/sdk/react";
import { steps } from "framer-motion";

type ClientType = ReturnType<typeof setupWorld>;

interface UseMonopolyProps {
  client: ClientType;
  account: Account | AccountInterface;
}

export function usePlayer({ account }: UseMonopolyProps) {
const { client } = useDojoSDK();
console.log("client", client);


  const register = useCallback(
    (account: Account | AccountInterface, username: string) => {
      const usernameFelt = stringToFelt(username);
      return client.player.registerNewPlayer(account, username);
    },
    [account]
  );

  const isRegistered = useCallback(
    async (address: string) => {
      try {
        if (!client || !client.player) return alert("No client found");
        return await client.player.isRegistered(address);
      } catch (error) {
        console.error("Error checking registration:", error);
        throw error;
      }
    },
    [client]
  );

  const getUsernameFromAddress = useCallback(
    async (address: string) => {
      try {
        if (!client || !client.player) return alert("No client found");
        return await client.player.getUsernameFromAddress(address);
      } catch (error) {
        console.error("Error getting username from address:", error);
        throw error;  
        }
        },
    [client]
  );

  const retrievePlayer = useCallback(
    async (address: string) => {
      try {
        if (!client || !client.player) return alert("No client found");
        return await client.player.retrievePlayer(address);
      } catch (error) {
        console.error("Error retrieving player:", error);
        throw error;
      }
    },
    [client]
  );

  const movePlayer = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish, steps: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.movement.movePlayer(
          account,
          gameId,
          steps
        );
      } catch (error) {
        console.error("Error moving player:", error);
        throw error;
      }
    },
    [client, account]
  );

  const getPlayer = useCallback(
    async (address: string, gameId: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.game.getGamePlayer(address, gameId);
      } catch (error) {
        console.error("Error getting player:", error);
        throw error;
      }
    },
    [client]
  );

  const createGame = useCallback(
    async (account: Account | AccountInterface, gameType: BigNumberish, playerSymbol: BigNumberish, numPlayers: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        
        return await client.game.createGame(
          account,
          gameType,
          playerSymbol,
          numPlayers
        );
      } catch (error) {
        console.error("Error creating game:", error);
        throw error;
      }
    },
    [client, account]
  );

  const joinGame = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish, playerSymbol: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.game.joinGame(
          account,
          gameId,
          playerSymbol
        );
      } catch (error) {
        console.error("Error joining game:", error);
        throw error;
      }
    },
    [client, account]
  );

  const startGame = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.game.startGame(account, gameId);
      } catch (error) {
        console.error("Error starting game:", error);
        throw error;
      }
    },
    [client, account]
  );

  const endGame = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish) => {  
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.game.endGame(account, gameId);
      } catch (error) {
        console.error("Error ending game:", error);
        throw error;
      }
    },
    [client, account]
  );

  const getGame = useCallback(
    async (gameId: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.game.retrieveGame(gameId);
      } catch (error) {
        console.error("Error getting game:", error);
        throw error;
      }
    },
    [client]
  );

  const mint = useCallback(
    async (account: Account | AccountInterface,address: string, gameId: BigNumberish, amount: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.game.mint(
          account,
          address,
          gameId,
          amount
        
        );
      } catch (error) {
        console.error("Error minting player:", error);
        throw error;
      }
    },
    [client, account]
  );

  const getGamePlayerBalance = useCallback(
    async (address: string, gameId: BigNumberish) => {
      try {
        if (!client || !client.game) return alert("No client found");
        return await client.game.getGamePlayerBalance(address, gameId);
      } catch (error) {
        console.error("Error getting game player:", error);
        throw error;
      }
    },
    [client]
  );

  const payJailFine = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish) => {
      try {
        if (!client || !client.movement) return alert("No client found");
        return await client.movement.payJailFine(
          account,
          gameId
        );
      } catch (error) {
        console.error("Error paying jail fine:", error);
        throw error;
      }
    },
    [client, account]
  );

  const payGetoutOfJailChance = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish) => {
      try {
        if (!client || !client.movement) return alert("No client found");
        return await client.movement.payGetoutOfJailChance(
          account,
          gameId
        );
      } catch (error) {
        console.error("Error paying get out of jail chance:", error);
        throw error;
      }
    },
    [client, account]
  );

  const payGetoutOfJailCommunity = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish) => {
      try {
        if (!client || !client.movement) return alert("No client found");
        return await client.movement.payGetoutOfJailCommunity(
          account,
          gameId
        );  
      } catch (error) {
        console.error("Error paying get out of jail community:", error);
        throw error;
      }
    },
    [client, account]
  );

  const getCurrentPlayer = useCallback(
    async (gameId: BigNumberish) => {
      try {
        if (!client || !client.movement) return alert("No client found");
        return await client.movement.currentPlayer(gameId);
      } catch (error) {
        console.error("Error getting current player:", error);
        throw error;
      }
    },
    [client]
  );

  const getCurrentPlayerName = useCallback(
    async (gameId: BigNumberish) => {
      try {
        if (!client || !client.movement) return alert("No client found");
        const username = await client.movement.currentPlayername(gameId);        
        return username;
      } catch (error) {
        console.error("Error getting current player name:", error);
        throw error;
      }
    },
    [client]
  );

  const buyProperty = useCallback(
    async (account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found");
        return await client.property.buyProperty(
          account,
          propertyId,
          gameId
        );
      } catch (error) {
        console.error("Error buying property:", error);
        throw error;
      }
    },
    [client, account]
  );

  const mortgageProperty = useCallback(
    async (account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found");
        return await client.property.mortgageProperty(
          account,
          propertyId,
          gameId  
          );
      } catch (error) {
        console.error("Error mortgaging property:", error);
        throw error;
      }
    },
    [client, account]
  );

  const unmortgageProperty = useCallback(
    async (account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found");
        return await client.property.unmortgageProperty(
          account,
          propertyId,
          gameId
        );
      } catch (error) {
        console.error("Error unmortgaging property:", error);
        throw error;
      }
    },
    [client, account]
  );

  const payRent = useCallback(
    async (account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found");
        return await client.property.payRent(
          account,
          propertyId,
          gameId
        );
      } catch (error) {
        console.error("Error paying rent:", error);
        throw error;
      }
    },  
    [client, account]
  );

  const buyHouseOrHotel = useCallback(
    async (account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found");
        return await client.property.buyHouseOrHotel(
          account,
          propertyId,
          gameId,
        );
      } catch (error) {
        console.error("Error buying house or hotel:", error);
        throw error;
      }
    },
    [client, account]
  );

  const finishTurn = useCallback(
    async (account: Account | AccountInterface, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found");
        return await client.property.finishTurn(
          account,
          gameId
        );
      } catch (error) {
        console.error("Error finishing turn:", error);
        throw error;
      }
    },
    [client, account]
  );

  const sellHouseOrHotel = useCallback(
    async (account: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found"); 
        return await client.property.sellHouseOrHotel(
          account,
          propertyId,
          gameId,
        );
      } catch (error) {
        console.error("Error selling house or hotel:", error);
        throw error;
      }
    },
    [client, account]
  );

  const getProperty = useCallback(
    async (propertyId: BigNumberish, gameId: BigNumberish) => {
      try {
        if (!client || !client.property) return alert("No client found");
        return await client.property.getProperty(propertyId, gameId);
      } catch (error) {
        console.error("Error getting property:", error);
        throw error;
      }
    },
    [client]
  );

  const offerTrade = useCallback(
    async (
      account: Account | AccountInterface,
      gameId: BigNumberish,
      to: string,
      offeredProperties: BigNumberish[],
      requestedProperties: BigNumberish[],
      cash_offer: BigNumberish,
      cash_request: BigNumberish,
      trade_type: BigNumberish,
    ) => {
      try {
        if (!client || !client.trade) return alert("No client found");
        return await client.trade.offerTrade(
          account,
          gameId,
          to, 
          offeredProperties,
          requestedProperties,
          cash_offer,
          cash_request,
          trade_type
        );
      } catch (error) {
        console.error("Error offering trade:", error);
        throw error;
      }
    },
    [client, account] 
    );

  const acceptTrade = useCallback(
    async (
      account: Account | AccountInterface,
      tradeId: BigNumberish,
      gameId: BigNumberish,

    ) => {
      try {
        if (!client || !client.trade) return alert("No client found");
        return await client.trade.acceptTrade(
          account,
          tradeId,
          gameId,
        );
      } catch (error) {
        console.error("Error accepting trade:", error);
        throw error;
      }
    },
    [client, account]
  );

  const rejectTrade = useCallback(
    async (
      account: Account | AccountInterface,
      tradeId: BigNumberish,
      gameId: BigNumberish,
    ) => {
      try {
        if (!client || !client.trade) return alert("No client found");
        return await client.trade.rejectTrade(
          account,
          tradeId,
          gameId,
        );
      } catch (error) {
        console.error("Error rejecting trade:", error);
        throw error;
      }
    },
    [client, account]
  );

  const getTrade = useCallback(
    async (tradeId: BigNumberish) => {
      try {
        if (!client || !client.trade) return alert("No client found");
        return await client.trade.getTrade(tradeId);
      } catch (error) {
        console.error("Error getting trade:", error);
        throw error;
      }
    },
    [client]
  );

  const counterTrade = useCallback(
    async (
      account: Account | AccountInterface,
      gameId: BigNumberish,
      originalOfferId: BigNumberish,
      offeredProperties: BigNumberish[],
      requestedProperties: BigNumberish[],
      cash_offer: BigNumberish,
      cash_request: BigNumberish,
      trade_type: BigNumberish,
    ) => {
      try {
        if (!client || !client.trade) return alert("No client found");
        return await client.trade.counterTrade(
          account,
          gameId,
          originalOfferId,
          offeredProperties,
          requestedProperties,
          cash_offer,
          cash_request,
          trade_type
        );
      } catch (error) {
        console.error("Error countering trade:", error);
        throw error;
      }
    },
    [client, account]
  );

  const approveCounterTrade = useCallback(
    async (
      account: Account | AccountInterface,
      tradeId: BigNumberish,
      
    ) => {
      try {
        if (!client || !client.trade) return alert("No client found");
        return await client.trade.approveCounterTrade(
          account,
          tradeId,          
        );
      } catch (error) {
        console.error("Error approving counter trade:", error);
        throw error;
      }
    },
    [client, account]
  );

  return {
    register,
    isRegistered,
    getUsernameFromAddress,
    retrievePlayer,
    getPlayer,
    createGame,
    joinGame,
    startGame,
    endGame,
    getGame,
    movePlayer,
    mint,
    getGamePlayerBalance,
    payJailFine,
    payGetoutOfJailChance,
    payGetoutOfJailCommunity,
    getCurrentPlayer,
    getCurrentPlayerName,
    buyProperty,
    mortgageProperty,
    unmortgageProperty,
    payRent,
    buyHouseOrHotel,
    sellHouseOrHotel,
    finishTurn,
    getProperty,
    offerTrade,
    acceptTrade,
    rejectTrade,
    getTrade,
    counterTrade,
    approveCounterTrade,
  };
}
