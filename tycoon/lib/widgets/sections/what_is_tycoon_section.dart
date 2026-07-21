import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/game_badge.dart';
import 'package:tycoon/widgets/game_panel.dart';

class WhatIsTycoonSection extends StatelessWidget {
  const WhatIsTycoonSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: TycoonColors.background,
      padding: const EdgeInsets.fromLTRB(16, 48, 16, 48),
      child: GamePanel(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(
          children: [
            const GameBadge(label: 'RULEBOOK'),
            const SizedBox(height: 16),
            const Text(
              'What is Tycoon',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TycoonColors.textWhite,
                fontSize: 32,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.only(left: 24),
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(color: Color(0x8000F0FF), width: 2),
                ),
              ),
              child: const Text(
                'Tycoon is a fun digital board game where you collect tokens, '
                'trade with others, and complete challenges to win, all powered by blockchain.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: TycoonColors.textBodyAlt,
                  fontSize: 16,
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
