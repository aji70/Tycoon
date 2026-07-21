import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/navigation/app_navigator.dart';
import 'package:tycoon/navigation/app_routes.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

/// Fixed top bar + bottom-sheet menu — mirrors web `navbar-mobile.tsx`.
class MobileNavBar extends StatelessWidget {
  const MobileNavBar({super.key, this.onHomeTap});

  final VoidCallback? onHomeTap;

  Future<void> _signIn(BuildContext context) async {
    Navigator.of(context).pop();
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  String _displayName(AuthController auth) {
    final user = auth.user;
    if (user == null) return '';
    if (user.username.isNotEmpty) return user.username;
    final email = user.email;
    if (email != null && email.isNotEmpty) {
      return email.length > 20 ? '${email.substring(0, 18)}…' : email;
    }
    if (user.address.length >= 10) {
      return '${user.address.substring(0, 6)}…${user.address.substring(user.address.length - 4)}';
    }
    return 'Profile';
  }

  void _openMenu(BuildContext context, AuthController auth) {
    final loggedIn = auth.isLoggedIn;
    final displayName = _displayName(auth);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.75),
      builder: (sheetContext) {
        void go(String route) {
          Navigator.of(sheetContext).pop();
          openAppRoute(context, route);
        }

        return _NavMenuSheet(
          loggedIn: loggedIn,
          displayName: displayName,
          onHomeTap: () {
            Navigator.of(sheetContext).pop();
            onHomeTap?.call();
          },
          onNavigate: go,
          onProfile: () => go(AppRoutes.profile),
          onSignIn: () => _signIn(context),
          onSignOut: () async {
            Navigator.of(sheetContext).pop();
            await auth.signOut();
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = TycoonAuthScope.of(context);

    return ListenableBuilder(
      listenable: auth,
      builder: (context, _) {
        final loggedIn = auth.isLoggedIn;
        final displayName = _displayName(auth);

        return _TopBar(
          displayName: loggedIn ? displayName : null,
          onMenuTap: () => _openMenu(context, auth),
          onLogoTap: onHomeTap,
        );
      },
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.onMenuTap,
    this.onLogoTap,
    this.displayName,
  });

  final VoidCallback onMenuTap;
  final VoidCallback? onLogoTap;
  final String? displayName;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFF021A1B).withValues(alpha: 0.95),
              TycoonColors.background.withValues(alpha: 0.98),
            ],
          ),
          border: Border(
            bottom: BorderSide(color: TycoonColors.cyan.withValues(alpha: 0.2)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: SafeArea(
          bottom: false,
          child: SizedBox(
            height: 56,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: onLogoTap,
                    child: Image.asset(
                      'assets/images/footer_logo.png',
                      width: 40,
                      height: 40,
                      errorBuilder: (_, _, _) => const Icon(
                        Icons.casino_outlined,
                        color: TycoonColors.cyan,
                        size: 32,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Center(
                      child: displayName != null
                          ? Text(
                              displayName!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: TycoonColors.cyan,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            )
                          : const Text(
                              'TYCOON',
                              style: TextStyle(
                                color: TycoonColors.cyan,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 2,
                              ),
                            ),
                    ),
                  ),
                  _IconButton(
                    icon: Icons.menu_rounded,
                    onTap: onMenuTap,
                    highlight: true,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({
    required this.icon,
    required this.onTap,
    this.highlight = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF03383A),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: TycoonColors.cyan.withValues(alpha: highlight ? 0.45 : 0.25),
            ),
          ),
          child: Icon(
            icon,
            color: highlight ? TycoonColors.cyan : TycoonColors.textWhite,
            size: 22,
          ),
        ),
      ),
    );
  }
}

class _NavMenuSheet extends StatelessWidget {
  const _NavMenuSheet({
    required this.loggedIn,
    required this.displayName,
    required this.onHomeTap,
    required this.onNavigate,
    required this.onProfile,
    required this.onSignIn,
    required this.onSignOut,
  });

  final bool loggedIn;
  final String displayName;
  final VoidCallback onHomeTap;
  final void Function(String route) onNavigate;
  final VoidCallback onProfile;
  final VoidCallback onSignIn;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.9;

