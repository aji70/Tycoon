import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

enum SlantedButtonVariant { primary, secondary, tertiary }

class SlantedButton extends StatelessWidget {
  const SlantedButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.variant = SlantedButtonVariant.secondary,
    this.width = 130,
    this.height = 40,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final SlantedButtonVariant variant;
  final double width;
  final double height;

  Color get _fill => switch (variant) {
        SlantedButtonVariant.primary => TycoonColors.cyan,
        SlantedButtonVariant.secondary => TycoonColors.tealDark,
        SlantedButtonVariant.tertiary => TycoonColors.inputBg,
      };

  Color get _stroke => switch (variant) {
        SlantedButtonVariant.primary => TycoonColors.darkAccent,
        SlantedButtonVariant.secondary => TycoonColors.tealDark,
        SlantedButtonVariant.tertiary => TycoonColors.tealDark,
      };

  Color get _textColor => switch (variant) {
        SlantedButtonVariant.primary => TycoonColors.background,
        SlantedButtonVariant.secondary => TycoonColors.cyan,
        SlantedButtonVariant.tertiary => TycoonColors.cyanBrightAlt,
      };

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CustomPaint(
                painter: _SlantedShapePainter(fill: _fill, stroke: _stroke),
              ),
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 16, color: _textColor),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      label,
                      style: TextStyle(
                        color: _textColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SlantedShapePainter extends CustomPainter {
  const _SlantedShapePainter({required this.fill, required this.stroke});

  final Color fill;
  final Color stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.046, h * 0.025)
      ..lineTo(w * 0.954, h * 0.025)
      ..cubicTo(w * 0.987, h * 0.025, w * 1.007, h * 0.146, w * 0.989, h * 0.238)
      ..lineTo(w * 0.847, h * 0.938)
      ..cubicTo(w * 0.839, h * 0.977, w * 0.826, h, w * 0.812, h)
      ..lineTo(w * 0.046, h)
      ..cubicTo(w * 0.023, h, w * 0.004, h * 0.938, w * 0.004, h * 0.863)
      ..lineTo(w * 0.004, h * 0.163)
      ..cubicTo(w * 0.004, h * 0.087, w * 0.023, h * 0.025, w * 0.046, h * 0.025)
      ..close();

    canvas.drawPath(path, Paint()..color = fill);
    canvas.drawPath(
      path,
      Paint()
        ..color = stroke
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(covariant _SlantedShapePainter oldDelegate) =>
      oldDelegate.fill != fill || oldDelegate.stroke != stroke;
}
