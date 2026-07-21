import 'package:flutter/material.dart';
import 'package:tycoon/models/game_state.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class MonopolyBoardGrid extends StatelessWidget {
  const MonopolyBoardGrid({
    super.key,
    required this.squares,
    required this.players,
    required this.gameProperties,
    this.currentPlayerId,
    this.onSquareTap,
  });

  final List<BoardSquare> squares;
  final List<GamePlayerState> players;
  final List<GamePropertyState> gameProperties;
  final int? currentPlayerId;
  final ValueChanged<BoardSquare>? onSquareTap;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final cell = constraints.maxWidth / 11;
          return Stack(
            children: [
              Positioned(
                left: cell,
                top: cell,
                width: cell * 9,
                height: cell * 9,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF010F10),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.25)),
                  ),
                  child: const Center(
                    child: Text(
                      'TYCOON',
                      style: TextStyle(
                        color: TycoonColors.cyan,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 3,
                        fontSize: 18,
                      ),
                    ),
                  ),
                ),
              ),
              for (final square in squares)
                Positioned(
                  left: (square.gridCol - 1) * cell,
                  top: (square.gridRow - 1) * cell,
                  width: cell,
                  height: cell,
                  child: _SquareTile(
                    square: square,
                    owner: _ownerName(square.id),
                    development: _development(square.id),
                    mortgaged: _isMortgaged(square.id),
                    playersHere: _playersOn(square.id),
                    isCurrentTurn: _playersOn(square.id)
                        .any((p) => p.userId == currentPlayerId),
                    onTap: onSquareTap == null ? null : () => onSquareTap!(square),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  List<GamePlayerState> _playersOn(int position) {
    return players.where((p) => p.balance > 0 && p.position == position).toList();
  }

  String? _ownerName(int propertyId) {
    GamePropertyState? gp;
    for (final item in gameProperties) {
      if (item.propertyId == propertyId) {
        gp = item;
        break;
      }
    }
    if (gp == null) return null;
    for (final p in players) {
      if (p.address.toLowerCase() == gp.address.toLowerCase()) {
        return p.username;
      }
    }
    return null;
  }

  int _development(int propertyId) {
    for (final gp in gameProperties) {
      if (gp.propertyId == propertyId) return gp.development;
    }
    return 0;
  }

  bool _isMortgaged(int propertyId) {
    for (final gp in gameProperties) {
      if (gp.propertyId == propertyId) return gp.mortgaged;
    }
    return false;
  }
}

class _SquareTile extends StatelessWidget {
  const _SquareTile({
    required this.square,
    required this.playersHere,
    this.owner,
    this.development = 0,
    this.mortgaged = false,
    this.isCurrentTurn = false,
    this.onTap,
  });

  final BoardSquare square;
  final List<GamePlayerState> playersHere;
  final String? owner;
  final int development;
  final bool mortgaged;
  final bool isCurrentTurn;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isProperty = square.type == 'property';
    final groupColor = _colorForGroup(square.color);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.all(0.5),
        decoration: BoxDecoration(
          color: const Color(0xFF0B191A),
          border: Border.all(
            color: isCurrentTurn
                ? TycoonColors.cyan
                : TycoonColors.tealDark.withValues(alpha: 0.8),
            width: isCurrentTurn ? 1.5 : 0.5,
          ),
          borderRadius: BorderRadius.circular(2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (isProperty)
              Container(
                height: 6,
                decoration: BoxDecoration(
                  color: groupColor,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(1)),
                ),
              ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(1),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _shortName(square.name),
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TycoonColors.textBodyAlt,
                        fontSize: 6,
                        height: 1.05,
                      ),
                    ),
                    if (development > 0)
                      Text(
                        development >= 5 ? 'H' : '$development',
                        style: const TextStyle(
                          color: Colors.amber,
                          fontSize: 7,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    if (owner != null)
                      Text(
                        owner!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: TycoonColors.cyan.withValues(alpha: 0.7),
                          fontSize: 5,
                        ),
                      ),
                    if (mortgaged)
                      const Text('M', style: TextStyle(color: Colors.redAccent, fontSize: 6)),
                    if (playersHere.isNotEmpty)
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 1,
                        children: [
                          for (var i = 0; i < playersHere.length && i < 4; i++)
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: _playerColor(playersHere[i].userId),
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white24),
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _shortName(String name) {
    if (name.length <= 10) return name;
    return name.substring(0, 9);
  }

  Color _colorForGroup(String color) {
    return switch (color.toLowerCase()) {
      'brown' => const Color(0xFF8B4513),
      'lightblue' || 'light_blue' => const Color(0xFF87CEEB),
      'pink' => const Color(0xFFFF69B4),
      'orange' => const Color(0xFFFF8C00),
      'red' => const Color(0xFFDC143C),
      'yellow' => const Color(0xFFFFD700),
      'green' => const Color(0xFF228B22),
      'darkblue' || 'dark_blue' => const Color(0xFF00008B),
      _ => TycoonColors.tealDark,
    };
  }

  Color _playerColor(int userId) {
    const palette = [
      TycoonColors.cyan,
      Colors.purpleAccent,
      Colors.orangeAccent,
      Colors.lightGreenAccent,
      Colors.pinkAccent,
      Colors.amberAccent,
    ];
    return palette[userId.abs() % palette.length];
  }
}
