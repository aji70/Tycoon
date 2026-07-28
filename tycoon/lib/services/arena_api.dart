import 'package:tycoon/services/api_client.dart';

class ArenaAgent {
  const ArenaAgent({
    required this.id,
    required this.name,
    required this.username,
    required this.eloRating,
    this.record = '',
    this.tier = '',
    this.winRatePct = 0,
    this.totalGames = 0,
    this.rank,
  });

  final int id;
  final String name;
  final String username;
  final int eloRating;
  final String record;
  final String tier;
  final double winRatePct;
  final int totalGames;
  final int? rank;

  factory ArenaAgent.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    double d(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse(v?.toString() ?? '') ?? 0;
    }

    return ArenaAgent(
      id: n(json['id']),
      name: json['name']?.toString() ?? 'Agent',
      username: json['username']?.toString() ?? '',
      eloRating: n(json['elo_rating']),
      record: json['record']?.toString() ??
          '${n(json['arena_wins'])}W-${n(json['arena_losses'])}L',
      tier: json['tier']?.toString() ?? '',
      winRatePct: d(json['win_rate_pct'] ?? json['win_rate']),
      totalGames: n(json['total_games']),
      rank: json['rank'] == null ? null : n(json['rank']),
    );
  }
}

class MyAgent {
  const MyAgent({
    required this.id,
    required this.name,
    required this.eloRating,
    this.record = '',
    this.isPublic = false,
  });

  final int id;
  final String name;
  final int eloRating;
  final String record;
  final bool isPublic;

  factory MyAgent.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    return MyAgent(
      id: n(json['id']),
      name: json['name']?.toString() ?? 'Agent',
      eloRating: n(json['elo_rating']),
      record: json['record']?.toString() ??
          '${n(json['arena_wins'])}W-${n(json['arena_losses'])}L',
      isPublic: json['is_public'] == true || json['is_public'] == 1,
    );
  }
}

class ArenaApi {
  ArenaApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<ArenaAgent>> fetchLeaderboard({int limit = 50}) async {
    final body = await _client.getJson('/api/arena/leaderboard?limit=$limit');
    final list = body['leaderboard'] as List? ?? body['data'] as List? ?? const [];
    return list
        .whereType<Map>()
        .map((e) => ArenaAgent.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<ArenaAgent>> fetchPublicAgents({
    int page = 1,
    int pageSize = 40,
  }) async {
    final body = await _client.getJson(
      '/api/arena/agents?page=$page&page_size=$pageSize',
      auth: true,
    );
    final list = body['agents'] as List? ?? body['data'] as List? ?? const [];
    return list
        .whereType<Map>()
        .map((e) => ArenaAgent.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<MyAgent>> fetchMyAgents() async {
    final body = await _client.getJson('/api/agents', auth: true);
    final list = body['data'] as List? ?? const [];
    return list
        .whereType<Map>()
        .map((e) => MyAgent.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<MyAgent> createAgent(String name) async {
    final body = await _client.postJson(
      '/api/agents',
      auth: true,
      body: {'name': name.trim(), 'use_tycoon_key': true},
    );
    final data = body['data'];
    if (data is! Map) {
      throw ApiException('Failed to create agent');
    }
    return MyAgent.fromJson(Map<String, dynamic>.from(data));
  }
}
