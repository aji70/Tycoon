import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/models/ai_game_settings.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/services/api_client.dart';
import 'package:tycoon/services/game_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

/// Challenge AI setup — mirrors web `game-ai-3d-mobile.tsx`.
/// Uses backend guest create; wallet/on-chain UI is omitted for now.
class ChallengeAiScreen extends StatefulWidget {
  const ChallengeAiScreen({super.key});

  @override
  State<ChallengeAiScreen> createState() => _ChallengeAiScreenState();
}

class _ChallengeAiScreenState extends State<ChallengeAiScreen> {
  final _gameApi = GameApi();

  AiGameSettings _settings = const AiGameSettings();
  List<BoardVariant> _boardVariants = const [
    BoardVariant(id: 'default', name: 'Tycoon', region: 'Default'),
  ];
  bool _loadingVariants = true;
  bool _creating = false;
  String? _error;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    _loadBoardVariants();
  }

  Future<void> _loadBoardVariants() async {
    try {
      final variants = await _gameApi.fetchBoardVariants();
      if (!mounted) return;
      setState(() {
        _boardVariants = variants.isEmpty
            ? const [BoardVariant(id: 'default', name: 'Tycoon', region: 'Default')]
            : variants;
        _loadingVariants = false;
        if (!variants.any((v) => v.id == _settings.boardVariantId)) {
          _settings = _settings.copyWith(boardVariantId: variants.first.id);
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingVariants = false);
    }
  }

  Future<void> _play() async {
    if (!_auth.isLoggedIn) {
      await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      if (!mounted || !_auth.isLoggedIn) return;
    }

    setState(() {
      _creating = true;
      _error = null;
    });

    final code = generateGameCode();

    try {
      final result = await _gameApi.createAiGameMobile(_settings, code);
      if (!mounted) return;

      await Navigator.of(context).pushReplacement<void, void>(
        MaterialPageRoute<void>(
          builder: (_) => _GameCreatedScreen(
            gameCode: result.gameCode,
            aiCount: _settings.aiCount,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _creating = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _creating = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0E282A), Color(0xFF0F172A), Color(0xFF020617)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _Header(onBack: () => Navigator.of(context).pop()),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    _TwoColumnRow(
                      children: [
                        _SettingsCard(
                          title: 'Your Piece',
                          icon: Icons.person_outline,
                          gradient: const [Color(0x66164E63), Color(0x661E3A8A)],
                          child: _DropdownField<String>(
                            value: _settings.symbol,
                            items: gamePieces
                                .map((p) => DropdownMenuItem(value: p.$1, child: Text(p.$2)))
                                .toList(),
                            onChanged: _creating
                                ? null
                                : (v) => setState(
                                      () => _settings = _settings.copyWith(symbol: v),
                                    ),
                          ),
                        ),
                        _SettingsCard(
                          title: 'AI Opponents',
                          icon: Icons.smart_toy_outlined,
                          gradient: const [Color(0x66581C87), Color(0x669D174D)],
                          child: _DropdownField<int>(
                            value: _settings.aiCount,
                            items: List.generate(
                              6,
                              (i) => DropdownMenuItem(
                                value: i + 1,
                                child: Text('${i + 1} AI'),
                              ),
                            ),
                            onChanged: _creating
                                ? null
                                : (v) => setState(
                                      () => _settings = _settings.copyWith(aiCount: v),
                                    ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _TwoColumnRow(
                      children: [
                        _SettingsCard(
                          title: 'Starting Cash',
                          icon: Icons.payments_outlined,
                          gradient: const [Color(0x66134E4A), Color(0x66164E63)],
                          child: _DropdownField<int>(
                            value: _settings.startingCash,
                            items: startingCashOptions
                                .map(
                                  (n) => DropdownMenuItem(
                                    value: n,
                                    child: Text('\$$n'),
                                  ),
                                )
                                .toList(),
                            onChanged: _creating
                                ? null
                                : (v) => setState(
                                      () => _settings =
                                          _settings.copyWith(startingCash: v),
                                    ),
                          ),
                        ),
                        _SettingsCard(
                          title: 'Duration',
                          icon: Icons.timer_outlined,
                          gradient: const [Color(0x66312E81), Color(0x66581C87)],
                          child: _DropdownField<int>(
                            value: _settings.duration,
                            items: durationOptions
                                .map(
                                  (n) => DropdownMenuItem(
                                    value: n,
                                    child: Text(durationLabel(n)),
                                  ),
                                )
                                .toList(),
                            onChanged: _creating
                                ? null
                                : (v) => setState(
                                      () => _settings =
                                          _settings.copyWith(duration: v),
                                    ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _SettingsCard(
                      title: 'AI Difficulty',
                      icon: Icons.psychology_outlined,
                      gradient: const [Color(0x667F1D1D), Color(0x669A3412)],
                      fullWidth: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _DropdownField<AiDifficulty>(
                            value: _settings.aiDifficulty,
                            items: AiDifficulty.values
                                .map(
                                  (d) => DropdownMenuItem(
                                    value: d,
                                    child: Text(aiDifficultyLabel(d)),
                                  ),
                                )
                                .toList(),
                            onChanged: _creating
                                ? null
                                : (v) => setState(
                                      () => _settings =
                                          _settings.copyWith(aiDifficulty: v),
                                    ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Easy/Hard = rules. Tycoon Agent = LLM.',
                            style: TextStyle(
                              color: TycoonColors.cyan.withValues(alpha: 0.6),
                              fontSize: 11,
                            ),
                          ),
                          if (_settings.aiCount > 1) ...[
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                const Text(
                                  'Per opponent',
                                  style: TextStyle(
                                    color: TycoonColors.textBodyAlt,
                                    fontSize: 12,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  _settings.aiDifficultyMode ==
                                          AiDifficultyMode.random
                                      ? 'Randomize'
                                      : 'Same',
                                  style: const TextStyle(
                                    color: TycoonColors.textBodyAlt,
                                    fontSize: 12,
                                  ),
                                ),
                                Switch(
                                  value: _settings.aiDifficultyMode ==
                                      AiDifficultyMode.random,
                                  onChanged: _creating
                                      ? null
                                      : (v) => setState(
                                            () => _settings =
                                                _settings.copyWith(
                                              aiDifficultyMode: v
                                                  ? AiDifficultyMode.random
                                                  : AiDifficultyMode.same,
                                            ),
                                          ),
                                  activeThumbColor: TycoonColors.cyan,
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    // Blockchain: verified on-chain AI agents — disabled until native agents ship.
                    // const SizedBox(height: 12),
                    // _VerifiedAgentsCard(...),
                    const SizedBox(height: 12),
                    _SettingsCard(
                      title: 'Board theme',
                      icon: Icons.grid_view_outlined,
                      gradient: const [Color(0x661E293B), Color(0x660E7490)],
                      fullWidth: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _DropdownField<String>(
                            value: _settings.boardVariantId,
                            items: _boardVariants
                                .map(
                                  (v) => DropdownMenuItem(
                                    value: v.id,
                                    child: Text(v.label),
                                  ),
                                )
                                .toList(),
                            onChanged: (_creating || _loadingVariants)
                                ? null
                                : (v) => setState(
                                      () => _settings =
                                          _settings.copyWith(boardVariantId: v),
                                    ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Names only — rents, prices, and house costs stay the same.',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.45),
                              fontSize: 11,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _HouseRulesCard(
                      settings: _settings,
                      enabled: !_creating,
                      onChanged: (s) => setState(() => _settings = s),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 13,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _creating ? null : _play,
                      style: FilledButton.styleFrom(
                        backgroundColor: TycoonColors.cyan,
                        foregroundColor: TycoonColors.background,
                        minimumSize: const Size.fromHeight(52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        _creating ? 'Getting ready…' : "Let's Play!",
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (!_auth.isLoggedIn) ...[
                      const SizedBox(height: 12),
                      const Text(
                        'Sign in to start a game.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: TycoonColors.textMuted,
                          fontSize: 13,
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
    );
  }
}

class _GameCreatedScreen extends StatelessWidget {
  const _GameCreatedScreen({
    required this.gameCode,
    required this.aiCount,
  });

  final String gameCode;
  final int aiCount;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Game ready'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.check_circle_outline, color: TycoonColors.cyan, size: 56),
              const SizedBox(height: 20),
              Text(
                'Game $gameCode',
                style: const TextStyle(
                  color: TycoonColors.textWhite,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You vs $aiCount AI opponent${aiCount == 1 ? '' : 's'}',
                style: const TextStyle(color: TycoonColors.textMuted),
              ),
              const SizedBox(height: 16),
              const Text(
                'The 3D board is coming next in the app. Your game is saved on the server.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: TycoonColors.textBodyAlt,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 28),
              FilledButton(
                onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
                style: FilledButton.styleFrom(
                  backgroundColor: TycoonColors.cyan,
                  foregroundColor: TycoonColors.background,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: const Text('Back to Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Row(
        children: [
          TextButton.icon(
            onPressed: onBack,
            icon: const Icon(Icons.home_outlined, size: 18),
            label: const Text('Back'),
            style: TextButton.styleFrom(foregroundColor: TycoonColors.cyan),
          ),
          const Expanded(
            child: Text(
              'Play vs AI',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TycoonColors.cyan,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 72),
        ],
      ),
    );
  }
}

class _TwoColumnRow extends StatelessWidget {
  const _TwoColumnRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(width: 12),
          Expanded(child: children[i]),
        ],
      ],
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({
    required this.title,
    required this.icon,
    required this.gradient,
    required this.child,
    this.fullWidth = false,
  });

  final String title;
  final IconData icon;
  final List<Color> gradient;
  final Widget child;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: gradient),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: TycoonColors.cyan, size: 16),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: TycoonColors.cyan,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(0xCC1E293B),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.4)),
            ),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  const _DropdownField({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonHideUnderline(
      child: DropdownButton<T>(
        value: value,
        items: items,
        onChanged: onChanged,
        isExpanded: true,
        dropdownColor: const Color(0xFF1E293B),
        style: const TextStyle(color: TycoonColors.textWhite, fontSize: 13),
        borderRadius: BorderRadius.circular(8),
        padding: const EdgeInsets.symmetric(horizontal: 12),
      ),
    );
  }
}

class _HouseRulesCard extends StatelessWidget {
  const _HouseRulesCard({
    required this.settings,
    required this.enabled,
    required this.onChanged,
  });

  final AiGameSettings settings;
  final bool enabled;
  final ValueChanged<AiGameSettings> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0x991E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          const Text(
            'House Rules',
            style: TextStyle(
              color: TycoonColors.cyan,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _RuleSwitch(
            label: 'Auction Unsold',
            icon: Icons.gavel_outlined,
            value: settings.auction,
            enabled: enabled,
            onChanged: (v) => onChanged(settings.copyWith(auction: v)),
          ),
          _RuleSwitch(
            label: 'Rent in Jail',
            icon: Icons.lock_outline,
            value: settings.rentInPrison,
            enabled: enabled,
            onChanged: (v) => onChanged(settings.copyWith(rentInPrison: v)),
          ),
          _RuleSwitch(
            label: 'Mortgages',
            icon: Icons.account_balance_outlined,
            value: settings.mortgage,
            enabled: enabled,
            onChanged: (v) => onChanged(settings.copyWith(mortgage: v)),
          ),
          _RuleSwitch(
            label: 'Even Build',
            icon: Icons.home_work_outlined,
            value: settings.evenBuild,
            enabled: enabled,
            onChanged: (v) => onChanged(settings.copyWith(evenBuild: v)),
          ),
        ],
      ),
    );
  }
}

class _RuleSwitch extends StatelessWidget {
  const _RuleSwitch({
    required this.label,
    required this.icon,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final String label;
  final IconData icon;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: TycoonColors.cyan, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: TycoonColors.textBodyAlt, fontSize: 14),
            ),
          ),
          Switch(
            value: value,
            onChanged: enabled ? onChanged : null,
            activeThumbColor: TycoonColors.cyan,
          ),
        ],
      ),
    );
  }
}
