import 'package:flutter/material.dart';
import 'package:tycoon/navigation/app_navigator.dart';
import 'package:tycoon/navigation/app_routes.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class HowToPlayScreen extends StatelessWidget {
  const HowToPlayScreen({super.key});

  static const _sections = <(String, String)>[
    (
      'Overview',
      'Tycoon is a Monopoly-style board game. Roll the dice, buy properties, '
          'collect rent, build houses and hotels, and bankrupt your opponents to win.'
    ),
    (
      'Setup',
      'Each player picks a piece and starts with cash. Players take turns in order. '
          'AI games start immediately; multiplayer waits in a lobby until the host starts.'
    ),
    (
      'Your turn',
      'Roll two dice and move that many spaces. Landing on an unowned property lets you buy it. '
          'Owned properties charge rent. Chance and Community Chest cards apply special effects.'
    ),
    (
      'Building',
      'Own a full color set to build houses, then a hotel. More buildings mean higher rent. '
          'Mortgage properties if you need cash — mortgaged lots do not collect rent.'
    ),
    (
      'Jail',
      'Go to Jail from the corner, three doubles, or a card. Pay, use a Get Out of Jail Free card, '
          'or roll doubles to leave. You can still collect rent while in jail.'
    ),
    (
      'Winning',
      'Bankrupt every other player, or have the highest net worth when the timer ends. '
          'Net worth includes cash plus property values and buildings.'
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: const Text('How to Play'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: TycoonColors.panel,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.25)),
            ),
            child: const Row(
              children: [
                Icon(Icons.menu_book, color: TycoonColors.cyan, size: 32),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'How to Play Tycoon',
                    style: TextStyle(
                      color: TycoonColors.textWhite,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          for (final section in _sections) ...[
            Text(
              section.$1,
              style: const TextStyle(
                color: TycoonColors.cyan,
                fontWeight: FontWeight.w700,
                fontSize: 15,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              section.$2,
              style: const TextStyle(
                color: TycoonColors.textBody,
                height: 1.45,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 18),
          ],
          FilledButton(
            onPressed: () => openAppRoute(context, AppRoutes.playAi),
            style: FilledButton.styleFrom(
              backgroundColor: TycoonColors.cyan,
              foregroundColor: TycoonColors.background,
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('Challenge AI'),
          ),
        ],
      ),
    );
  }
}
