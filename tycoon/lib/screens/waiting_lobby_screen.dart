import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/board_screen.dart';
import 'package:tycoon/services/api_client.dart';
import 'package:tycoon/services/game_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/glow_button.dart';

class WaitingLobbyScreen extends StatefulWidget {
  const WaitingLobbyScreen({super.key, required this.gameCode});

  final String gameCode;

  @override
  State<WaitingLobbyScreen> createState() => _WaitingLobbyScreenState();
}

class _WaitingLobbyScreenState extends State<WaitingLobbyScreen> {
  final _api = GameApi();
  Timer? _poll;
  LobbyGame? _game;
  bool _starting = false;
  String? _error;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    _refresh();
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => _refresh(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _refresh({bool silent = false}) async {
    try {
      final game = await _api.fetchGameByCode(
        widget.gameCode,
        myUserId: _auth.user?.id,
      );
      if (!mounted) return;
      setState(() {
        _game = game;
        _error = null;
      });
      if (game.isRunning) {
        _poll?.cancel();
        await Navigator.of(context).pushReplacement<void, void>(
          MaterialPageRoute(
            builder: (_) => BoardScreen(
              gameCode: game.code,
              multiplayer: !game.isAi,
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted || silent) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _start() async {
    final game = _game;
    if (game == null || _starting) return;
    setState(() => _starting = true);
    try {
      final started = await _api.startMobile(game.id, myUserId: _auth.user?.id);
      if (!mounted) return;
      await Navigator.of(context).pushReplacement<void, void>(
        MaterialPageRoute(
          builder: (_) => BoardScreen(
            gameCode: started.code,
            multiplayer: true,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _starting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _starting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final game = _game;
    final isHost = game?.isCreator == true;

    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: Text('Lobby ${widget.gameCode}'),
        actions: [
          IconButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: widget.gameCode));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Code copied')),
              );
            },
            icon: const Icon(Icons.copy),
          ),
        ],
      ),
      body: game == null
          ? const Center(child: CircularProgressIndicator(color: TycoonColors.cyan))
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Share code: ${game.code}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: TycoonColors.cyan,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${game.players.length}/${game.maxPlayers} players · ${game.mode}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: TycoonColors.textMuted),
                  ),
                  const SizedBox(height: 20),
                  Expanded(
                    child: ListView.separated(
                      itemCount: game.players.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final p = game.players[i];
                        final isMe = p.userId == _auth.user?.id;
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: TycoonColors.panel,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isMe
                                  ? TycoonColors.cyan.withValues(alpha: 0.5)
                                  : TycoonColors.tealDark,
                            ),
                          ),
                          child: Row(
                            children: [
                              Text(
                                p.symbol.toUpperCase(),
                                style: const TextStyle(
                                  color: TycoonColors.cyan,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  p.username + (isMe ? ' (you)' : ''),
                                  style: const TextStyle(
                                    color: TycoonColors.textWhite,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              if (i == 0)
                                const Text(
                                  'HOST',
                                  style: TextStyle(
                                    color: TycoonColors.textMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                    ),
                  if (isHost)
                    GlowButton(
                      label: _starting ? 'Starting…' : 'Start Game',
                      onPressed: _starting || game.players.length < 2 ? null : _start,
                    )
                  else
                    const Text(
                      'Waiting for host to start…',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: TycoonColors.textMuted),
                    ),
                ],
              ),
            ),
    );
  }
}
