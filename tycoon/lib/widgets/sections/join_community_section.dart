import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/game_badge.dart';
import 'package:tycoon/widgets/game_panel.dart';
import 'package:tycoon/widgets/slanted_button.dart';
import 'package:url_launcher/url_launcher.dart';

class JoinCommunitySection extends StatelessWidget {
  const JoinCommunitySection({super.key});

  Future<void> _open(Uri uri) async {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: TycoonColors.background,
      padding: const EdgeInsets.fromLTRB(16, 80, 16, 80),
      child: GamePanel(
        backgroundAlpha: 0.6,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(
          children: [
            const GameBadge(label: 'JOIN THE GUILD'),
            const SizedBox(height: 12),
            const Text(
              'Join Our Community',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TycoonColors.textWhite,
                fontSize: 28,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Join our community of players, builders, and dreamers shaping the '
              'future of gaming — one block at a time.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TycoonColors.textBodyAlt,
                fontSize: 16,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            SlantedButton(
              label: 'Join our Telegram',
              icon: Icons.send_outlined,
              variant: SlantedButtonVariant.tertiary,
              width: 227,
              onTap: () => _open(Uri.parse('https://t.me/+xJLEjw9tbyQwMGVk')),
            ),
            const SizedBox(height: 12),
            SlantedButton(
              label: 'Follow us on X',
              icon: Icons.close,
              variant: SlantedButtonVariant.secondary,
              width: 227,
              onTap: () => _open(Uri.parse('https://x.com/blockopoly1')),
            ),
          ],
        ),
      ),
    );
  }
}
