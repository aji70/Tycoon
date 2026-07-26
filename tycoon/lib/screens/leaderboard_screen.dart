import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/services/user_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  final _api = UserApi();
  List<LeaderboardEntry> _entries = const [];
  bool _loading = true;
  String _period = 'all';
  String? _error;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _api.fetchLeaderboard(period: _period);
      if (!mounted) return;
      setState(() {
        _entries = list;
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

  @override
  Widget build(BuildContext context) {
    final me = _auth.user?.username.toLowerCase();

    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Leaderboard'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Row(
              children: [
                _PeriodChip(
                  label: 'All time',
                  selected: _period == 'all',
                  onTap: () {
                    setState(() => _period = 'all');
                    _load();
                  },
                ),
                const SizedBox(width: 8),
                _PeriodChip(
                  label: 'This month',
                  selected: _period == 'month',
                  onTap: () {
                    setState(() => _period = 'month');
                    _load();
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: TycoonColors.cyan))
                : _error != null
                    ? Center(
                        child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                      )
                    : RefreshIndicator(
                        color: TycoonColors.cyan,
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          itemCount: _entries.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final e = _entries[i];
                            final isMe = me != null && e.username.toLowerCase() == me;
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: isMe
                                    ? TycoonColors.cyan.withValues(alpha: 0.12)
                                    : TycoonColors.panel,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isMe
                                      ? TycoonColors.cyan.withValues(alpha: 0.5)
                                      : TycoonColors.tealDark,
                                ),
                              ),
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: 36,
                                    child: Text(
                                      '#${i + 1}',
                                      style: TextStyle(
                                        color: i < 3 ? TycoonColors.cyan : TycoonColors.textMuted,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(
                                      e.username,
                                      style: const TextStyle(
                                        color: TycoonColors.textWhite,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    '${e.gamesPlayed} played',
                                    style: const TextStyle(
                                      color: TycoonColors.textMuted,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    '${e.gamesWon}W',
                                    style: const TextStyle(
                                      color: TycoonColors.cyan,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _PeriodChip extends StatelessWidget {
  const _PeriodChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? TycoonColors.cyan : TycoonColors.panel,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.4)),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? TycoonColors.background : TycoonColors.cyan,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
