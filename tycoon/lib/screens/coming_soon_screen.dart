import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

/// Placeholder until the native screen for [routePath] is built.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.routePath,
  });

  final String title;
  final String routePath;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: TycoonColors.cyan,
        title: Text(title),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.construction_outlined,
                size: 56,
                color: TycoonColors.cyan.withValues(alpha: 0.6),
              ),
              const SizedBox(height: 20),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: TycoonColors.textWhite,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'This page is coming soon to the Tycoon app.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: TycoonColors.textMuted,
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                routePath,
                style: TextStyle(
                  color: TycoonColors.cyan.withValues(alpha: 0.4),
                  fontSize: 12,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
