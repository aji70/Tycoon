import 'dart:math';

class DiceRoll {
  const DiceRoll({required this.die1, required this.die2});

  final int die1;
  final int die2;

  int get total => die1 + die2;
  bool get isDouble => die1 == die2;
}

DiceRoll rollDice() {
  final random = Random();
  return DiceRoll(
    die1: random.nextInt(6) + 1,
    die2: random.nextInt(6) + 1,
  );
}

const boardSquareCount = 40;

int advancePosition(int current, int steps) => (current + steps) % boardSquareCount;

bool isAiPlayerName(String username) {
  final u = username.toUpperCase();
  return u.startsWith('AI_') || u.contains('BOT') || u.contains('COMPUTER');
}