    return Padding(
      padding: EdgeInsets.only(top: MediaQuery.sizeOf(context).height * 0.1),
      child: Material(
        color: Colors.transparent,
        child: Container(
          constraints: BoxConstraints(maxHeight: maxHeight),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF021A1C), TycoonColors.background],
            ),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            border: Border(
              top: BorderSide(color: TycoonColors.cyan.withValues(alpha: 0.25), width: 2),
            ),
          ),
          child: SafeArea(
            top: false,
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + bottomInset),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Center(
                          child: Container(
                            width: 48,
                            height: 5,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              color: TycoonColors.cyan.withValues(alpha: 0.5),
                            ),
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close, color: TycoonColors.textWhite),
                      ),
                    ],
                  ),
                  if (loggedIn) ...[
                    _ProfileCard(name: displayName, onTap: onProfile),
                    const SizedBox(height: 16),
                  ],
                  const _SectionLabel('Navigation'),
                  _NavItem(
                    icon: Icons.home_outlined,
                    label: 'Home',
                    onTap: onHomeTap,
                  ),
                  _NavItem(
                    icon: Icons.emoji_events_outlined,
                    label: 'Leaderboard',
                    iconColor: const Color(0xFFFBBF24),
                    onTap: () => onNavigate(AppRoutes.leaderboard),
                  ),
                  _NavItem(
                    icon: Icons.menu_book_outlined,
                    label: 'How to Play',
                    onTap: () => onNavigate(AppRoutes.howToPlay),
                  ),
                  if (loggedIn) ...[
                    _NavItem(
                      icon: Icons.shopping_bag_outlined,
                      label: 'Perk Shop',
                      iconColor: const Color(0xFF34D399),
                      onTap: () => onNavigate(AppRoutes.gameShop),
                    ),
                    _NavItem(
                      icon: Icons.emoji_events_outlined,
                      label: 'Tournaments',
                      onTap: () => onNavigate(AppRoutes.tournaments),
                    ),
                    _NavItem(
                      icon: Icons.smart_toy_outlined,
                      label: 'Agent Tournaments',
                      onTap: () => onNavigate(AppRoutes.agentTournaments),
                    ),
                    _NavItem(
                      icon: Icons.smart_toy_outlined,
                      label: 'Agents',
                      onTap: () => onNavigate(AppRoutes.arena),
                    ),
                    _NavItem(
                      icon: Icons.chat_bubble_outline,
                      label: 'Rooms',
                      onTap: () => onNavigate(AppRoutes.rooms),
                    ),
                  ],
                  const SizedBox(height: 8),
                  const _SectionLabel('Legal & Support'),
                  _NavItem(
                    icon: Icons.description_outlined,
                    label: 'Terms of Service',
                    onTap: () => onNavigate(AppRoutes.terms),
                  ),
                  _NavItem(
                    icon: Icons.shield_outlined,
                    label: 'Privacy Policy',
                    onTap: () => onNavigate(AppRoutes.privacy),
                  ),
                  _NavItem(
                    icon: Icons.support_agent_outlined,
                    label: 'Support',
                    enabled: false,
                    subtitle: 'Coming soon in app',
                  ),
                  const SizedBox(height: 16),
                  if (loggedIn)
                    OutlinedButton(
                      onPressed: onSignOut,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: TycoonColors.cyan,
                        side: BorderSide(color: TycoonColors.tealDark.withValues(alpha: 0.8)),
                        minimumSize: const Size.fromHeight(48),
                      ),
                      child: Text('$displayName · Sign out'),
                    )
                  else
                    FilledButton(
                      onPressed: onSignIn,
                      style: FilledButton.styleFrom(
                        backgroundColor: TycoonColors.cyan.withValues(alpha: 0.25),
                        foregroundColor: TycoonColors.cyan,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      child: const Text(
                        'Sign in',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8, top: 4),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          color: TycoonColors.cyan.withValues(alpha: 0.4),
          fontSize: 10,
          letterSpacing: 2.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.name, required this.onTap});

  final String name;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF022A2C),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: TycoonColors.cyan.withValues(alpha: 0.4), width: 2),
                  color: TycoonColors.tealDark,
                ),
                child: const Icon(Icons.person, color: TycoonColors.cyan),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PLAYER',
                      style: TextStyle(
                        color: TycoonColors.cyan.withValues(alpha: 0.5),
                        fontSize: 10,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TycoonColors.cyan,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: TycoonColors.cyan.withValues(alpha: 0.4)),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    this.onTap,
    this.iconColor = TycoonColors.cyan,
    this.enabled = true,
    this.subtitle,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color iconColor;
  final bool enabled;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final opacity = enabled ? 1.0 : 0.45;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Opacity(
        opacity: opacity,
        child: Material(
          color: const Color(0xFF011112).withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: enabled ? onTap : null,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: TycoonColors.tealDark.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, color: iconColor, size: 18),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: const TextStyle(
                            color: TycoonColors.textBodyAlt,
                            fontWeight: FontWeight.w500,
                            fontSize: 15,
                          ),
                        ),
                        if (subtitle != null)
                          Text(
                            subtitle!,
                            style: TextStyle(
                              color: TycoonColors.textMuted.withValues(alpha: 0.8),
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (enabled)
                    Icon(Icons.chevron_right, size: 16, color: TycoonColors.cyan.withValues(alpha: 0.3)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
