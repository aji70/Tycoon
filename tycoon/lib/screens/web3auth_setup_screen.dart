import 'package:flutter/material.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:url_launcher/url_launcher.dart';

/// Shown when Web3Auth client ID is missing from config.
class Web3AuthSetupScreen extends StatelessWidget {
  const Web3AuthSetupScreen({super.key});

  Future<void> _openDashboard() async {
    await launchUrl(
      Uri.parse('https://dashboard.web3auth.io/'),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Web3Auth setup'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Sign-in uses Web3Auth',
                style: TextStyle(
                  color: TycoonColors.cyan,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Same as the website — email passwordless via Web3Auth, then '
                'POST /auth/web3auth-signin on our backend. Add your Client ID once:',
                style: TextStyle(color: TycoonColors.textBody, height: 1.5),
              ),
              const SizedBox(height: 20),
              if (AppConfig.missingWeb3AuthKeys.isNotEmpty) ...[
                const Text(
                  'Missing in config:',
                  style: TextStyle(
                    color: TycoonColors.textMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                for (final key in AppConfig.missingWeb3AuthKeys)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      '• $key',
                      style: const TextStyle(
                        color: TycoonColors.cyanBright,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
              ],
              const _Step(
                number: '1',
                text:
                    'Get a mobile Client ID from dashboard.web3auth.io (Flutter / Android client)',
              ),
              const _Step(
                number: '2',
                text:
                    'Add WEB3AUTH_CLIENT_ID1 to backend/.env (or Railway backend env)\n'
                    '— mobile client, separate from web WEB3AUTH_CLIENT_ID',
              ),
              const _Step(
                number: '3',
                text: 'Run: ./tool/sync_env.sh && flutter run',
              ),
              const _Step(
                number: '4',
                text:
                    'In Web3Auth dashboard, allowlist redirect:\nw3a://com.example.tycoon/auth',
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _openDashboard,
                style: FilledButton.styleFrom(
                  backgroundColor: TycoonColors.cyan,
                  foregroundColor: TycoonColors.background,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: const Text('Open Web3Auth Dashboard'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.text});

  final String number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: TycoonColors.tealDark,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              number,
              style: const TextStyle(
                color: TycoonColors.cyan,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: TycoonColors.textBody,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
