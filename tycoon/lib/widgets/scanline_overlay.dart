import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class ScanlineOverlay extends StatelessWidget {
  const ScanlineOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: CustomPaint(
        painter: _ScanlinePainter(),
        size: Size.infinite,
      ),
    );
  }
}

class _ScanlinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final scanline = Paint()
      ..color = TycoonColors.cyan.withValues(alpha: 0.03)
      ..strokeWidth = 1;
    for (var y = 0.0; y < size.height; y += 4) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), scanline);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
