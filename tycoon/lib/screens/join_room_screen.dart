import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/board_screen.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/screens/waiting_lobby_screen.dart';
import 'package:tycoon/services/api_client.dart';
import 'package:tycoon/services/game_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/glow_button.dart';

class JoinRoomScreen extends StatefulWidget {
  const JoinRoomScreen({super.key});

  @override
  State<JoinRoomScreen> createState() => _JoinRoomScreenState();
}

class _JoinRoomScreenState extends State<JoinRoomScreen> {
  final _api = GameApi();
  final _codeCtrl = TextEditingController();

  List<LobbyGame> _open = const [];
  List<LobbyGame> _mine = const [];
  bool _loading = true;
  bool _joining = false;
  String? _error;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final open = await _api.fetchOpenGames();
      List<LobbyGame> mine = const [];
      if (_auth.isLoggedIn) {
        mine = await _api.fetchMyGames(myUserId: _auth.user?.id);
      }
      if (!mounted) return;
      setState(() {
        _open = open;
        _mine = mine;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<bool> _ensureAuth() async {
    if (_auth.isLoggedIn) return true;
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
    return ok == true && _auth.isLoggedIn;
  }

  Future<void> _joinCode([String? code]) async {
    final raw = (code ?? _codeCtrl.text).trim().toUpperCase();
    if (raw.length < 4) {
      setState(() => _error = 'Enter a valid game code');
      return;
    }
    if (!await _ensureAuth()) return;

    setState(() {
      _joining = true;
      _error = null;
    });

    try {
      final existing = await _api.fetchGameByCode(raw, myUserId: _auth.user?.id);
      if (existing.isRunning) {
        if (!mounted) return;
        final inGame = existing.players.any((p) => p.userId == _auth.user?.id);
        if (!inGame && existing.players.isNotEmpty) {
          throw ApiException('Game already started and you are not in it');
        }
        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) => BoardScreen(
              gameCode: existing.code,
              multiplayer: !existing.isAi,
            ),
          ),
        );
        return;
      }

      final joined = await _api.joinMobile(
        code: raw,
        myUserId: _auth.user?.id,
      );
      if (!mounted) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => WaitingLobbyScreen(gameCode: joined.code),
        ),
      );
      if (mounted) _refresh();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Join Room'),
        actions: [
          IconButton(onPressed: _loading ? null : _refresh, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: RefreshIndicator(
        color: TycoonColors.cyan,
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            const Text(
              'Enter access code',
              style: TextStyle(color: TycoonColors.cyan, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _codeCtrl,
              textCapitalization: TextCapitalization.characters,
              style: const TextStyle(color: TycoonColors.textWhite, letterSpacing: 2),
              decoration: InputDecoration(
                hintText: 'ABCDEF',
                hintStyle: const TextStyle(color: TycoonColors.textMuted),
                filled: true,
                fillColor: TycoonColors.panel,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: TycoonColors.tealDark),
                ),
              ),
            ),
            const SizedBox(height: 12),
            GlowButton(
              label: _joining ? 'Joining…' : 'Join',
              onPressed: _joining ? null : () => _joinCode(),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ],
            const SizedBox(height: 24),
            if (_mine.isNotEmpty) ...[
              const Text(
                'Your games',
                style: TextStyle(color: TycoonColors.cyan, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              for (final g in _mine) _GameTile(game: g, onTap: () => _openGame(g)),
              const SizedBox(height: 20),
            ],
            const Text(
              'Open lobbies',
              style: TextStyle(color: TycoonColors.cyan, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator(color: TycoonColors.cyan)),
              )
            else if (_open.isEmpty)
              const Text('No public lobbies right now.', style: TextStyle(color: TycoonColors.textMuted))
            else
              for (final g in _open) _GameTile(game: g, onTap: () => _joinCode(g.code)),
          ],
        ),
      ),
    );
  }

  Future<void> _openGame(LobbyGame g) async {
    if (g.isRunning) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => BoardScreen(gameCode: g.code, multiplayer: !g.isAi),
        ),
      );
    } else {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => WaitingLobbyScreen(gameCode: g.code),
        ),
      );
    }
    if (mounted) _refresh();
  }
}

class _GameTile extends StatelessWidget {
  const _GameTile({required this.game, required this.onTap});

  final LobbyGame game;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: onTap,
        tileColor: TycoonColors.panel,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: TycoonColors.tealDark),
        ),
        title: Text(
          game.code,
          style: const TextStyle(
            color: TycoonColors.textWhite,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
        subtitle: Text(
          '${game.status} · ${game.playerCount}/${game.maxPlayers} · ${game.mode}',
          style: const TextStyle(color: TycoonColors.textMuted, fontSize: 12),
        ),
        trailing: const Icon(Icons.chevron_right, color: TycoonColors.cyan),
      ),
    );
  }
}
