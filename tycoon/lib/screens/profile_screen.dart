import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/services/user_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = UserApi();
  UserStats? _stats;
  ReferralInfo? _referral;
  bool _loading = true;
  String? _error;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = _auth.user;
    if (user == null) {
      setState(() {
        _loading = false;
        _error = 'Sign in to view your profile';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final stats = await _api.fetchStatsByAddress(user.address);
      final referral = await _api.fetchReferral();
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _referral = referral;
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

  Future<void> _signIn() async {
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
    if (ok == true && mounted) _load();
  }

  Future<void> _signOut() async {
    await _auth.signOut();
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  String _shortAddress(String a) {
    if (a.length < 12) return a;
    return '${a.substring(0, 6)}…${a.substring(a.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    final user = _auth.user;

    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Profile'),
        actions: [
          if (user != null)
            IconButton(
              onPressed: _signOut,
              icon: const Icon(Icons.logout),
              tooltip: 'Sign out',
            ),
        ],
      ),
      body: user == null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Sign in to view your profile',
                    style: TextStyle(color: TycoonColors.textMuted),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _signIn,
                    style: FilledButton.styleFrom(
                      backgroundColor: TycoonColors.cyan,
                      foregroundColor: TycoonColors.background,
                    ),
                    child: const Text('Sign in'),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              color: TycoonColors.cyan,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  _HeaderCard(
                    username: user.username,
                    email: user.email,
                    address: _shortAddress(user.address),
                  ),
                  const SizedBox(height: 16),
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                        child: CircularProgressIndicator(color: TycoonColors.cyan),
                      ),
                    )
                  else ...[
                    if (_error != null)
                      Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                    _StatsGrid(stats: _stats),
                    const SizedBox(height: 16),
                    if (_referral != null && _referral!.referralCode.isNotEmpty)
                      _ReferralCard(info: _referral!),
                  ],
                ],
              ),
            ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.username,
    required this.address,
    this.email,
  });

  final String username;
  final String address;
  final String? email;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: TycoonColors.panel,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: TycoonColors.tealDark,
            child: Text(
              username.isNotEmpty ? username[0].toUpperCase() : '?',
              style: const TextStyle(
                color: TycoonColors.cyan,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  username,
                  style: const TextStyle(
                    color: TycoonColors.textWhite,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (email != null && email!.isNotEmpty)
                  Text(email!, style: const TextStyle(color: TycoonColors.textMuted, fontSize: 13)),
                Text(address, style: const TextStyle(color: TycoonColors.cyan, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({this.stats});

  final UserStats? stats;

  @override
  Widget build(BuildContext context) {
    final s = stats;
    final items = [
      ('Played', '${s?.gamesPlayed ?? 0}'),
      ('Won', '${s?.gamesWon ?? 0}'),
      ('Lost', '${s?.gamesLost ?? 0}'),
      ('Win %', s == null ? '—' : '${s.winRate.toStringAsFixed(0)}%'),
      ('Bought', '${s?.propertiesBought ?? 0}'),
      ('Earned', '\$${s?.totalEarned ?? 0}'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Stats',
          style: TextStyle(
            color: TycoonColors.cyan,
            fontWeight: FontWeight.w700,
            fontSize: 14,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.2,
          children: [
            for (final item in items)
              Container(
                decoration: BoxDecoration(
                  color: TycoonColors.panel,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: TycoonColors.tealDark),
                ),
                padding: const EdgeInsets.all(10),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      item.$2,
                      style: const TextStyle(
                        color: TycoonColors.textWhite,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.$1,
                      style: const TextStyle(color: TycoonColors.textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _ReferralCard extends StatelessWidget {
  const _ReferralCard({required this.info});

  final ReferralInfo info;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: TycoonColors.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Referral',
            style: TextStyle(color: TycoonColors.cyan, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  info.referralCode,
                  style: const TextStyle(
                    color: TycoonColors.textWhite,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                  ),
                ),
              ),
              IconButton(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: info.referralCode));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Referral code copied')),
                  );
                },
                icon: const Icon(Icons.copy, color: TycoonColors.cyan),
              ),
            ],
          ),
          Text(
            '${info.directReferralsCount} direct referrals',
            style: const TextStyle(color: TycoonColors.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
