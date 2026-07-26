import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/models/ai_game_settings.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/screens/waiting_lobby_screen.dart';
import 'package:tycoon/services/api_client.dart';
import 'package:tycoon/services/game_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/glow_button.dart';

class MultiplayerCreateScreen extends StatefulWidget {
  const MultiplayerCreateScreen({super.key});

  @override
  State<MultiplayerCreateScreen> createState() => _MultiplayerCreateScreenState();
}

class _MultiplayerCreateScreenState extends State<MultiplayerCreateScreen> {
  final _api = GameApi();

  String _symbol = 'hat';
  int _maxPlayers = 4;
  bool _private = false;
  int _cash = 1500;
  int _duration = 30;
  String _boardId = 'default';
  List<BoardVariant> _boards = const [];
  bool _creating = false;
  String? _error;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    _loadBoards();
  }

  Future<void> _loadBoards() async {
    try {
      final boards = await _api.fetchBoardVariants();
      if (!mounted) return;
      setState(() {
        _boards = boards;
        if (boards.isNotEmpty) _boardId = boards.first.id;
      });
    } catch (_) {}
  }

  Future<void> _create() async {
    if (!_auth.isLoggedIn) {
      final ok = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (ok != true || !_auth.isLoggedIn) return;
    }

    setState(() {
      _creating = true;
      _error = null;
    });

    try {
      final code = generateGameCode();
      final game = await _api.createMultiplayerMobile(
        code: code,
        symbol: _symbol,
        maxPlayers: _maxPlayers,
        privateRoom: _private,
        startingCash: _cash,
        duration: _duration,
        boardId: _boardId,
        myUserId: _auth.user?.id,
      );
      if (!mounted) return;
      await Navigator.of(context).pushReplacement<void, void>(
        MaterialPageRoute(
          builder: (_) => WaitingLobbyScreen(gameCode: game.code),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _creating = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _creating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Multiplayer'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _label('Piece'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final p in gamePieces)
                ChoiceChip(
                  label: Text(p.$2),
                  selected: _symbol == p.$1,
                  onSelected: (_) => setState(() => _symbol = p.$1),
                  selectedColor: TycoonColors.cyan,
                  labelStyle: TextStyle(
                    color: _symbol == p.$1
                        ? TycoonColors.background
                        : TycoonColors.textBody,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                  backgroundColor: TycoonColors.panel,
                ),
            ],
          ),
          const SizedBox(height: 16),
          _label('Max players: $_maxPlayers'),
          Slider(
            value: _maxPlayers.toDouble(),
            min: 2,
            max: 8,
            divisions: 6,
            activeColor: TycoonColors.cyan,
            onChanged: (v) => setState(() => _maxPlayers = v.round()),
          ),
          SwitchListTile(
            title: const Text('Private room', style: TextStyle(color: TycoonColors.textWhite)),
            value: _private,
            activeThumbColor: TycoonColors.cyan,
            onChanged: (v) => setState(() => _private = v),
          ),
          _label('Starting cash: \$$_cash'),
          Slider(
            value: _cash.toDouble(),
            min: 500,
            max: 3000,
            divisions: 10,
            activeColor: TycoonColors.cyan,
            onChanged: (v) => setState(() => _cash = (v / 100).round() * 100),
          ),
          _label('Duration: ${_duration == 0 ? 'Untimed' : '$_duration min'}'),
          Slider(
            value: _duration.toDouble(),
            min: 0,
            max: 90,
            divisions: 9,
            activeColor: TycoonColors.cyan,
            onChanged: (v) => setState(() => _duration = v.round()),
          ),
          if (_boards.isNotEmpty) ...[
            _label('Board'),
            DropdownButtonFormField<String>(
              value: _boardId,
              dropdownColor: TycoonColors.panel,
              style: const TextStyle(color: TycoonColors.textWhite),
              items: [
                for (final b in _boards)
                  DropdownMenuItem(value: b.id, child: Text(b.label)),
              ],
              onChanged: (v) {
                if (v != null) setState(() => _boardId = v);
              },
            ),
          ],
          const SizedBox(height: 20),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ),
          GlowButton(
            label: _creating ? 'Creating…' : 'Create Lobby',
            onPressed: _creating ? null : _create,
          ),
          const SizedBox(height: 8),
          const Text(
            'Free lobby — no wallet required. Share the code so friends can join.',
            textAlign: TextAlign.center,
            style: TextStyle(color: TycoonColors.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6, top: 4),
        child: Text(
          text,
          style: const TextStyle(color: TycoonColors.cyan, fontWeight: FontWeight.w700),
        ),
      );
}
