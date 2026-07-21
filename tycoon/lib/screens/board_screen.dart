import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/logic/game_dice.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/models/game_state.dart';
import 'package:tycoon/services/api_client.dart';
import 'package:tycoon/services/game_play_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/board/monopoly_board_grid.dart';

/// In-app Monopoly board — DB-only gameplay, no blockchain.
class BoardScreen extends StatefulWidget {
  const BoardScreen({super.key, required this.gameCode});

  final String gameCode;

  @override
  State<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends State<BoardScreen> {
  final _api = GamePlayApi();
  Timer? _pollTimer;

  GameSnapshot? _game;
  List<BoardSquare> _squares = const [];
  List<GamePropertyState> _gameProperties = const [];
  String? _error;
  bool _loading = true;
  bool _busy = false;
  bool _aiRunning = false;
  DiceRoll? _lastRoll;
  String _status = '';
  int? _pendingBuyPropertyId;

  AuthController get _auth => TycoonAuthScope.of(context);

  int? get _myUserId => _auth.user?.id;

  GamePlayerState? get _me {
    final id = _myUserId;
    if (id == null || _game == null) return null;
    for (final p in _game!.players) {
      if (p.userId == id) return p;
    }
    return null;
  }

  GamePlayerState? get _currentPlayer {
    final id = _game?.nextPlayerId;
    if (id == null || _game == null) return null;
    for (final p in _game!.players) {
      if (p.userId == id) return p;
    }
    return null;
  }

  bool get _isMyTurn =>
      _myUserId != null && _game?.nextPlayerId == _myUserId && !_game!.isFinished;

  bool get _isAiTurn {
    final cp = _currentPlayer;
    return cp != null && isAiPlayerName(cp.username) && !_game!.isFinished;
  }

  @override
  void initState() {
    super.initState();
    _bootstrap();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _refresh(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _refresh({bool silent = false}) async {
    try {
      final game = await _api.fetchGameByCode(widget.gameCode);
      final props = await _api.fetchGameProperties(game.id);
      var squares = _squares;
      if (squares.isEmpty || game.boardId != _game?.boardId) {
        squares = await _api.fetchBoardSquares(game.boardId);
      }

      if (!mounted) return;
      setState(() {
        _game = game;
        _gameProperties = props;
        _squares = squares;
        _loading = false;
        _error = null;
      });

      if (_isAiTurn && !_busy && !_aiRunning) {
        unawaited(_runAiTurn());
      }
    } catch (e) {
      if (!mounted || silent) return;
      setState(() => _error = e.toString());
    }
  }

  BoardSquare? _squareById(int id) {
    for (final s in _squares) {
      if (s.id == id) return s;
    }
    return null;
  }

  bool _isOwned(int propertyId) {
    return _gameProperties.any((gp) => gp.propertyId == propertyId);
  }

  Future<void> _rollAndMove() async {
    final me = _me;
    final game = _game;
    if (me == null || game == null || _busy) return;

    setState(() {
      _busy = true;
      _status = 'Rolling…';
      _pendingBuyPropertyId = null;
    });

    final dice = rollDice();
    final newPos = advancePosition(me.position, dice.total);

    try {
      final result = await _api.changePosition(
        userId: me.userId,
        gameId: game.id,
        position: newPos,
        rolled: dice.total,
        isDouble: dice.isDouble,
      );

      if (!mounted) return;

      if (!result.success) {
        setState(() {
          _busy = false;
          _status = result.message ?? 'Move failed';
        });
        return;
      }

      setState(() => _lastRoll = dice);

      if (result.stillInJail) {
        await _api.stayInJail(userId: me.userId, gameId: game.id);
        setState(() => _status = 'Still in jail');
        await _refresh();
        setState(() => _busy = false);
        return;
      }

      if (result.card != null) {
        final text = result.card!['text']?.toString() ??
            result.card!['message']?.toString() ??
            'Drew a card';
        setState(() => _status = text);
      }

      if (result.requiresBuy && result.propertyForBuy != null) {
        setState(() {
          _pendingBuyPropertyId = result.propertyForBuy;
          _busy = false;
          _status = 'Buy this property?';
        });
        await _refresh();
        return;
      }

      await _api.endTurn(userId: me.userId, gameId: game.id);
      setState(() => _status = 'Turn ended');
      await _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _status = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _buyPending({required bool buy}) async {
    final me = _me;
    final game = _game;
    final propertyId = _pendingBuyPropertyId;
    if (me == null || game == null || propertyId == null || _busy) return;

    setState(() => _busy = true);

    try {
      if (buy) {
        await _api.buyProperty(
          userId: me.userId,
          gameId: game.id,
          propertyId: propertyId,
        );
        setState(() => _status = 'Property bought');
      } else {
        setState(() => _status = 'Skipped purchase');
      }

      await _api.endTurn(userId: me.userId, gameId: game.id);
      setState(() => _pendingBuyPropertyId = null);
      await _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _status = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runAiTurn() async {
    final ai = _currentPlayer;
    final game = _game;
    if (ai == null || game == null || _aiRunning || _busy) return;

    setState(() {
      _aiRunning = true;
      _status = '${ai.username} is playing…';
    });

    await Future<void>.delayed(const Duration(milliseconds: 900));

    try {
      final dice = rollDice();
      final newPos = advancePosition(ai.position, dice.total);

      final result = await _api.changePosition(
        userId: ai.userId,
        gameId: game.id,
        position: newPos,
        rolled: dice.total,
        isDouble: dice.isDouble,
      );

      if (result.stillInJail) {
        await _api.stayInJail(userId: ai.userId, gameId: game.id);
        await _refresh();
        return;
      }

      if (result.requiresBuy && result.propertyForBuy != null) {
        final sq = _squareById(result.propertyForBuy!);
        final price = sq?.price ?? 0;
        final reserveOk = ai.balance - price >= 500;
        if (!_isOwned(result.propertyForBuy!) &&
            price > 0 &&
            ai.balance >= price &&
            reserveOk) {
          try {
            await _api.buyProperty(
              userId: ai.userId,
              gameId: game.id,
              propertyId: result.propertyForBuy!,
            );
          } catch (_) {}
        }
      }

      await _api.endTurn(userId: ai.userId, gameId: game.id);
      if (mounted) setState(() => _status = '${ai.username} finished turn');
      await _refresh();
    } catch (e) {
      if (mounted) setState(() => _status = 'AI turn error: $e');
    } finally {
      if (mounted) setState(() => _aiRunning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final game = _game;
    final me = _me;
    final current = _currentPlayer;
    final pendingSquare =
        _pendingBuyPropertyId == null ? null : _squareById(_pendingBuyPropertyId!);

    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: TycoonColors.cyan,
        title: Text('Game ${widget.gameCode}'),
        actions: [
          IconButton(
            onPressed: _loading ? null : () => _refresh(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: TycoonColors.cyan))
          : _error != null && game == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                  ),
                )
              : Column(
                  children: [
                    _StatusBar(
                      game: game!,
                      me: me,
                      current: current,
                      lastRoll: _lastRoll,
                      status: _status,
                    ),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(12),
                        child: MonopolyBoardGrid(
                          squares: _squares,
                          players: game.players,
                          gameProperties: _gameProperties,
                          currentPlayerId: game.nextPlayerId,
                          onSquareTap: (sq) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  '${sq.name}${sq.price > 0 ? ' · \$${sq.price}' : ''}',
                                ),
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                    _ActionPanel(
                      isFinished: game.isFinished,
                      isMyTurn: _isMyTurn,
                      busy: _busy || _aiRunning,
                      pendingSquare: pendingSquare,
                      onRoll: _rollAndMove,
                      onBuy: () => _buyPending(buy: true),
                      onSkip: () => _buyPending(buy: false),
                    ),
                  ],
                ),
    );
  }
}

class _StatusBar extends StatelessWidget {
  const _StatusBar({
    required this.game,
    required this.me,
    required this.current,
    required this.status,
    this.lastRoll,
  });

  final GameSnapshot game;
  final GamePlayerState? me;
  final GamePlayerState? current;
  final DiceRoll? lastRoll;
  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF0E282A),
        border: Border(bottom: BorderSide(color: TycoonColors.cyan.withValues(alpha: 0.2))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  me != null ? 'You: \$${me!.balance}' : 'Not in game',
                  style: const TextStyle(color: TycoonColors.cyan, fontWeight: FontWeight.w600),
                ),
              ),
              if (lastRoll != null)
                Text(
                  '🎲 ${lastRoll!.die1}+${lastRoll!.die2}=${lastRoll!.total}',
                  style: const TextStyle(color: TycoonColors.textBodyAlt),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            game.isFinished ? 'Game over' : 'Turn: ${current?.username ?? '—'}',
            style: const TextStyle(color: TycoonColors.textMuted, fontSize: 13),
          ),
          if (status.isNotEmpty)
            Text(status, style: const TextStyle(color: TycoonColors.textBodyAlt, fontSize: 12)),
        ],
      ),
    );
  }
}

class _ActionPanel extends StatelessWidget {
  const _ActionPanel({
    required this.isFinished,
    required this.isMyTurn,
    required this.busy,
    required this.onRoll,
    required this.onBuy,
    required this.onSkip,
    this.pendingSquare,
  });

