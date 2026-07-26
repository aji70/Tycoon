import 'package:tycoon/models/ai_game_settings.dart';
import 'package:tycoon/services/api_client.dart';

class CreateAiGameResult {
  const CreateAiGameResult({
    required this.gameId,
    required this.gameCode,
  });

  final String gameId;
  final String gameCode;
}

class ActiveGameSummary {
  const ActiveGameSummary({
    required this.code,
    required this.status,
    this.isAi = true,
  });

  final String code;
  final String status;
  final bool isAi;
}

class LobbyGame {
  const LobbyGame({
    required this.id,
    required this.code,
    required this.status,
    required this.mode,
    required this.maxPlayers,
    required this.playerCount,
    this.isAi = false,
    this.isCreator = false,
    this.players = const [],
  });

  final int id;
  final String code;
  final String status;
  final String mode;
  final int maxPlayers;
  final int playerCount;
  final bool isAi;
  final bool isCreator;
  final List<LobbyPlayer> players;

  bool get isPending => status.toUpperCase() == 'PENDING';
  bool get isRunning => status.toUpperCase() == 'RUNNING';

  factory LobbyGame.fromJson(Map<String, dynamic> json, {int? myUserId}) {
    int n(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    final playersRaw = json['players'];
    final players = playersRaw is List
        ? playersRaw
            .whereType<Map<String, dynamic>>()
            .map(LobbyPlayer.fromJson)
            .toList()
        : <LobbyPlayer>[];

    return LobbyGame(
      id: n(json['id']),
      code: json['code']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      mode: json['mode']?.toString() ?? 'PUBLIC',
      maxPlayers: n(json['number_of_players']),
      playerCount: players.isNotEmpty ? players.length : n(json['player_count']),
      isAi: json['is_ai'] == true || json['is_ai'] == 1,
      isCreator: myUserId != null && n(json['creator_id']) == myUserId,
      players: players,
    );
  }
}

class LobbyPlayer {
  const LobbyPlayer({
    required this.userId,
    required this.username,
    required this.symbol,
  });

  final int userId;
  final String username;
  final String symbol;

  factory LobbyPlayer.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    return LobbyPlayer(
      userId: n(json['user_id']),
      username: json['username']?.toString() ?? 'Player',
      symbol: json['symbol']?.toString() ?? 'hat',
    );
  }
}

class GameApi {
  GameApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  /// Most recent unfinished game for the signed-in user (Continue on home).
  Future<ActiveGameSummary?> fetchActiveGame() async {
    final body = await _client.getJson('/games/my-games?limit=50', auth: true);
    final data = body['data'];
    if (data is! List) return null;

    for (final raw in data) {
      if (raw is! Map<String, dynamic>) continue;
      final status = (raw['status']?.toString() ?? '').toUpperCase();
      if (status == 'FINISHED' ||
          status == 'COMPLETED' ||
          status == 'CANCELLED') {
        continue;
      }
      final code = raw['code']?.toString().trim() ?? '';
      if (code.isEmpty) continue;
      final isAi = raw['is_ai'] == true || raw['is_ai'] == 1;
      return ActiveGameSummary(code: code, status: status, isAi: isAi);
    }
    return null;
  }

  Future<List<LobbyGame>> fetchMyGames({int? myUserId}) async {
    final body = await _client.getJson('/games/my-games?limit=50', auth: true);
    final data = body['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map((j) => LobbyGame.fromJson(j, myUserId: myUserId))
        .where((g) {
          final s = g.status.toUpperCase();
          return s != 'FINISHED' && s != 'COMPLETED' && s != 'CANCELLED';
        })
        .toList();
  }

  Future<List<LobbyGame>> fetchOpenGames() async {
    final body = await _client.getJson('/games/open');
    final data = body['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(LobbyGame.fromJson)
        .toList();
  }

  Future<LobbyGame> fetchGameByCode(String code, {int? myUserId}) async {
    final body = await _client.getJson(
      '/games/code/${Uri.encodeComponent(code.trim().toUpperCase())}',
    );
    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw ApiException('Game not found');
    }
    return LobbyGame.fromJson(data, myUserId: myUserId);
  }

  Future<LobbyGame> joinMobile({
    required String code,
    String symbol = 'car',
    int? myUserId,
  }) async {
    final body = await _client.postJson(
      '/games/join-mobile',
      body: {'code': code.trim().toUpperCase(), 'symbol': symbol},
      auth: true,
    );
    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw ApiException(body['message']?.toString() ?? 'Join failed');
    }
    return LobbyGame.fromJson(data, myUserId: myUserId);
  }

  Future<LobbyGame> createMultiplayerMobile({
    required String code,
    required String symbol,
    required int maxPlayers,
    required bool privateRoom,
    required int startingCash,
    required int duration,
    required String boardId,
    bool auction = true,
    bool mortgage = true,
    bool evenBuild = true,
    bool rentInPrison = false,
    int? myUserId,
  }) async {
    final body = await _client.postJson(
      '/games/create-multiplayer-mobile',
      body: {
        'code': code,
        'symbol': symbol,
        'number_of_players': maxPlayers,
        'mode': privateRoom ? 'PRIVATE' : 'PUBLIC',
        'duration': duration,
        'chain': 'CELO',
        'board_id': boardId,
        'settings': {
          'auction': auction,
          'rent_in_prison': rentInPrison,
          'mortgage': mortgage,
          'even_build': evenBuild,
          'starting_cash': startingCash,
        },
      },
      auth: true,
    );
    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw ApiException(body['message']?.toString() ?? 'Create failed');
    }
    return LobbyGame.fromJson(data, myUserId: myUserId);
  }

  Future<LobbyGame> startMobile(int gameId, {int? myUserId}) async {
    final body = await _client.postJson(
      '/games/$gameId/start-mobile',
      auth: true,
    );
    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw ApiException(body['message']?.toString() ?? 'Start failed');
    }
    return LobbyGame.fromJson(data, myUserId: myUserId);
  }

  Future<List<BoardVariant>> fetchBoardVariants() async {
    final body = await _client.getJson('/board-variants');
    final data = body['data'];
    if (data is! List) {
      return const [BoardVariant(id: 'default', name: 'Tycoon', region: 'Default')];
    }

    return data
        .whereType<Map<String, dynamic>>()
        .map(BoardVariant.fromJson)
        .toList();
  }

  /// Mobile/offline AI create — DB only, no wallet or on-chain setup.
  Future<CreateAiGameResult> createAiGameMobile(
    AiGameSettings settings,
    String code,
  ) async {
    final body = await _client.postJson(
      '/games/create-ai-mobile',
      body: settings.toCreatePayload(code),
      auth: true,
    );

    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw ApiException('Backend did not return game data');
    }

    final id = data['id']?.toString();
    final gameCode = data['code']?.toString() ?? code;
    if (id == null || id.isEmpty) {
      throw ApiException('Backend did not return game ID');
    }

    return CreateAiGameResult(gameId: id, gameCode: gameCode);
  }
}
