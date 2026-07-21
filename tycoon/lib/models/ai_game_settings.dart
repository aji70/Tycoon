import 'dart:math';

class BoardVariant {
  const BoardVariant({
    required this.id,
    required this.name,
    required this.region,
    this.description,
  });

  final String id;
  final String name;
  final String region;
  final String? description;

  factory BoardVariant.fromJson(Map<String, dynamic> json) {
    return BoardVariant(
      id: json['id']?.toString() ?? 'default',
      name: json['name']?.toString() ?? 'Tycoon',
      region: json['region']?.toString() ?? '',
      description: json['description']?.toString(),
    );
  }

  String get label => region.isEmpty ? name : '$name · $region';
}

enum AiDifficulty { easy, hard, boss }

enum AiDifficultyMode { same, random }

class AiGameSettings {
  const AiGameSettings({
    this.symbol = 'hat',
    this.aiCount = 1,
    this.startingCash = 1500,
    this.aiDifficulty = AiDifficulty.easy,
    this.aiDifficultyMode = AiDifficultyMode.same,
    this.auction = true,
    this.rentInPrison = false,
    this.mortgage = true,
    this.evenBuild = true,
    this.duration = 30,
    this.boardVariantId = 'default',
  });

  final String symbol;
  final int aiCount;
  final int startingCash;
  final AiDifficulty aiDifficulty;
  final AiDifficultyMode aiDifficultyMode;
  final bool auction;
  final bool rentInPrison;
  final bool mortgage;
  final bool evenBuild;
  final int duration;
  final String boardVariantId;

  int get totalPlayers => aiCount + 1;

  AiGameSettings copyWith({
    String? symbol,
    int? aiCount,
    int? startingCash,
    AiDifficulty? aiDifficulty,
    AiDifficultyMode? aiDifficultyMode,
    bool? auction,
    bool? rentInPrison,
    bool? mortgage,
    bool? evenBuild,
    int? duration,
    String? boardVariantId,
  }) {
    return AiGameSettings(
      symbol: symbol ?? this.symbol,
      aiCount: aiCount ?? this.aiCount,
      startingCash: startingCash ?? this.startingCash,
      aiDifficulty: aiDifficulty ?? this.aiDifficulty,
      aiDifficultyMode: aiDifficultyMode ?? this.aiDifficultyMode,
      auction: auction ?? this.auction,
      rentInPrison: rentInPrison ?? this.rentInPrison,
      mortgage: mortgage ?? this.mortgage,
      evenBuild: evenBuild ?? this.evenBuild,
      duration: duration ?? this.duration,
      boardVariantId: boardVariantId ?? this.boardVariantId,
    );
  }

  Map<String, dynamic> toCreatePayload(String code) {
    return {
      'code': code,
      'symbol': symbol,
      'number_of_players': totalPlayers,
      'duration': duration,
      'chain': 'CELO',
      'board_id': boardVariantId,
      'ai_difficulty': aiDifficulty.name,
      'ai_difficulty_mode':
          aiDifficultyMode == AiDifficultyMode.same ? 'same' : 'random',
      'settings': {
        'auction': auction,
        'rent_in_prison': rentInPrison,
        'mortgage': mortgage,
        'even_build': evenBuild,
        'starting_cash': startingCash,
      },
    };
  }
}

const gamePieces = [
  ('car', 'CAR'),
  ('dog', 'DOG'),
  ('hat', 'HAT'),
  ('thimble', 'THIMBLE'),
  ('wheelbarrow', 'WHEELBARROW'),
  ('battleship', 'BATTLESHIP'),
  ('boot', 'BOOT'),
  ('iron', 'IRON'),
  ('top_hat', 'TOP HAT'),
];

const startingCashOptions = [500, 1000, 1500, 2000];
const durationOptions = [30, 45, 60, 90, 0];

String generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final random = Random();
  return List.generate(6, (_) => chars[random.nextInt(chars.length)]).join();
}

String aiDifficultyLabel(AiDifficulty d) => switch (d) {
      AiDifficulty.easy => 'Easy — simple rules',
      AiDifficulty.hard => 'Hard — stricter rules',
      AiDifficulty.boss => 'Tycoon Agent',
    };

String durationLabel(int minutes) =>
    minutes == 0 ? 'No limit' : '${minutes}m';
