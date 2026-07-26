import 'package:tycoon/services/api_client.dart';

class UserStats {
  const UserStats({
    required this.username,
    required this.address,
    this.gamesPlayed = 0,
    this.gamesWon = 0,
    this.gamesLost = 0,
    this.totalStaked = 0,
    this.totalEarned = 0,
    this.propertiesBought = 0,
  });

  final String username;
  final String address;
  final int gamesPlayed;
  final int gamesWon;
  final int gamesLost;
  final int totalStaked;
  final int totalEarned;
  final int propertiesBought;

  double get winRate =>
      gamesPlayed <= 0 ? 0 : (gamesWon / gamesPlayed) * 100;

  factory UserStats.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    final played = n(json['celo_games_played'] ?? json['games_played']);
    final won = n(json['celo_game_won'] ?? json['game_won']);
    final lost = n(json['celo_game_lost'] ?? json['game_lost']);

    return UserStats(
      username: json['username']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      gamesPlayed: played,
      gamesWon: won,
      gamesLost: lost,
      totalStaked: n(json['total_staked']),
      totalEarned: n(json['total_earned']),
      propertiesBought: n(json['properties_bought']),
    );
  }
}

class LeaderboardEntry {
  const LeaderboardEntry({
    required this.id,
    required this.username,
    required this.gamesPlayed,
    this.gamesWon = 0,
  });

  final int id;
  final String username;
  final int gamesPlayed;
  final int gamesWon;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    return LeaderboardEntry(
      id: n(json['id']),
      username: json['username']?.toString() ?? 'Player',
      gamesPlayed: n(json['games_played']),
      gamesWon: n(json['game_won']),
    );
  }
}

class ReferralInfo {
  const ReferralInfo({
    required this.referralCode,
    this.directReferralsCount = 0,
    this.shareQuery = '',
  });

  final String referralCode;
  final int directReferralsCount;
  final String shareQuery;
}

class UserApi {
  UserApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<UserStats?> fetchStatsByAddress(String address) async {
    if (address.trim().isEmpty) return null;
    try {
      final body = await _client.getJson(
        '/users/by-address/${Uri.encodeComponent(address.trim())}?chain=CELO',
      );
      // Endpoint may return {data: user} or raw user.
      final data = body['data'] is Map<String, dynamic>
          ? body['data'] as Map<String, dynamic>
          : body;
      if (data['username'] == null && data['address'] == null) return null;
      return UserStats.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  Future<List<LeaderboardEntry>> fetchLeaderboard({
    String period = 'all',
    int limit = 50,
  }) async {
    final body = await _client.getJson(
      '/users/leaderboard?chain=CELO&type=played&period=$period&limit=$limit',
    );

    List raw;
    final data = body['data'];
    if (data is List) {
      raw = data;
    } else if (data is Map && data['data'] is List) {
      raw = data['data'] as List;
    } else {
      raw = const [];
    }

    return raw
        .whereType<Map<String, dynamic>>()
        .map(LeaderboardEntry.fromJson)
        .where((e) => !e.username.toUpperCase().contains('AI_'))
        .toList();
  }

  Future<ReferralInfo?> fetchReferral() async {
    try {
      final body = await _client.getJson('/referral/me', auth: true);
      final data = body['data'];
      if (data is! Map<String, dynamic>) return null;
      return ReferralInfo(
        referralCode: data['referralCode']?.toString() ?? '',
        directReferralsCount: data['directReferralsCount'] is int
            ? data['directReferralsCount'] as int
            : int.tryParse('${data['directReferralsCount']}') ?? 0,
        shareQuery: data['shareQuery']?.toString() ?? '',
      );
    } catch (_) {
      return null;
    }
  }
}
