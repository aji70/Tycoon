import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class GameBadge extends StatelessWidget {
  const GameBadge({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: TycoonColors.background.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: TycoonColors.cyan.withValues(alpha: 0.15),
            blurRadius: 8,
          ),
        ],
      ),
      child: Text(
        label,
        style: TextStyle(
          color: TycoonColors.cyan,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 2.4,
        ),
      ),
    );
  }
}
