import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class WorldStatsBar extends StatefulWidget {
  const WorldStatsBar({
    super.key,
    this.playersOnline = 1234,
    this.propertiesOwned = 5678,
    this.tokensInPlay = '12.5M',
  });

  final int playersOnline;
  final int propertiesOwned;
  final String tokensInPlay;

  @override
  State<WorldStatsBar> createState() => _WorldStatsBarState();
}

class _WorldStatsBarState extends State<WorldStatsBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _progress = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _format(int value) {
    final s = value.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  @override
  Widget build(BuildContext context) {
    final stats = [
      ('Players Online', widget.playersOnline, false),
      ('Properties Owned', widget.propertiesOwned, false),
      ('Tokens in Play', null, true),
    ];

    return AnimatedBuilder(
      animation: _progress,
      builder: (context, _) {
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 32, 16, 16),
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
              for (final (label, raw, isString) in stats)
                Expanded(
                  child: Column(
                    children: [
                      Text(
                        label.toUpperCase(),
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
                        isString
                            ? widget.tokensInPlay
                            : _format(
                                ((raw as int) * _progress.value).floor(),
                              ),
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
      },
    );
  }
}
