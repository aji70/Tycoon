import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

enum NeonTitleSize { sm, md, lg }

class NeonTitle extends StatelessWidget {
  const NeonTitle({
    super.key,
    required this.text,
    this.size = NeonTitleSize.md,
  });

  final String text;
  final NeonTitleSize size;

  double get _fontSize => switch (size) {
        NeonTitleSize.sm => 36,
        NeonTitleSize.md => 52,
        NeonTitleSize.lg => 64,
      };

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: _fontSize,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
        color: TycoonColors.cyan,
        shadows: const [
          Shadow(color: Color(0xCC00F0FF), blurRadius: 8),
          Shadow(color: Color(0x9900F0FF), blurRadius: 16),
        ],
      ),
    );
  }
}
