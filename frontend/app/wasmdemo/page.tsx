'use client';

import { useEffect, useState } from 'react';
import { isWasmSupported, getWasmCapabilities } from '@/utils/wasm-loader';
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core';

import { usePlayerActions } from '@/hooks/usePlayerActions';
import { useGameActions } from '@/hooks/useGameActions';
import { useMovementActions } from '@/hooks/useMovementActions';
import { usePropertyActions } from '@/hooks/usePropertyActions';
import { useTradeActions } from '@/hooks/useTradeActions';

export default function WasmDemo() {
  const { account, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const player = usePlayerActions();
  const game   = useGameActions();
  const move   = useMovementActions();
  const property = usePropertyActions();
  const trade   = useTradeActions();

  const [fields, setFields] = useState({
    username: '', addressp: '', gameType: '', playerSymbol: '',
    numPlayers: '', gameId: '', amount: '', diceRoll: '', propertyId: '',
    card: ''
  });

  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (fn: () => Promise<any>, label: string) => {
    setLoading(true); setError(null); setResponse(null);
    try {
      const res = await fn();
      console.log(label, res);
      setResponse(res);
    } catch (err: any) {
      console.error(label, err);
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isWasmSupported()) { getWasmCapabilities(); }
  }, []);

  if (!address) return (
    <main className="p-8 text-center">Please connect your wallet to continue.</main>
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const actionButtons = [
    { label: 'Register Player', onClick: () => account && handleRequest(() => player.register(account, fields.username), 'register') },
    { label: 'Check Registered', onClick: () => handleRequest(() => player.isRegistered(fields.addressp), 'isRegistered') },
    { label: 'Get Username', onClick: () => handleRequest(() => player.getUsernameFromAddress(fields.addressp), 'getUsername') },
    { label: 'Retrieve Player', onClick: () => handleRequest(() => player.retrievePlayer(fields.addressp), 'retrievePlayer') },
    { label: 'Create Game', onClick: () => account && handleRequest(() => game.createGame(account, +fields.gameType, +fields.playerSymbol, +fields.numPlayers), 'createGame') },
    { label: 'Join Game', onClick: () => account && handleRequest(() => game.joinGame(account, +fields.playerSymbol, +fields.gameId), 'joinGame') },
    { label: 'Start Game', onClick: () => account && handleRequest(() => game.startGame(account, +fields.gameId), 'startGame') },
    { label: 'Get Game', onClick: () => handleRequest(() => game.getGame(+fields.gameId), 'getGame') },
    { label: 'Retrieve Game Player', onClick: () => handleRequest(() => game.getPlayer(fields.addressp, +fields.gameId), 'getPlayer') },
    { label: 'Mint', onClick: () => account && handleRequest(() => game.mint(account, fields.addressp, +fields.gameId, +fields.amount), 'mint') },
    { label: 'Get Balance', onClick: () => handleRequest(() => game.getGamePlayerBalance(fields.addressp, +fields.gameId), 'getBalance') },
    { label: 'Move Player', onClick: () => account && handleRequest(() => move.movePlayer(account, +fields.gameId, +fields.diceRoll), 'movePlayer') },
    { label: 'Pay Jail Fine', onClick: () => account && handleRequest(() => move.payJailFine(account, +fields.gameId), 'payJailFine') },
    { label: 'Chance Jail Card', onClick: () => account && handleRequest(() => move.payGetoutOfJailChance(account, +fields.gameId), 'chanceCard') },
    { label: 'Community Jail Card', onClick: () => account && handleRequest(() => move.payGetoutOfJailCommunity(account, +fields.gameId), 'communityCard') },
    { label: 'Get Current Player', onClick: () => account && handleRequest(() => move.getCurrentPlayer(+fields.gameId), 'currentPlayer') },
    { label: 'Current Player Name', onClick: () => account && handleRequest(() => move.getCurrentPlayerName(+fields.gameId), 'currentPlayerName') },
    { label: 'Buy Property', onClick: () => account && handleRequest(() => property.buyProperty(account, +fields.propertyId, +fields.gameId), 'buyProperty') },
    { label: 'End Game', onClick: () => account && handleRequest(() => game.endGame(account, +fields.gameId), 'endGame') },
    { label: 'Get Property', onClick:() => account && handleRequest(() => property.getProperty(+fields.propertyId, +fields.gameId), 'getProperty')},
    { label: ' Finish Turn', onClick:() => account && handleRequest(()=> property.finishTurn(account, +fields.gameId), 'finishTurn')},
    { label: 'Pay Rent', onClick:() => account && handleRequest(() => property.payRent(account, +fields.propertyId, +fields.gameId), 'payRent')},
    { label: 'Process Community', onClick:() => account && handleRequest(() => move.processCommunityChestCard(account, +fields.gameId, fields.card), 'processCommunityChestCard')},
    { label: 'Process Chance', onClick:() => account && handleRequest(() => move.processChanceCard(account, +fields.gameId, fields.card), 'processChanceCard')},
    { label: 'Pay Tax', onClick: () => account && handleRequest(() => move.payTax(account, +fields.propertyId, +fields.gameId), 'payTax')},
  ];

  return (
<main className="max-w-7xl mx-auto px-4 py-8 space-y-10">
  <h1 className="text-4xl font-bold text-center text-blue-400">
    Blockopoly Demo
  </h1>

  <div className="text-center text-sm text-gray-400">
    Connected as: <span className="text-blue-300 font-mono">{address}</span>
  </div>

  <div className="grid lg:grid-cols-3 gap-8">
    {/* Left: Form Fields */}
    <section className="space-y-4 col-span-1 bg-gray-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold text-white mb-2">Input Fields</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'username', label: 'Username' },
          { name: 'addressp', label: 'Address' },
          { name: 'gameType', label: 'Game Type' },
          { name: 'playerSymbol', label: 'Player Symbol' },
          { name: 'numPlayers', label: 'Num Players' },
          { name: 'gameId', label: 'Game ID' },
          { name: 'amount', label: 'Amount' },
          { name: 'diceRoll', label: 'Dice Roll' },
          { name: 'propertyId', label: 'Property ID' },
          { name: 'card', label: 'Card' },

          
        ].map(({ name, label }) => (
          <div key={name} className="flex flex-col">
            <label className="text-sm text-gray-300 mb-1">{label}</label>
            <input
              name={name}
              value={(fields as any)[name]}
              onChange={onChange}
              placeholder={label}
              className="bg-gray-700 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
    </section>

    {/* Middle: Actions */}
    <section className="col-span-1 lg:col-span-1 bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
      <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
      <div className="grid sm:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-2">
        {actionButtons.map((btn, i) => (
          <button
            key={i}
            onClick={btn.onClick}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 transition-all duration-150 text-sm p-2 rounded text-white disabled:opacity-50"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </section>

    {/* Right: Response Panel */}
    <section className="col-span-1 bg-gray-900 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold text-green-300 mb-2">Response</h2>
      <div className="text-sm bg-gray-800 rounded p-4 overflow-y-auto max-h-[640px]">
        {loading ? (
          <p className="text-blue-400">Loading...</p>
        ) : error ? (
          <pre className="text-red-400 whitespace-pre-wrap">{error}</pre>
        ) : response ? (
          <pre className="text-green-400 whitespace-pre-wrap">
            {JSON.stringify(
              response,
              (_, v) => (typeof v === 'bigint' ? v.toString() : v),
              2
            )}
          </pre>
        ) : (
          <p className="text-gray-500">Responses will appear here...</p>
        )}
      </div>
    </section>
  </div>
</main>

  );
}
