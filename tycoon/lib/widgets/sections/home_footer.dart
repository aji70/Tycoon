import 'package:flutter/material.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/game_panel.dart';
import 'package:url_launcher/url_launcher.dart';

class HomeFooter extends StatelessWidget {
  const HomeFooter({super.key});

  Future<void> _openWeb(String path) async {
    await launchUrl(AppConfig.path(path), mode: LaunchMode.externalApplication);
  }

  Future<void> _openExternal(String url) async {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final year = DateTime.now().year;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      child: GamePanel(
        backgroundAlpha: 1,
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Image.asset(
              'assets/images/footer_logo.png',
              width: 55,
              height: 55,
              errorBuilder: (_, __, ___) => const Icon(
                Icons.casino,
                color: TycoonColors.cyan,
                size: 40,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                _FooterLink(
                  label: 'How to Play',
                  onTap: () => _openWeb('/how-to-play'),
                ),
                _FooterLink(label: 'Terms', onTap: () => _openWeb('/terms')),
                _FooterLink(
                  label: 'Privacy',
                  onTap: () => _openWeb('/privacy'),
                ),
                _FooterLink(
                  label: 'Cookies',
                  onTap: () => _openWeb('/cookies'),
                ),
                _FooterLink(
                  label: 'Support',
                  onTap: () => _openExternal('https://t.me/+xJLEjw9tbyQwMGVk'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              '©$year Tycoon • All rights reserved.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: TycoonColors.textWhite,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _SocialIcon(
                  icon: Icons.facebook,
                  onTap: () => _openExternal('https://facebook.com/ajidokwu'),
                ),
                _SocialIcon(
                  icon: Icons.close,
                  onTap: () => _openExternal('https://x.com/blockopoly1'),
                ),
                _SocialIcon(
                  icon: Icons.code,
                  onTap: () => _openExternal('https://github.com/Tyoon'),
                ),
                _SocialIcon(
                  icon: Icons.send_outlined,
                  onTap: () => _openExternal('https://t.me/+xJLEjw9tbyQwMGVk'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FooterLink extends StatelessWidget {
  const _FooterLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: const TextStyle(
          color: TycoonColors.textWhite,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _SocialIcon extends StatelessWidget {
  const _SocialIcon({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, color: TycoonColors.textWhite, size: 20),
    );
  }
}
