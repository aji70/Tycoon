import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/glow_button.dart';
import 'package:tycoon/widgets/world_stats_bar.dart';
import 'package:url_launcher/url_launcher.dart';

/// Native mobile home — logged-out: Let's Go → in-app Privy login; logged-in: play actions.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _taglines = [
    'Conquer',
    'Conquer • Build',
    'Conquer • Build • Trade',
    'Play Solo vs AI',
  ];

  int _taglineIndex = 0;
  Timer? _taglineTimer;

  @override
  void initState() {
    super.initState();
    _taglineTimer = Timer.periodic(const Duration(milliseconds: 2200), (_) {
      if (!mounted) return;
      setState(() => _taglineIndex = (_taglineIndex + 1) % _taglines.length);
    });
  }

  @override
  void dispose() {
    _taglineTimer?.cancel();
    super.dispose();
  }

  AuthController get _auth => TycoonAuthScope.of(context);

  Future<void> _openOnWeb(String path) async {
    final uri = AppConfig.path(path);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open $uri')),
      );
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _auth.user;
    final loggedIn = user != null;

    return Scaffold(
      backgroundColor: TycoonColors.background,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'assets/images/hero_bg.png',
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) =>
                const ColoredBox(color: TycoonColors.background),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  TycoonColors.background.withValues(alpha: 0.45),
                  Colors.transparent,
                  TycoonColors.background.withValues(alpha: 0.92),
                ],
              ),
            ),
          ),
          IgnorePointer(
            child: CustomPaint(
              painter: _ScanlinePainter(),
              size: Size.infinite,
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                if (loggedIn)
                  Align(
                    alignment: Alignment.topRight,
                    child: TextButton(
                      onPressed: () => _auth.signOut(),
                      child: const Text(
                        'Sign out',
                        style: TextStyle(color: TycoonColors.textMuted),
                      ),
                    ),
                  ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      children: [
                        const SizedBox(height: 24),
                        const _NeonTitle(text: 'TYCOON'),
                        const SizedBox(height: 20),
                        if (loggedIn) ...[
                          Text(
                            'Welcome back, ${user.username}!',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: TycoonColors.cyan,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
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
                        const SizedBox(height: 28),
                        if (!loggedIn) ...[
                          GlowButton(
                            label: "Let's Go!",
                            onPressed: _onLetsGo,
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Sign in with email · Add a wallet later in Profile',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: TycoonColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Sign in or connect your wallet to play.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: TycoonColors.textMuted,
                              fontSize: 13,
                            ),
                          ),
                        ] else ...[
                          Row(
                            children: [
                              Expanded(
                                child: _ActionChip(
                                  label: 'Multiplayer',
                                  icon: Icons.sports_esports_outlined,
                                  onTap: () => _openOnWeb('/game-settings-3d'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _ActionChip(
                                  label: 'Join Room',
                                  icon: Icons.casino_outlined,
                                  onTap: () => _openOnWeb('/join-room-3d'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          GlowButton(
                            label: 'Challenge AI',
                            icon: Icons.smart_toy_outlined,
                            onPressed: () => _openOnWeb('/play-ai-3d'),
                          ),
                          const SizedBox(height: 12),
                          GlowButton(
                            label: 'Agent Battles',
                            variant: GlowButtonVariant.secondary,
                            onPressed: () => _openOnWeb('/arena'),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Game screens open in browser until native boards ship.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: TycoonColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => _openOnWeb('/how-to-play'),
                          child: const Text(
                            'How to play',
                            style: TextStyle(color: TycoonColors.cyan),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const WorldStatsBar(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NeonTitle extends StatelessWidget {
  const _NeonTitle({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 48,
        fontWeight: FontWeight.w800,
        letterSpacing: 2,
        color: TycoonColors.cyan,
        shadows: [
          Shadow(
            color: TycoonColors.cyan.withValues(alpha: 0.9),
            blurRadius: 16,
          ),
          Shadow(
            color: TycoonColors.cyan.withValues(alpha: 0.5),
            blurRadius: 32,
          ),
        ],
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: TycoonColors.tealDark,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: TycoonColors.cyan, size: 18),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: TycoonColors.cyan,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScanlinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = TycoonColors.cyan.withValues(alpha: 0.03)
      ..strokeWidth = 1;
    for (var y = 0.0; y < size.height; y += 4) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
