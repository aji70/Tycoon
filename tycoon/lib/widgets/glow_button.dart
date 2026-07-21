import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

enum GlowButtonVariant { primary, secondary, tertiary }

enum GlowButtonSize { sm, md, lg }

class GlowButton extends StatelessWidget {
  const GlowButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = GlowButtonVariant.primary,
    this.size = GlowButtonSize.md,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final GlowButtonVariant variant;
  final GlowButtonSize size;
  final IconData? icon;

  double get _height => switch (size) {
        GlowButtonSize.sm => 44,
        GlowButtonSize.md => 48,
        GlowButtonSize.lg => 56,
      };

  double get _fontSize => switch (size) {
        GlowButtonSize.sm => 14,
        GlowButtonSize.md => 16,
        GlowButtonSize.lg => 18,
      };

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (variant) {
      GlowButtonVariant.primary => (
          TycoonColors.cyan,
          TycoonColors.background,
          TycoonColors.darkAccent,
        ),
      GlowButtonVariant.secondary => (
          TycoonColors.tealDark,
          TycoonColors.cyan,
          TycoonColors.cyan,
        ),
      GlowButtonVariant.tertiary => (
          TycoonColors.inputBg,
          TycoonColors.cyanBrightAlt,
          TycoonColors.tealDark,
        ),
    };

    return SizedBox(
      width: double.infinity,
      height: _height,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          disabledBackgroundColor: bg.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: BorderSide(color: border, width: variant == GlowButtonVariant.primary ? 2 : 2),
          ),
          elevation: variant == GlowButtonVariant.primary ? 8 : 0,
          shadowColor: TycoonColors.cyan.withValues(alpha: 0.45),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 20),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
                fontSize: _fontSize,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
