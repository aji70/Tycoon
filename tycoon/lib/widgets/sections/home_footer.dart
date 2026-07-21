import 'package:flutter/material.dart';
import 'package:tycoon/navigation/app_navigator.dart';
import 'package:tycoon/navigation/app_routes.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/game_panel.dart';

class HomeFooter extends StatelessWidget {
  const HomeFooter({super.key});

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
              errorBuilder: (_, _, _) => const Icon(
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
                  onTap: () => openAppRoute(context, AppRoutes.howToPlay),
                ),
                _FooterLink(
                  label: 'Terms',
                  onTap: () => openAppRoute(context, AppRoutes.terms),
                ),
                _FooterLink(
                  label: 'Privacy',
                  onTap: () => openAppRoute(context, AppRoutes.privacy),
                ),
                _FooterLink(
                  label: 'Cookies',
                  onTap: () => openAppRoute(context, AppRoutes.cookies),
                ),
                const _FooterLink(label: 'Support', enabled: false),
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
              children: const [
                _SocialIcon(icon: Icons.facebook, enabled: false),
                _SocialIcon(icon: Icons.close, enabled: false),
                _SocialIcon(icon: Icons.code, enabled: false),
                _SocialIcon(icon: Icons.send_outlined, enabled: false),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FooterLink extends StatelessWidget {
  const _FooterLink({
    required this.label,
    this.onTap,
    this.enabled = true,
  });

  final String label;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1 : 0.4,
        child: Text(
          label,
          style: const TextStyle(
            color: TycoonColors.textWhite,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}

class _SocialIcon extends StatelessWidget {
  const _SocialIcon({required this.icon, this.enabled = true});

  final IconData icon;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.35,
      child: IconButton(
        onPressed: enabled ? () {} : null,
        icon: Icon(icon, color: TycoonColors.textWhite, size: 20),
      ),
    );
  }
}
