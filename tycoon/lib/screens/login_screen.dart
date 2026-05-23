import 'package:flutter/material.dart';
import 'package:privy_flutter/privy_flutter.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

/// Email OTP sign-in — same Privy + `POST /auth/privy-signin` flow as the web app.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _usernameController = TextEditingController();

  bool _codeSent = false;
  bool _needsUsername = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  AuthController get _auth => TycoonAuthScope.of(context);

  Future<void> _sendCode() async {
    final privy = _auth.privy;
    if (privy == null) return;
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    final result = await privy.email.sendCode(email);
    result.fold(
      onSuccess: (_) {
        setState(() {
          _codeSent = true;
          _busy = false;
        });
      },
      onFailure: (e) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      },
    );
  }

  Future<void> _verifyAndSignIn() async {
    final privy = _auth.privy;
    if (privy == null) return;
    final email = _emailController.text.trim();
    final code = _codeController.text.trim();
    if (code.length < 4) {
      setState(() => _error = 'Enter the code from your email');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    final loginResult = await privy.email.loginWithCode(
      code: code,
      email: email,
    );

    switch (loginResult) {
      case Success():
        await _syncBackend(
          username: _needsUsername ? _usernameController.text.trim() : null,
        );
      case Failure(:final error):
        setState(() {
          _error = error.message;
          _busy = false;
        });
    }
  }

  Future<void> _syncBackend({String? username}) async {
    final token = await _auth.getPrivyAccessToken();
    if (token == null) {
      setState(() {
        _error = 'Could not get Privy session. Try again.';
        _busy = false;
      });
      return;
    }

    final result = await _auth.repository.privySignIn(
      privyAccessToken: token,
      username: username,
    );

    if (!mounted) return;

    if (result.needsUsername) {
      setState(() {
        _needsUsername = true;
        _busy = false;
        _error = result.message;
      });
      return;
    }

    if (!result.ok) {
      setState(() {
        _error = result.message ?? 'Could not link account to Tycoon server';
        _busy = false;
      });
      return;
    }

    await _auth.refreshUser();
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    if (!AppConfig.hasPrivy || _auth.privy == null) {
      return Scaffold(
        backgroundColor: TycoonColors.background,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          foregroundColor: TycoonColors.cyan,
        ),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Privy not configured',
                style: TextStyle(
                  color: TycoonColors.cyan,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'One-time setup in the tycoon folder:\n\n'
                '  cp .env.example .env\n'
                '  ./tool/sync_env.sh\n\n'
                'Then add PRIVY_CLIENT_ID to .env (Privy Dashboard → Clients → '
                'Android com.example.tycoon). After that, plain flutter run works.',
                style: TextStyle(color: TycoonColors.textBody, height: 1.5),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Sign in to Tycoon'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Enter your email for a one-time code. No password — same as the website.',
                style: TextStyle(color: TycoonColors.textMuted, height: 1.4),
              ),
              const SizedBox(height: 24),
              if (!_needsUsername) ...[
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  enabled: !_codeSent && !_busy,
                  style: const TextStyle(color: TycoonColors.cyanBright),
                  decoration: _inputDecoration('Email'),
                ),
                if (_codeSent) ...[
                  const SizedBox(height: 16),
                  TextField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    enabled: !_busy,
                    style: const TextStyle(color: TycoonColors.cyanBright),
                    decoration: _inputDecoration('Code from email'),
                  ),
                ],
              ] else ...[
                const Text(
                  'Choose your in-game username',
                  style: TextStyle(
                    color: TycoonColors.cyan,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _usernameController,
                  enabled: !_busy,
                  style: const TextStyle(color: TycoonColors.cyanBright),
                  decoration: _inputDecoration('Username'),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () {
                        if (_needsUsername) {
                          final name = _usernameController.text.trim();
                          if (name.length < 2) {
                            setState(() => _error = 'Username must be at least 2 characters');
                            return;
                          }
                          setState(() {
                            _busy = true;
                            _error = null;
                          });
                          _syncBackend(username: name);
                          return;
                        }
                        if (!_codeSent) {
                          _sendCode();
                        } else {
                          _verifyAndSignIn();
                        }
                      },
                style: FilledButton.styleFrom(
                  backgroundColor: TycoonColors.cyan,
                  foregroundColor: TycoonColors.background,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: Text(
                  _busy
                      ? 'Please wait…'
                      : _needsUsername
                          ? 'Continue'
                          : _codeSent
                              ? 'Verify & sign in'
                              : 'Send code',
                ),
              ),
              if (_codeSent && !_needsUsername)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _codeSent = false;
                            _codeController.clear();
                            _error = null;
                          }),
                  child: const Text('Use a different email'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: TycoonColors.textMuted),
      filled: true,
      fillColor: const Color(0xFF0E1415),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: TycoonColors.tealDark),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: TycoonColors.tealDark),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: TycoonColors.cyan),
      ),
    );
  }
}
