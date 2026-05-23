import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class WorldStatsBar extends StatelessWidget {
  const WorldStatsBar({super.key});

  @override
  Widget build(BuildContext context) {
    const stats = [
      ('Players Online', '1,234'),
      ('Properties Owned', '5,678'),
      ('Tokens in Play', '12.5M'),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            TycoonColors.background,
            Color(0xCC010F10),
            Colors.transparent,
          ],
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          for (final (label, value) in stats)
            Expanded(
              child: Column(
                children: [
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: TycoonColors.cyan.withValues(alpha: 0.7),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: TycoonColors.cyanBright,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