  final bool isFinished;
  final bool isMyTurn;
  final bool busy;
  final BoardSquare? pendingSquare;
  final VoidCallback onRoll;
  final VoidCallback onBuy;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (pendingSquare != null) ...[
              Text(
                'Buy ${pendingSquare!.name} for \$${pendingSquare!.price}?',
                textAlign: TextAlign.center,
                style: const TextStyle(color: TycoonColors.textWhite),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: busy ? null : onSkip,
                      child: const Text('Skip'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: busy ? null : onBuy,
                      style: FilledButton.styleFrom(
                        backgroundColor: TycoonColors.cyan,
                        foregroundColor: TycoonColors.background,
                      ),
                      child: const Text('Buy'),
                    ),
                  ),
                ],
              ),
            ] else if (isFinished)
              const Text(
                'Game finished',
                textAlign: TextAlign.center,
                style: TextStyle(color: TycoonColors.textMuted),
              )
            else if (isMyTurn)
              FilledButton(
                onPressed: busy ? null : onRoll,
                style: FilledButton.styleFrom(
                  backgroundColor: TycoonColors.cyan,
                  foregroundColor: TycoonColors.background,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: Text(busy ? 'Please wait…' : 'Roll Dice'),
              )
            else
              Text(
                busy ? 'Please wait…' : 'Waiting for other player…',
                textAlign: TextAlign.center,
                style: const TextStyle(color: TycoonColors.textMuted),
              ),
          ],
        ),
      ),
    );
  }
}
