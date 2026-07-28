import 'package:flutter/material.dart';
import 'package:tycoon/navigation/app_routes.dart';
import 'package:tycoon/screens/arena_screen.dart';
import 'package:tycoon/screens/challenge_ai_screen.dart';
import 'package:tycoon/screens/coming_soon_screen.dart';
import 'package:tycoon/screens/how_to_play_screen.dart';
import 'package:tycoon/screens/join_room_screen.dart';
import 'package:tycoon/screens/leaderboard_screen.dart';
import 'package:tycoon/screens/multiplayer_create_screen.dart';
import 'package:tycoon/screens/perk_shop_screen.dart';
import 'package:tycoon/screens/profile_screen.dart';
import 'package:tycoon/screens/web_app_screen.dart';

/// Push an in-app screen. Unbuilt routes show [ComingSoonScreen] for now.
void openAppRoute(BuildContext context, String route) {
  if (route == AppRoutes.home) {
    Navigator.of(context).popUntil((r) => r.isFirst);
    return;
  }

  final Widget page = switch (route) {
    AppRoutes.playAi => const ChallengeAiScreen(),
    AppRoutes.profile => const ProfileScreen(),
    AppRoutes.leaderboard => const LeaderboardScreen(),
    AppRoutes.howToPlay => const HowToPlayScreen(),
    AppRoutes.joinRoom => const JoinRoomScreen(),
    AppRoutes.multiplayer => const MultiplayerCreateScreen(),
    AppRoutes.gameShop => const PerkShopScreen(),
    AppRoutes.arena => const ArenaScreen(),
    AppRoutes.agentTournaments => const WebAppScreen(
        title: 'Agent Tournaments',
        path: '/agent-tournaments',
      ),
    _ => ComingSoonScreen(
        title: AppRoutes.titleFor(route),
        routePath: route,
      ),
  };

  Navigator.of(context).push<void>(
    MaterialPageRoute<void>(builder: (_) => page),
  );
}
