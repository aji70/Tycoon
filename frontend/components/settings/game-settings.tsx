'use client';
import React, { useState, useEffect } from 'react';
import { FaUsers, FaUser } from 'react-icons/fa6';
import { House } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/game-switch';
import { MdPrivateConnectivity } from 'react-icons/md';
import { RiAuctionFill } from 'react-icons/ri';
import { GiBank, GiPrisoner } from 'react-icons/gi';
import { IoBuild } from 'react-icons/io5';
import { FaHandHoldingDollar } from 'react-icons/fa6';
import { AiOutlineDollarCircle } from 'react-icons/ai';
import { FaRandom } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { useAccount } from '@starknet-react/core';
import { usePlayerActions } from '@/hooks/usePlayerActions';
import { useGameActions } from '@/hooks/useGameActions';
import GameRoomLoading from '@/components/game/game-room-loading';

interface Token {
  name: string;
  emoji: string;
  value: number;
}

interface Game {
  id: number;
  creator: `0x${string}` | undefined;
  players: { address: `0x${string}` | undefined; tokenValue: number }[];
  maxPlayers: number;
  availableTokens: Token[];
  status: { variant: { Pending?: {}; Ongoing?: {} } };
  is_initialised: boolean;
  players_joined: string;
  number_of_players: string;
  dice_face: string;
  hat: string;
  car: string;
  dog: string;
  thimble: string;
  iron: string;
  battleship: string;
  boot: string;
  wheelbarrow: string;
  player_hat: bigint;
  player_car: bigint;
  player_dog: bigint;
  player_thimble: bigint;
  player_iron: bigint;
  player_battleship: bigint;
  player_boot: bigint;
  player_wheelbarrow: bigint;
}

interface CreateGameResponse {
  transaction_hash: string;
}

const tokens: Token[] = [
  { name: 'Hat', emoji: '', value: 0 },
  { name: 'Car', emoji: '', value: 1 },
  { name: 'Dog', emoji: '', value: 2 },
  { name: 'Thimble', emoji: '', value: 3 },
  { name: 'Iron', emoji: '', value: 4 },
  { name: 'Battleship', emoji: '', value: 5 },
  { name: 'Boot', emoji: '', value: 6 },
  { name: 'Wheelbarrow', emoji: '', value: 7 },
];

