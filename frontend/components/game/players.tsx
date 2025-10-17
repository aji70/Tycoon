"use client";
import React from "react";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";

interface GamePlayersProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}

export default function GamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: GamePlayersProps) {
  const { address } = useAccount();
  const isMortgaged = (property_id: number) => {
    const game_property = game_properties.find((gp) => gp.property_id == property_id);
    return game_property?.mortgaged;
  }
  const developmentStage = (property_id: number) => {
    const game_property = game_properties.find((gp) => gp.property_id == property_id);
    return game_property?.development ?? 0;
  }
  const rentPrice = (property_id: number) => {
    const property = properties.find((p) => p.id == property_id);
    const development = developmentStage(property_id);
    let rent = property?.rent_site_only;
    switch (development) {
      case 0:
        rent = property?.rent_site_only;
        break;
      case 1:
        rent = property?.rent_one_house;
        break;
      case 2:
        rent = property?.rent_two_houses;
        break;
      case 3:
        rent = property?.rent_three_houses;
        break;
      case 4:
        rent = property?.rent_four_houses;
        break;
      case 5:
        rent = property?.rent_hotel;
        break;

      default:
        break;
    }
    return rent;
  }
  return (
    <aside className="w-72 h-full border-r border-white/10 bg-[#010F10] overflow-y-auto">
      <header className="p-4 border-b border-cyan-800">
        <h2 className="text-lg font-semibold text-gray-300">Players</h2>
      </header>

      <ul className="divide-y divide-divide-cyan-800">
        {game?.players
          ?.slice()
          .sort(
            (a, b) =>
              (a.turn_order ?? Number.POSITIVE_INFINITY) -
              (b.turn_order ?? Number.POSITIVE_INFINITY)
          )
          .map((player) => {
            const isWinner = player.user_id === game.winner_id;
            const isNext = player.user_id === game.next_player_id;
            const isMe =
              player.address?.toLowerCase() === address?.toLowerCase();

            return (
              <li
                key={player.user_id}
                className={`p-3 flex flex-col border-l-4 ${isNext
                  ? "border-cyan-800 bg-cyan-900/20"
                  : "border-transparent"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-200">
                    {getPlayerSymbol(player.symbol)} &nbsp;
                    {player.username || player.address?.slice(0, 6)}
                    {isMe && " (Me)"}
                    {isWinner && " 👑"}
                  </span>
                  <span className="text-xs text-gray-300">
                    {player.balance} 💰
                  </span>
                </div>
                <div className="flex items-center justify-end space-x-2">
                  <div className="text-xs text-gray-300">
                    Position: {player.position ?? "0"}
                  </div>
                  <div className="text-xs text-gray-300">
                    Circle: {player.circle ?? "0"}
                  </div>
                  <div className="text-xs text-gray-300">
                    Turn: {player.turn_order ?? "N/A"}
                  </div>
                </div>
              </li>
            );
          })}
      </ul>

      {/* My Properties Section */}

      <section className="border-t border-gray-800 mt-2">
        <h3 className="p-3 text-sm font-semibold text-gray-300">
          My Properties
        </h3>
        <ul className="divide-y divide-gray-800">
          {my_properties.length > 0 ? (
            my_properties.map((prop) => (
              <li key={prop.id} className="p-3 text-sm text-gray-200">
                {/* Property Card */}
                <div className="rounded-lg border shadow-sm p-2 bg-gray-800">
                  {/* Color bar if property has color */}
                  {prop.color && (
                    <div
                      className="w-full h-2 rounded-t-md mb-2"
                      style={{ backgroundColor: prop.color }}
                    />
                  )}

                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{prop.name}</span>
                    <span className="text-xs text-gray-500">#{prop.id}</span>
                  </div>

                  <div className="mt-1 text-xs text-gray-400">
                    <div>Price: 💵 {prop.price}</div>
                    <div>Rent: 🏠 {rentPrice(prop.id)}</div>
                    {isMortgaged(prop.id) && (
                      <div className="text-red-500">🔒 Mortgaged</div>
                    )}
                  </div>
                </div>
              </li>
            ))
          ) : (
            <div className="text-center text-sm font-medium text-gray-500 py-1">
              No properties yet..
            </div>
          )}
        </ul>
      </section>
    </aside>
  );
}
