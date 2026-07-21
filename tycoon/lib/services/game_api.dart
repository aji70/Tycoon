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

class GameApi {
  GameApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

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
