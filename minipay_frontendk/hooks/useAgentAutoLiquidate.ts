/**
 * When "my agent" is playing for me and I land in debt, the agent automatically:
 *  1. Sells all houses/hotels (half the house cost each)
 *  2. Mortgages all remaining unimproved properties (half price)
 *  3. If still insolvent after all that → calls onDeclare() (declare bankruptcy)
 *
 * Does nothing when the agent is off or balance is >= 0.
 */

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { ApiResponse } from "@/types/api";

interface UseAgentAutoLiquidateProps {
  agentOn: boolean;
  isMyTurn: boolean;
  me: Player | null | undefined;
  game: Game | null | undefined;
  gameProperties: GameProperty[];
  properties: Property[];
  refetchGame: () => Promise<unknown>;
  refetchGameProperties?: () => Promise<unknown>;
  /** Called when the agent can't raise enough — should trigger the page's declare-bankruptcy flow */
  onDeclare: () => Promise<void>;
}

export function useAgentAutoLiquidate({
  agentOn,
  isMyTurn,
  me,
  game,
  gameProperties,
  properties,
  refetchGame,
  refetchGameProperties,
  onDeclare,
}: UseAgentAutoLiquidateProps) {
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!agentOn || !isMyTurn || !me || !game?.id) return;
    if ((me.balance ?? 0) >= 0) return;
    if (handlingRef.current) return;
    handlingRef.current = true;

    const run = async () => {
      try {
        const myAddr = me.address?.toLowerCase();

        // 1. Sell all houses/hotels (most expensive first to raise most cash quickly)
        const withHouses = gameProperties
          .filter(
            (gp) =>
              gp.address?.toLowerCase() === myAddr &&
              !gp.mortgaged &&
              (gp.development ?? 0) > 0
          )
          .sort((a, b) => {
            const pa = properties.find((p) => p.id === a.property_id);
            const pb = properties.find((p) => p.id === b.property_id);
            return (pb?.rent_hotel ?? 0) - (pa?.rent_hotel ?? 0);
          });

        let raised = 0;
        for (const gp of withHouses) {
          const prop = properties.find((p) => p.id === gp.property_id);
          if (!prop?.cost_of_house) continue;
          const sellValue = Math.floor(prop.cost_of_house / 2);
          const houses = gp.development ?? 0;
          for (let i = 0; i < houses; i++) {
            try {
              await apiClient.post<ApiResponse>("/game-properties/downgrade", {
                game_id: game.id,
                user_id: me.user_id,
                property_id: gp.property_id,
              });
              raised += sellValue;
            } catch {
              break;
            }
          }
        }

        // 2. Mortgage all unimproved properties
        const unmortgaged = gameProperties
          .filter(
            (gp) =>
              gp.address?.toLowerCase() === myAddr &&
              !gp.mortgaged &&
              (gp.development ?? 0) === 0
          )
          .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
          .filter(({ prop }) => !!prop?.price)
          .sort((a, b) => (b.prop?.price ?? 0) - (a.prop?.price ?? 0));

        for (const { gp, prop } of unmortgaged) {
          if (!prop) continue;
          try {
            await apiClient.post<ApiResponse>("/game-properties/mortgage", {
              game_id: game.id,
              user_id: me.user_id,
              property_id: gp.property_id,
            });
            raised += Math.floor(prop.price / 2);
          } catch {
            /* ignore individual failures */
          }
        }

        // Refetch to get accurate balance
        await refetchGame();
        if (refetchGameProperties) await refetchGameProperties();

        // Check if still broke (use computed balance as safety net if refetch is stale)
        const freshBalance = (me.balance ?? 0) + raised;
        if (freshBalance >= 0) {
          if (raised > 0) {
            toast.success(`Your agent raised $${raised} and will keep playing.`, { duration: 4000 });
          }
          return;
        }

        // Still insolvent — declare bankruptcy
        toast(`Your agent cannot raise enough funds. Declaring bankruptcy…`, { duration: 4000 });
        await onDeclare();
      } finally {
        handlingRef.current = false;
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentOn, isMyTurn, me?.balance, me?.user_id, game?.id]);
}
