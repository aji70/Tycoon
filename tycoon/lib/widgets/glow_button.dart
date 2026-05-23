import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class GlowButton extends StatelessWidget {
  const GlowButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = GlowButtonVariant.primary,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final GlowButtonVariant variant;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final isPrimary = variant == GlowButtonVariant.primary;
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: isPrimary ? TycoonColors.cyan : TycoonColors.tealDark,
          foregroundColor: isPrimary ? TycoonColors.background : TycoonColors.cyan,
          disabledBackgroundColor: TycoonColors.tealDark.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: isPrimary
                ? BorderSide.none
                : const BorderSide(color: TycoonColors.tealDark),
          ),
          elevation: isPrimary ? 8 : 0,
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
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum GlowButtonVariant { primary, secondary }
