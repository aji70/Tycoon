import 'package:tycoon/models/game_state.dart';
import 'package:tycoon/services/api_client.dart';

class GamePlayApi {
  GamePlayApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<GameSnapshot> fetchGameByCode(String code) async {
    final body = await _client.getJson('/games/code/${code.trim().toUpperCase()}');
    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw ApiException('Invalid game response');
    }
    return GameSnapshot.fromJson(data);
  }

  Future<List<BoardSquare>> fetchBoardSquares(String boardId) async {
    final body = await _client.getJson(
      '/properties?board_id=${Uri.encodeComponent(boardId)}',
    );
    final data = body['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(BoardSquare.fromJson)
        .toList();
  }

  Future<List<GamePropertyState>> fetchGameProperties(int gameId) async {
    final body = await _client.getJson('/game-properties/game/$gameId');
    final data = body['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(GamePropertyState.fromJson)
        .toList();
  }

  Future<MoveResult> changePosition({
    required int userId,
    required int gameId,
    required int position,
    required int rolled,
    bool isDouble = false,
  }) async {
    final body = await _client.postJson(
      '/game-players/change-position',
      body: {
        'user_id': userId,
        'game_id': gameId,
        'position': position,
        'rolled': rolled,
        'is_double': isDouble,
      },
      auth: true,
    );
    return MoveResult.fromResponse(body);
  }

  Future<void> buyProperty({
    required int userId,
    required int gameId,
    required int propertyId,
  }) async {
    await _client.postJson(
      '/game-properties/buy',
      body: {
        'user_id': userId,
        'game_id': gameId,
        'property_id': propertyId,
      },
      auth: true,
    );
  }

  Future<void> endTurn({
    required int userId,
    required int gameId,
  }) async {
    await _client.postJson(
      '/game-players/end-turn',
      body: {
        'user_id': userId,
        'game_id': gameId,
      },
      auth: true,
    );
  }

  Future<void> stayInJail({
    required int userId,
    required int gameId,
  }) async {
    await _client.postJson(
      '/game-players/stay-in-jail',
      body: {
        'user_id': userId,
        'game_id': gameId,
      },
      auth: true,
    );
  }
}
