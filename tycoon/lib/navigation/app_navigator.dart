import 'package:flutter/material.dart';
import 'package:tycoon/navigation/app_routes.dart';
import 'package:tycoon/screens/challenge_ai_screen.dart';
import 'package:tycoon/screens/coming_soon_screen.dart';

/// Push an in-app screen. Unbuilt routes show [ComingSoonScreen] for now.
void openAppRoute(BuildContext context, String route) {
  if (route == AppRoutes.home) {
    Navigator.of(context).popUntil((r) => r.isFirst);
    return;
  }

  if (route == AppRoutes.playAi) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const ChallengeAiScreen()),
    );
    return;
  }

  Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => ComingSoonScreen(
        title: AppRoutes.titleFor(route),
        routePath: route,
      ),
    ),
  );
}
