import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class GamePanel extends StatelessWidget {
  const GamePanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.backgroundAlpha = 0.8,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double backgroundAlpha;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: TycoonColors.panel.withValues(alpha: backgroundAlpha),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: TycoonColors.tealDark.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: TycoonColors.cyan.withValues(alpha: 0.06),
            blurRadius: 24,
          ),
          BoxShadow(
            color: TycoonColors.cyan.withValues(alpha: 0.04),
            blurRadius: 40,
            spreadRadius: -8,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: child,
    );
  }
}
