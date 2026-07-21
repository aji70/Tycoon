class BoardSquare {
  const BoardSquare({
    required this.id,
    required this.name,
    required this.type,
    required this.gridRow,
    required this.gridCol,
    this.price = 0,
    this.color = '',
  });

  final int id;
  final String name;
  final String type;
  final int gridRow;
  final int gridCol;
  final int price;
  final String color;

  factory BoardSquare.fromJson(Map<String, dynamic> json) {
    return BoardSquare(
      id: _asInt(json['id']),
      name: json['name']?.toString() ?? '',
      type: json['type']?.toString() ?? 'property',
      gridRow: _asInt(json['grid_row'], fallback: 1),
      gridCol: _asInt(json['grid_col'], fallback: 1),
      price: _asInt(json['price']),
      color: json['color']?.toString() ?? '',
    );
  }

  static int _asInt(dynamic v, {int fallback = 0}) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '') ?? fallback;
  }
}

class GamePropertyState {
  const GamePropertyState({
    required this.propertyId,
    required this.address,
    this.development = 0,
    this.mortgaged = false,
  });

  final int propertyId;
  final String address;
  final int development;
  final bool mortgaged;

  factory GamePropertyState.fromJson(Map<String, dynamic> json) {
    return GamePropertyState(
      propertyId: BoardSquare._asInt(json['property_id']),
      address: json['address']?.toString() ?? '',
      development: BoardSquare._asInt(json['development']),
      mortgaged: json['mortgaged'] == true || json['mortgaged'] == 1,
    );
  }
}

class GamePlayerState {
  const GamePlayerState({
    required this.userId,
    required this.username,
    required this.symbol,
    required this.address,
    required this.balance,
    required this.position,
    this.inJail = false,
  });

  final int userId;
  final String username;
  final String symbol;
  final String address;
  final int balance;
  final int position;
  final bool inJail;

  factory GamePlayerState.fromJson(Map<String, dynamic> json) {
    return GamePlayerState(
      userId: BoardSquare._asInt(json['user_id']),
      username: json['username']?.toString() ?? 'Player',
      symbol: json['symbol']?.toString() ?? 'hat',
      address: json['address']?.toString() ?? '',
      balance: BoardSquare._asInt(json['balance']),
      position: BoardSquare._asInt(json['position']),
      inJail: json['in_jail'] == true || json['in_jail'] == 1,
    );
  }
}

class GameSnapshot {
  const GameSnapshot({
    required this.id,
    required this.code,
    required this.status,
    required this.nextPlayerId,
    required this.boardId,
    required this.players,
    this.winnerId,
  });

  final int id;
  final String code;
  final String status;
  final int? nextPlayerId;
  final String boardId;
  final List<GamePlayerState> players;
  final int? winnerId;

  bool get isFinished => status.toUpperCase() == 'FINISHED';

  factory GameSnapshot.fromJson(Map<String, dynamic> json) {
    final playersRaw = json['players'];
    final players = playersRaw is List
        ? playersRaw
            .whereType<Map<String, dynamic>>()
            .map(GamePlayerState.fromJson)
            .toList()
        : <GamePlayerState>[];

    return GameSnapshot(
      id: BoardSquare._asInt(json['id']),
      code: json['code']?.toString() ?? '',
      status: json['status']?.toString() ?? 'RUNNING',
      nextPlayerId: json['next_player_id'] == null
          ? null
          : BoardSquare._asInt(json['next_player_id']),
      boardId: json['board_id']?.toString() ?? 'default',
      players: players,
      winnerId: json['winner_id'] == null
          ? null
          : BoardSquare._asInt(json['winner_id']),
    );
  }
}

class MoveResult {
  const MoveResult({
    required this.success,
    this.message,
    this.requiresBuy = false,
    this.propertyForBuy,
    this.card,
    this.stillInJail = false,
  });

  final bool success;
  final String? message;
  final bool requiresBuy;
  final int? propertyForBuy;
  final Map<String, dynamic>? card;
  final bool stillInJail;

  factory MoveResult.fromResponse(Map<String, dynamic> body) {
    final data = body['data'];
    final map = data is Map<String, dynamic> ? data : body;
    return MoveResult(
      success: body['success'] == true,
      message: body['message']?.toString(),
      requiresBuy: map['requires_buy'] == true,
      propertyForBuy: map['property_for_buy'] == null
          ? null
          : BoardSquare._asInt(map['property_for_buy']),
      card: map['card'] is Map<String, dynamic>
          ? map['card'] as Map<String, dynamic>
          : null,
      stillInJail: map['still_in_jail'] == true,
    );
  }
}
