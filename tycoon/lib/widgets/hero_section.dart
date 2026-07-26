import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/navigation/app_navigator.dart';
import 'package:tycoon/navigation/app_routes.dart';
import 'package:tycoon/screens/board_screen.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/services/api_client.dart';
import 'package:tycoon/services/game_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/glow_button.dart';
import 'package:tycoon/widgets/neon_title.dart';
import 'package:tycoon/widgets/scanline_overlay.dart';
import 'package:tycoon/widgets/slanted_button.dart';
import 'package:tycoon/widgets/world_stats_bar.dart';

class HeroSection extends StatefulWidget {
  const HeroSection({super.key});

  @override
  State<HeroSection> createState() => _HeroSectionState();
}

class _HeroSectionState extends State<HeroSection> {
  static const _taglines = [
    'Conquer',
    'Conquer • Build',
    'Conquer • Build • Trade',
    'Play Solo vs AI',
  ];

  final _gameApi = GameApi();

  int _taglineIndex = 0;
  Timer? _taglineTimer;
  ActiveGameSummary? _activeGame;
  bool _loadingActive = false;
  int? _fetchedForUserId;

  @override
  void initState() {
    super.initState();
    _taglineTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
      if (!mounted) return;
      setState(() => _taglineIndex = (_taglineIndex + 1) % _taglines.length);
    });
  }

  @override
  void dispose() {
    _taglineTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final userId = _auth.user?.id;
    if (userId != _fetchedForUserId) {
      _fetchedForUserId = userId;
      if (userId != null) {
        unawaited(_loadActiveGame());
      } else if (_activeGame != null) {
        setState(() => _activeGame = null);
      }
    }
  }

  AuthController get _auth => TycoonAuthScope.of(context);

  Future<void> _loadActiveGame() async {
    if (_loadingActive) return;
    setState(() => _loadingActive = true);
    try {
      final active = await _gameApi.fetchActiveGame();
      if (!mounted) return;
      setState(() => _activeGame = active);
    } on ApiException {
      if (!mounted) return;
      setState(() => _activeGame = null);
    } catch (_) {
      if (!mounted) return;
      setState(() => _activeGame = null);
    } finally {
      if (mounted) setState(() => _loadingActive = false);
    }
  }

  Future<void> _onLetsGo() async {
    final signedIn = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
    if (signedIn == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Welcome, ${_auth.user?.username ?? 'tycoon'}!'),
        ),
      );
      await _loadActiveGame();
    }
  }

  void _onContinue() {
    final game = _activeGame;
    if (game == null) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => BoardScreen(
          gameCode: game.code,
          multiplayer: !game.isAi,
        ),
      ),
    ).then((_) {
      if (mounted) unawaited(_loadActiveGame());
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = _auth.user;
    final loggedIn = user != null;
    final screenHeight = MediaQuery.sizeOf(context).height;

    return SizedBox(
      height: screenHeight,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'assets/images/hero_bg.png',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) =>
                const ColoredBox(color: TycoonColors.background),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  TycoonColors.background.withValues(alpha: 0.4),
                  Colors.transparent,
                  TycoonColors.background.withValues(alpha: 0.9),
                ],
              ),
            ),
          ),
          const ScanlineOverlay(),
          SafeArea(
            child: Column(
              children: [
                const SizedBox(height: 48),
                Expanded(
                  child: SingleChildScrollView(
                    physics: const ClampingScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 32, 16, 120),
                    child: Column(
                      children: [
                        const NeonTitle(text: 'TYCOON', size: NeonTitleSize.md),
                        if (loggedIn) ...[
                          const SizedBox(height: 12),
                          Text(
                            'Welcome back, ${user.username}!',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: TycoonColors.cyan,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 400),
                          child: Text(
                            _taglines[_taglineIndex],
                            key: ValueKey<int>(_taglineIndex),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: TycoonColors.textWhite,
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Roll the dice • Buy properties • Collect rent •\n'
                          'Play against AI • Become the top tycoon',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: TycoonColors.textBody,
                            fontSize: 15,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 24),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 380),
                          child: Column(
                            children: [
                              if (!loggedIn) ...[
                                GlowButton(
                                  label: "Let's Go!",
                                  size: GlowButtonSize.lg,
                                  onPressed: _onLetsGo,
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Sign in with email · Add a wallet later in Profile if you want',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: TycoonColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Use the same email as your Tycoon web account.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: TycoonColors.textGray,
                                    fontSize: 14,
                                  ),
                                ),
                              ] else ...[
                                if (_activeGame != null) ...[
                                  GlowButton(
                                    label: 'Continue Game',
                                    icon: Icons.sports_esports,
                                    size: GlowButtonSize.lg,
                                    onPressed: _onContinue,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Resume ${_activeGame!.code}',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: TycoonColors.textMuted,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                ] else if (_loadingActive) ...[
                                  const Padding(
                                    padding: EdgeInsets.only(bottom: 16),
                                    child: SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: TycoonColors.cyan,
                                      ),
                                    ),
                                  ),
                                ],
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    SlantedButton(
                                      label: 'Multiplayer',
                                      icon: Icons.sports_esports_outlined,
                                      onTap: () => openAppRoute(
                                        context,
                                        AppRoutes.multiplayer,
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    SlantedButton(
                                      label: 'Join Room',
                                      icon: Icons.casino_outlined,
                                      onTap: () => openAppRoute(
                                        context,
                                        AppRoutes.joinRoom,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                GlowButton(
                                  label: 'Challenge AI',
                                  onPressed: () => openAppRoute(
                                    context,
                                    AppRoutes.playAi,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                GlowButton(
                                  label: 'Agent Battles',
                                  variant: GlowButtonVariant.secondary,
                                  onPressed: () => openAppRoute(
                                    context,
                                    AppRoutes.arena,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: WorldStatsBar(),
          ),
        ],
      ),
    );
  }
}
