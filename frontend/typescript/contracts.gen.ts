import { DojoProvider, DojoCall } from "@dojoengine/core";
import { Account, AccountInterface, BigNumberish, CairoOption, CairoCustomEnum } from "starknet";
import * as models from "./models.gen";

export function setupWorld(provider: DojoProvider) {

	const build_game_createGame_calldata = (gameType: BigNumberish, playerSymbol: BigNumberish, numberOfPlayers: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "create_game",
			calldata: [gameType, playerSymbol, numberOfPlayers],
		};
	};

	const game_createGame = async (snAccount: Account | AccountInterface, gameType: BigNumberish, playerSymbol: BigNumberish, numberOfPlayers: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_createGame_calldata(gameType, playerSymbol, numberOfPlayers),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_endGame_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "end_game",
			calldata: [gameId],
		};
	};

	const game_endGame = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_endGame_calldata(gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_getGamePlayer_calldata = (address: string, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "get_game_player",
			calldata: [address, gameId],
		};
	};

	const game_getGamePlayer = async (address: string, gameId: BigNumberish) => {
		try {
			return await provider.call("blockopoly", build_game_getGamePlayer_calldata(address, gameId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_getGamePlayerBalance_calldata = (address: string, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "get_game_player_balance",
			calldata: [address, gameId],
		};
	};

	const game_getGamePlayerBalance = async (address: string, gameId: BigNumberish) => {
		try {
			return await provider.call("blockopoly", build_game_getGamePlayerBalance_calldata(address, gameId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_getPlayerNetworth_calldata = (address: string, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "get_player_networth",
			calldata: [address, gameId],
		};
	};

	const game_getPlayerNetworth = async (snAccount: Account | AccountInterface, address: string, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_getPlayerNetworth_calldata(address, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_joinGame_calldata = (playerSymbol: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "join_game",
			calldata: [playerSymbol, gameId],
		};
	};

	const game_joinGame = async (snAccount: Account | AccountInterface, playerSymbol: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_joinGame_calldata(playerSymbol, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_lastGame_calldata = (): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "last_game",
			calldata: [],
		};
	};

	const game_lastGame = async () => {
		try {
			return await provider.call("blockopoly", build_game_lastGame_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_leaveGame_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "leave_game",
			calldata: [gameId],
		};
	};

	const game_leaveGame = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_leaveGame_calldata(gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_mint_calldata = (recepient: string, gameId: BigNumberish, amount: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "mint",
			calldata: [recepient, gameId, amount],
		};
	};

	const game_mint = async (snAccount: Account | AccountInterface, recepient: string, gameId: BigNumberish, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_mint_calldata(recepient, gameId, amount),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_retrieveGame_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "retrieve_game",
			calldata: [gameId],
		};
	};

	const game_retrieveGame = async (gameId: BigNumberish) => {
		try {
			return await provider.call("blockopoly", build_game_retrieveGame_calldata(gameId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_game_startGame_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "game",
			entrypoint: "start_game",
			calldata: [gameId],
		};
	};

	const game_startGame = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_game_startGame_calldata(gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_currentPlayer_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "current_player",
			calldata: [gameId],
		};
	};

	const movement_currentPlayer = async (gameId: BigNumberish) => {
		try {
			return await provider.call("blockopoly", build_movement_currentPlayer_calldata(gameId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_currentPlayername_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "current_playername",
			calldata: [gameId],
		};
	};

	const movement_currentPlayername = async (gameId: BigNumberish) => {
		try {
			return await provider.call("blockopoly", build_movement_currentPlayername_calldata(gameId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_movePlayer_calldata = (gameId: BigNumberish, steps: BigNumberish): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "move_player",
			calldata: [gameId, steps],
		};
	};

	const movement_movePlayer = async (snAccount: Account | AccountInterface, gameId: BigNumberish, steps: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_movement_movePlayer_calldata(gameId, steps),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_payJailFine_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "pay_jail_fine",
			calldata: [gameId],
		};
	};

	const movement_payJailFine = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_movement_payJailFine_calldata(gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_payTax_calldata = (taxId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "pay_tax",
			calldata: [taxId, gameId],
		};
	};

	const movement_payTax = async (snAccount: Account | AccountInterface, taxId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_movement_payTax_calldata(taxId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_processChanceCard_calldata = (gameId: BigNumberish, card: string): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "process_chance_card",
			calldata: [gameId, card],
		};
	};

	const movement_processChanceCard = async (snAccount: Account | AccountInterface, gameId: BigNumberish, card: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_movement_processChanceCard_calldata(gameId, card),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_processCommunityChestCard_calldata = (gameId: BigNumberish, card: string): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "process_community_chest_card",
			calldata: [gameId, card],
		};
	};

	const movement_processCommunityChestCard = async (snAccount: Account | AccountInterface, gameId: BigNumberish, card: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_movement_processCommunityChestCard_calldata(gameId, card),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_useGetoutOfJailChance_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "use_getout_of_jail_chance",
			calldata: [gameId],
		};
	};

	const movement_useGetoutOfJailChance = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_movement_useGetoutOfJailChance_calldata(gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_movement_useGetoutOfJailCommunityChest_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "movement",
			entrypoint: "use_getout_of_jail_community_chest",
			calldata: [gameId],
		};
	};

	const movement_useGetoutOfJailCommunityChest = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_movement_useGetoutOfJailCommunityChest_calldata(gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_player_getUsernameFromAddress_calldata = (address: string): DojoCall => {
		return {
			contractName: "player",
			entrypoint: "get_username_from_address",
			calldata: [address],
		};
	};

	const player_getUsernameFromAddress = async (address: string) => {
		try {
			return await provider.call("blockopoly", build_player_getUsernameFromAddress_calldata(address));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_player_isRegistered_calldata = (address: string): DojoCall => {
		return {
			contractName: "player",
			entrypoint: "is_registered",
			calldata: [address],
		};
	};

	const player_isRegistered = async (address: string) => {
		try {
			return await provider.call("blockopoly", build_player_isRegistered_calldata(address));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_player_registerNewPlayer_calldata = (username: BigNumberish): DojoCall => {
		return {
			contractName: "player",
			entrypoint: "register_new_player",
			calldata: [username],
		};
	};

	const player_registerNewPlayer = async (snAccount: Account | AccountInterface, username: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_player_registerNewPlayer_calldata(username),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_player_retrievePlayer_calldata = (addr: string): DojoCall => {
		return {
			contractName: "player",
			entrypoint: "retrieve_player",
			calldata: [addr],
		};
	};

	const player_retrievePlayer = async (addr: string) => {
		try {
			return await provider.call("blockopoly", build_player_retrievePlayer_calldata(addr));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_buyHouseOrHotel_calldata = (propertyId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "buy_house_or_hotel",
			calldata: [propertyId, gameId],
		};
	};

	const property_buyHouseOrHotel = async (snAccount: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_property_buyHouseOrHotel_calldata(propertyId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_buyProperty_calldata = (propertyId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "buy_property",
			calldata: [propertyId, gameId],
		};
	};

	const property_buyProperty = async (snAccount: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_property_buyProperty_calldata(propertyId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_finishTurn_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "finish_turn",
			calldata: [gameId],
		};
	};

	const property_finishTurn = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_property_finishTurn_calldata(gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_getProperty_calldata = (propertyId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "get_property",
			calldata: [propertyId, gameId],
		};
	};

	const property_getProperty = async (propertyId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.call("blockopoly", build_property_getProperty_calldata(propertyId, gameId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_mortgageProperty_calldata = (propertyId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "mortgage_property",
			calldata: [propertyId, gameId],
		};
	};

	const property_mortgageProperty = async (snAccount: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_property_mortgageProperty_calldata(propertyId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_payRent_calldata = (propertyId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "pay_rent",
			calldata: [propertyId, gameId],
		};
	};

	const property_payRent = async (snAccount: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_property_payRent_calldata(propertyId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_sellHouseOrHotel_calldata = (propertyId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "sell_house_or_hotel",
			calldata: [propertyId, gameId],
		};
	};

	const property_sellHouseOrHotel = async (snAccount: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_property_sellHouseOrHotel_calldata(propertyId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_property_unmortgageProperty_calldata = (propertyId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "property",
			entrypoint: "unmortgage_property",
			calldata: [propertyId, gameId],
		};
	};

	const property_unmortgageProperty = async (snAccount: Account | AccountInterface, propertyId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_property_unmortgageProperty_calldata(propertyId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_trade_acceptTrade_calldata = (tradeId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "trade",
			entrypoint: "accept_trade",
			calldata: [tradeId, gameId],
		};
	};

	const trade_acceptTrade = async (snAccount: Account | AccountInterface, tradeId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_trade_acceptTrade_calldata(tradeId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_trade_approveCounterTrade_calldata = (tradeId: BigNumberish): DojoCall => {
		return {
			contractName: "trade",
			entrypoint: "approve_counter_trade",
			calldata: [tradeId],
		};
	};

	const trade_approveCounterTrade = async (snAccount: Account | AccountInterface, tradeId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_trade_approveCounterTrade_calldata(tradeId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_trade_counterTrade_calldata = (gameId: BigNumberish, originalOfferId: BigNumberish, offeredPropertyIds: Array<BigNumberish>, requestedPropertyIds: Array<BigNumberish>, cashOffer: BigNumberish, cashRequest: BigNumberish, tradeType: BigNumberish): DojoCall => {
		return {
			contractName: "trade",
			entrypoint: "counter_trade",
			calldata: [gameId, originalOfferId, offeredPropertyIds, requestedPropertyIds, cashOffer, cashRequest, tradeType],
		};
	};

	const trade_counterTrade = async (snAccount: Account | AccountInterface, gameId: BigNumberish, originalOfferId: BigNumberish, offeredPropertyIds: Array<BigNumberish>, requestedPropertyIds: Array<BigNumberish>, cashOffer: BigNumberish, cashRequest: BigNumberish, tradeType: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_trade_counterTrade_calldata(gameId, originalOfferId, offeredPropertyIds, requestedPropertyIds, cashOffer, cashRequest, tradeType),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_trade_getTrade_calldata = (tradeId: BigNumberish): DojoCall => {
		return {
			contractName: "trade",
			entrypoint: "get_trade",
			calldata: [tradeId],
		};
	};

	const trade_getTrade = async (tradeId: BigNumberish) => {
		try {
			return await provider.call("blockopoly", build_trade_getTrade_calldata(tradeId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_trade_offerTrade_calldata = (gameId: BigNumberish, to: string, offeredPropertyIds: Array<BigNumberish>, requestedPropertyIds: Array<BigNumberish>, cashOffer: BigNumberish, cashRequest: BigNumberish, tradeType: BigNumberish): DojoCall => {
		return {
			contractName: "trade",
			entrypoint: "offer_trade",
			calldata: [gameId, to, offeredPropertyIds, requestedPropertyIds, cashOffer, cashRequest, tradeType],
		};
	};

	const trade_offerTrade = async (snAccount: Account | AccountInterface, gameId: BigNumberish, to: string, offeredPropertyIds: Array<BigNumberish>, requestedPropertyIds: Array<BigNumberish>, cashOffer: BigNumberish, cashRequest: BigNumberish, tradeType: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_trade_offerTrade_calldata(gameId, to, offeredPropertyIds, requestedPropertyIds, cashOffer, cashRequest, tradeType),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_trade_rejectTrade_calldata = (tradeId: BigNumberish, gameId: BigNumberish): DojoCall => {
		return {
			contractName: "trade",
			entrypoint: "reject_trade",
			calldata: [tradeId, gameId],
		};
	};

	const trade_rejectTrade = async (snAccount: Account | AccountInterface, tradeId: BigNumberish, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_trade_rejectTrade_calldata(tradeId, gameId),
				"blockopoly",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};



	return {
		game: {
			createGame: game_createGame,
			buildCreateGameCalldata: build_game_createGame_calldata,
			endGame: game_endGame,
			buildEndGameCalldata: build_game_endGame_calldata,
			getGamePlayer: game_getGamePlayer,
			buildGetGamePlayerCalldata: build_game_getGamePlayer_calldata,
			getGamePlayerBalance: game_getGamePlayerBalance,
			buildGetGamePlayerBalanceCalldata: build_game_getGamePlayerBalance_calldata,
			getPlayerNetworth: game_getPlayerNetworth,
			buildGetPlayerNetworthCalldata: build_game_getPlayerNetworth_calldata,
			joinGame: game_joinGame,
			buildJoinGameCalldata: build_game_joinGame_calldata,
			lastGame: game_lastGame,
			buildLastGameCalldata: build_game_lastGame_calldata,
			leaveGame: game_leaveGame,
			buildLeaveGameCalldata: build_game_leaveGame_calldata,
			mint: game_mint,
			buildMintCalldata: build_game_mint_calldata,
			retrieveGame: game_retrieveGame,
			buildRetrieveGameCalldata: build_game_retrieveGame_calldata,
			startGame: game_startGame,
			buildStartGameCalldata: build_game_startGame_calldata,
		},
		movement: {
			currentPlayer: movement_currentPlayer,
			buildCurrentPlayerCalldata: build_movement_currentPlayer_calldata,
			currentPlayername: movement_currentPlayername,
			buildCurrentPlayernameCalldata: build_movement_currentPlayername_calldata,
			movePlayer: movement_movePlayer,
			buildMovePlayerCalldata: build_movement_movePlayer_calldata,
			payJailFine: movement_payJailFine,
			buildPayJailFineCalldata: build_movement_payJailFine_calldata,
			payTax: movement_payTax,
			buildPayTaxCalldata: build_movement_payTax_calldata,
			processChanceCard: movement_processChanceCard,
			buildProcessChanceCardCalldata: build_movement_processChanceCard_calldata,
			processCommunityChestCard: movement_processCommunityChestCard,
			buildProcessCommunityChestCardCalldata: build_movement_processCommunityChestCard_calldata,
			useGetoutOfJailChance: movement_useGetoutOfJailChance,
			buildUseGetoutOfJailChanceCalldata: build_movement_useGetoutOfJailChance_calldata,
			useGetoutOfJailCommunityChest: movement_useGetoutOfJailCommunityChest,
			buildUseGetoutOfJailCommunityChestCalldata: build_movement_useGetoutOfJailCommunityChest_calldata,
		},
		player: {
			getUsernameFromAddress: player_getUsernameFromAddress,
			buildGetUsernameFromAddressCalldata: build_player_getUsernameFromAddress_calldata,
			isRegistered: player_isRegistered,
			buildIsRegisteredCalldata: build_player_isRegistered_calldata,
			registerNewPlayer: player_registerNewPlayer,
			buildRegisterNewPlayerCalldata: build_player_registerNewPlayer_calldata,
			retrievePlayer: player_retrievePlayer,
			buildRetrievePlayerCalldata: build_player_retrievePlayer_calldata,
		},
		property: {
			buyHouseOrHotel: property_buyHouseOrHotel,
			buildBuyHouseOrHotelCalldata: build_property_buyHouseOrHotel_calldata,
			buyProperty: property_buyProperty,
			buildBuyPropertyCalldata: build_property_buyProperty_calldata,
			finishTurn: property_finishTurn,
			buildFinishTurnCalldata: build_property_finishTurn_calldata,
			getProperty: property_getProperty,
			buildGetPropertyCalldata: build_property_getProperty_calldata,
			mortgageProperty: property_mortgageProperty,
			buildMortgagePropertyCalldata: build_property_mortgageProperty_calldata,
			payRent: property_payRent,
			buildPayRentCalldata: build_property_payRent_calldata,
			sellHouseOrHotel: property_sellHouseOrHotel,
			buildSellHouseOrHotelCalldata: build_property_sellHouseOrHotel_calldata,
			unmortgageProperty: property_unmortgageProperty,
			buildUnmortgagePropertyCalldata: build_property_unmortgageProperty_calldata,
		},
		trade: {
			acceptTrade: trade_acceptTrade,
			buildAcceptTradeCalldata: build_trade_acceptTrade_calldata,
			approveCounterTrade: trade_approveCounterTrade,
			buildApproveCounterTradeCalldata: build_trade_approveCounterTrade_calldata,
			counterTrade: trade_counterTrade,
			buildCounterTradeCalldata: build_trade_counterTrade_calldata,
			getTrade: trade_getTrade,
			buildGetTradeCalldata: build_trade_getTrade_calldata,
			offerTrade: trade_offerTrade,
			buildOfferTradeCalldata: build_trade_offerTrade_calldata,
			rejectTrade: trade_rejectTrade,
			buildRejectTradeCalldata: build_trade_rejectTrade_calldata,
		},
	};
}