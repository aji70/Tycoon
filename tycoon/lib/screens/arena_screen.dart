import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/screens/web_app_screen.dart';
import 'package:tycoon/services/arena_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class ArenaScreen extends StatefulWidget {
  const ArenaScreen({super.key});

  @override
  State<ArenaScreen> createState() => _ArenaScreenState();
}

class _ArenaScreenState extends State<ArenaScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final _api = ArenaApi();

  List<ArenaAgent> _leaderboard = const [];
  List<ArenaAgent> _agents = const [];
  List<MyAgent> _mine = const [];
  bool _loading = true;
  String? _error;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final lb = await _api.fetchLeaderboard();
      final agents = await _api.fetchPublicAgents();
      List<MyAgent> mine = const [];
      if (_auth.isLoggedIn) {
        try {
          mine = await _api.fetchMyAgents();
        } catch (_) {
          mine = const [];
        }
      }
      if (!mounted) return;
      setState(() {
        _leaderboard = lb;
        _agents = agents;
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

  Future<void> _ensureAuth() async {
    if (_auth.isLoggedIn) return;
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
    if (ok == true && mounted) await _load();
  }

  Future<void> _createAgent() async {
    await _ensureAuth();
    if (!_auth.isLoggedIn || !mounted) return;

    final nameCtrl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: TycoonColors.panel,
        title: const Text('Create agent', style: TextStyle(color: TycoonColors.cyan)),
        content: TextField(
          controller: nameCtrl,
          autofocus: true,
          style: const TextStyle(color: TycoonColors.textWhite),
          decoration: const InputDecoration(
            hintText: 'Agent name',
            hintStyle: TextStyle(color: TycoonColors.textMuted),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, nameCtrl.text.trim()),
            child: const Text('Create', style: TextStyle(color: TycoonColors.cyan)),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
    if (name == null || name.isEmpty || !mounted) return;

    try {
      await _api.createAgent(name);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Created $name')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  void _openOnchainArena() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const WebAppScreen(
          title: 'On-chain Arena',
          path: '/arena',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Agents'),
        actions: [
          IconButton(
            tooltip: 'On-chain challenges',
            onPressed: _openOnchainArena,
            icon: const Icon(Icons.open_in_browser),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: TycoonColors.cyan,
          labelColor: TycoonColors.cyan,
          unselectedLabelColor: TycoonColors.textMuted,
          tabs: const [
            Tab(text: 'Rankings'),
            Tab(text: 'Browse'),
            Tab(text: 'Mine'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createAgent,
        backgroundColor: TycoonColors.cyan,
        foregroundColor: TycoonColors.background,
        icon: const Icon(Icons.add),
        label: const Text('New agent'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: TycoonColors.cyan))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : TabBarView(
                  controller: _tabs,
                  children: [
                    _AgentList(
                      agents: _leaderboard,
                      showRank: true,
                      onRefresh: _load,
                      empty: 'No ranked agents yet',
                    ),
                    _AgentList(
                      agents: _agents,
                      onRefresh: _load,
                      empty: 'No public agents',
                      onTap: (a) => _showAgentSheet(a),
                    ),
                    _MyAgentsList(
                      agents: _mine,
                      signedIn: _auth.isLoggedIn,
                      onRefresh: _load,
                      onSignIn: _ensureAuth,
                      onCreate: _createAgent,
                      onChallengeHint: _openOnchainArena,
                    ),
                  ],
                ),
    );
  }

  void _showAgentSheet(ArenaAgent a) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: TycoonColors.panel,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                a.name,
                style: const TextStyle(
                  color: TycoonColors.cyanBright,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'by ${a.username.isEmpty ? 'unknown' : a.username}',
                style: const TextStyle(color: TycoonColors.textMuted),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  _StatChip(label: 'ELO', value: '${a.eloRating}'),
                  _StatChip(label: 'Record', value: a.record),
                  if (a.tier.isNotEmpty) _StatChip(label: 'Tier', value: a.tier),
                  _StatChip(
                    label: 'Win rate',
                    value: '${a.winRatePct.toStringAsFixed(0)}%',
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Text(
                'On-chain arena matches need a delivery wallet. '
                'Open the full arena to challenge this agent.',
                style: TextStyle(color: TycoonColors.textBody, height: 1.4),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _openOnchainArena();
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: TycoonColors.cyan,
                    foregroundColor: TycoonColors.background,
                  ),
                  child: const Text('Open challenge flow'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: TycoonColors.darkAccent,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: TycoonColors.tealDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: TycoonColors.textMuted, fontSize: 11)),
          Text(value, style: const TextStyle(color: TycoonColors.textWhite, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _AgentList extends StatelessWidget {
  const _AgentList({
    required this.agents,
    required this.onRefresh,
    required this.empty,
    this.showRank = false,
    this.onTap,
  });

  final List<ArenaAgent> agents;
  final Future<void> Function() onRefresh;
  final String empty;
  final bool showRank;
  final void Function(ArenaAgent)? onTap;

  @override
  Widget build(BuildContext context) {
    if (agents.isEmpty) {
      return Center(
        child: Text(empty, style: const TextStyle(color: TycoonColors.textMuted)),
      );
    }
    return RefreshIndicator(
      color: TycoonColors.cyan,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
        itemCount: agents.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final a = agents[i];
          final rank = a.rank ?? (i + 1);
          return Material(
            color: TycoonColors.panel,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: onTap == null ? null : () => onTap!(a),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: TycoonColors.tealDark),
                ),
                child: Row(
                  children: [
                    if (showRank)
                      SizedBox(
                        width: 32,
                        child: Text(
                          '#$rank',
                          style: const TextStyle(
                            color: TycoonColors.cyan,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            a.name,
                            style: const TextStyle(
                              color: TycoonColors.textWhite,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            a.username.isEmpty ? a.record : '${a.username} · ${a.record}',
                            style: const TextStyle(
                              color: TycoonColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${a.eloRating}',
                          style: const TextStyle(
                            color: TycoonColors.cyanBright,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (a.tier.isNotEmpty)
                          Text(
                            a.tier,
                            style: const TextStyle(
                              color: TycoonColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MyAgentsList extends StatelessWidget {
  const _MyAgentsList({
    required this.agents,
    required this.signedIn,
    required this.onRefresh,
    required this.onSignIn,
    required this.onCreate,
    required this.onChallengeHint,
  });

  final List<MyAgent> agents;
  final bool signedIn;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onSignIn;
  final VoidCallback onCreate;
  final VoidCallback onChallengeHint;

  @override
  Widget build(BuildContext context) {
    if (!signedIn) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Sign in to manage your agents',
              style: TextStyle(color: TycoonColors.textMuted),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onSignIn,
              style: FilledButton.styleFrom(
                backgroundColor: TycoonColors.cyan,
                foregroundColor: TycoonColors.background,
              ),
              child: const Text('Sign in'),
            ),
          ],
        ),
      );
    }
    if (agents.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'No agents yet',
              style: TextStyle(color: TycoonColors.textMuted),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: onCreate,
              child: const Text('Create your first agent'),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      color: TycoonColors.cyan,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
        itemCount: agents.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          if (i == 0) {
            return const Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Text(
                'Create agents here. On-chain challenges open in the full arena.',
                style: TextStyle(color: TycoonColors.textMuted, fontSize: 13, height: 1.35),
              ),
            );
          }
          final a = agents[i - 1];
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: TycoonColors.panel,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: TycoonColors.tealDark),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        a.name,
                        style: const TextStyle(
                          color: TycoonColors.textWhite,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '${a.record} · ELO ${a.eloRating}',
                        style: const TextStyle(
                          color: TycoonColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: onChallengeHint,
                  child: const Text('Challenge'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