const GameSettings = () => {
  const router = useRouter();
  const { account, address, connector } = useAccount();
  const player = usePlayerActions();
  const game = useGameActions();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameType, setGameType] = useState('0');
  const [selectedToken, setSelectedToken] = useState('');
  const [numberOfPlayers, setNumberOfPlayers] = useState('');

  const checkRegistration = async () => {
    try {
      const registered = await player.isRegistered(address!);
      setIsRegistered(registered);
    } catch (err: any) {
      setError(err?.message || 'Failed to check registration status');
    }
  };

  useEffect(() => {
    if (address) {
      checkRegistration();
    }
  }, [address]);

  const handleCreateGame = async () => {
    if (!account || !address) {
      setError('Please connect your wallet');
      return;
    }
    if (!isRegistered) {
      setError('Please register before creating a game');
      router.push('/');
      return;
    }
    if (!gameType || !selectedToken || !numberOfPlayers) {
      setError('Please select all fields');
      return;
    }
    const gameTypeNum = Number(gameType);
    const numPlayers = Number(numberOfPlayers);
    if (gameType !== '0' && gameType !== '1') {
      setError('Game type must be Public (0) or Private (1)');
      return;
    }
    if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 8) {
      setError('Number of players must be between 2 and 8');
      return;
    }
    const tokenValue = tokens.find((t) => t.name === selectedToken)?.value;
    if (tokenValue === undefined) {
      setError('Invalid token selected');
      return;
    }
    setIsCreatingGame(true);
    setError(null);
    try {
      const initialLastGame = Number(await game.lastGame()) || 0;
      const tx: CreateGameResponse = await game.createGame(account, gameTypeNum, tokenValue, numPlayers);
      if (!tx?.transaction_hash) {
        throw new Error('No transaction hash returned from createGame');
      }
      const newGameId = initialLastGame + 1;
      setTimeout(() => {
        router.push(`/game-waiting?gameId=${newGameId}&creator=${address}`);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create game. Please try again.');
    } finally {
      setIsCreatingGame(false);
    }
  };

  if (isCreatingGame) {
    return <GameRoomLoading action="create" />;
  }

  return (
    <section className="w-full min-h-screen bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-auto py-20 flex flex-col items-center justify-start bg-[#010F101F] backdrop-blur-[12px] px-4">
        <div className="w-full max-w-[792px] flex justify-start mb-6">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
          >
            <svg
              width="227"
              height="40"
              viewBox="0 0 227 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-0 left-0 w-full h-full"
            >
              <path
                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#0E1415"
                stroke="#003B3E"
                strokeWidth={1}
                className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[13px] font-dmSans font-medium z-10">
              <House className="mr-1 w-[14px] h-[14px]" />
              Go Back Home
            </span>
          </button>
        </div>

        <div className="w-full flex flex-col items-center mb-4">
          <h2 className="text-[#F0F7F7] font-orbitron md:text-[24px] text-[20px] font-[700] text-center">
            Game Settings
          </h2>
          <p className="text-[#869298] text-[16px] font-dmSans text-center">
            Since you&apos;re creating a game, you get to choose how you want your game to go
          </p>
        </div>

        <div className="w-full max-w-[792px] bg-[#010F10] rounded-[12px] border-[1px] border-[#003B3E] md:p-[40px] p-[20px] flex flex-col gap-4">
          <div className="w-full flex justify-between items-center">
            <div className="flex items-start md:gap-3 gap-2">
              <FaUser className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600]">
                  Select Your Avatar
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  Please choose your preferred avatar
                </p>
              </div>
            </div>
            <Select
              value={selectedToken}
              onValueChange={(value) => setSelectedToken(value)}
            >
              <SelectTrigger className="w-[160px] data-[size=default]:h-[40px] text-[#73838B] border-[1px] border-[#263238]">
                <SelectValue className="text-[#F0F7F7]" placeholder="Select a token" />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.name} value={token.name}>
                    {token.emoji} {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full flex justify-between items-center">
            <div className="flex items-start md:gap-3 gap-2">
              <FaUsers className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600]">
                  Maximum Players
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  How many players can join the game.
                </p>
              </div>
            </div>
            <Select
              value={numberOfPlayers}
              onValueChange={(value) => setNumberOfPlayers(value)}
            >
              <SelectTrigger className="w-[80px] data-[size=default]:h-[40px] text-[#73838B] border-[1px] border-[#263238]">
                <SelectValue className="text-[#F0F7F7]" placeholder="Select number" />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full flex justify-between items-center">
            <div className="flex items-start md:gap-3 gap-2">
              <MdPrivateConnectivity className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600]">
                  Private Room
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  Private rooms can be accessed using the room URL only.
                </p>
              </div>
            </div>
            <Switch
              id="private-room"
              checked={gameType === '1'}
              onCheckedChange={(checked) => setGameType(checked ? '1' : '0')}
            />
          </div>
        </div>

        <div className="w-full flex flex-col items-center mt-20 mb-4">
          <h2 className="text-[#F0F7F7] font-orbitron md:text-[24px] text-[20px] font-[700] text-center">
            Gameplay Rules
          </h2>
          <p className="text-[#869298] text-[16px] font-dmSans text-center">
            Set the rules for the game
          </p>
        </div>

        <div className="w-full max-w-[792px] bg-[#010F10] rounded-[12px] border-[1px] border-[#003B3E] md:p-[40px] p-[20px] flex flex-col gap-5">
          <div className="w-full flex justify-between items-start">
            <div className="flex items-start md:gap-3 gap-2 max-w-[550px]">
              <RiAuctionFill className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col flex-1">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600]">
                  Auction
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  If someone skips purchasing a property during auction, it will be sold to the highest bidder.
                </p>
              </div>
            </div>
            <Switch id="auction" disabled />
          </div>

          <div className="w-full flex justify-between items-start">
            <div className="flex items-start md:gap-3 gap-2 max-w-[550px]">
              <GiPrisoner className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col flex-1">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600] capitalize">
                  Rent In Prison
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  Rent will be collected when landing on properties of a player in prison.
                </p>
              </div>
            </div>
            <Switch id="rent-in-prison" disabled />
          </div>

          <div className="w-full flex justify-between items-start">
            <div className="flex items-start md:gap-3 gap-2 max-w-[550px]">
              <GiBank className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col flex-1">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600]">
                  Mortgage
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  Mortgage properties to earn 50% of their cost, but you won&apos;t get paid rent when players land on them.
                </p>
              </div>
            </div>
            <Switch id="mortgage" disabled />
          </div>

          <div className="w-full flex justify-between items-start">
            <div className="flex items-start md:gap-3 gap-2 max-w-[550px]">
              <IoBuild className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col flex-1">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600] capitalize">
                  Even Build
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  Houses and hotels must be built up and sold off evenly within a property set.
                </p>
              </div>
            </div>
            <Switch id="even-build" disabled />
          </div>

          <div className="w-full flex justify-between items-start">
            <div className="flex items-start md:gap-3 gap-2 max-w-[550px]">
              <FaHandHoldingDollar className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col flex-1">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600] capitalize">
                  Starting Cash
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  Adjust how much players can start the game with.
                </p>
              </div>
            </div>
            <Select
              value="1500"
              disabled
            >
              <SelectTrigger className="w-[120px] data-[size=default]:h-[40px] text-[#73838B] border-[1px] border-[#263238]">
                <AiOutlineDollarCircle className="md:w-3 md:h-3 text-[#73838B]" />
                <SelectValue className="text-[#F0F7F7]" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="300">300</SelectItem>
                <SelectItem value="400">400</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
                <SelectItem value="1500">1500</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full flex justify-between items-start">
            <div className="flex items-start md:gap-3 gap-2 max-w-[550px]">
              <FaRandom className="md:w-6 md:h-6 w-5 h-5 mt-1.5 text-[#F0F7F7]" />
              <div className="flex flex-col flex-1">
                <h4 className="text-[#F0F7F7] md:text-[22px] text-[20px] font-dmSans font-[600] capitalize">
                  Randomize Play Order
                </h4>
                <p className="text-[#455A64] font-[500] font-dmSans text-[16px]">
                  Randomly reorder players at the beginning of the game.
                </p>
              </div>
            </div>
            <Switch id="random-play" disabled />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mt-4">{error}</p>
        )}

        <div className="w-full max-w-[792px] flex justify-end mt-12">
          <button
            type="button"
            onClick={handleCreateGame}
            className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
            disabled={isCreatingGame}
          >
            <svg
              width="260"
              height="52"
              viewBox="0 0 260 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
            >
              <path
                d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                fill="#00F0FF"
                stroke="#0E282A"
                strokeWidth={1}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] -tracking-[2%] font-orbitron font-[700] z-10">
              {isCreatingGame ? 'Creating...' : 'Play'}
            </span>
          </button>
        </div>
      </main>
    </section>
  );
};

export default GameSettings;