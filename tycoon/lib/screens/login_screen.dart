import 'dart:async';

import 'package:flutter/material.dart';
import 'package:web3auth_flutter/input.dart';
import 'package:web3auth_flutter/web3auth_flutter.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/auth/auth_repository.dart';
import 'package:tycoon/auth/web3auth_service.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/web3auth_setup_screen.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

/// Email passwordless sign-in — same Web3Auth + `POST /auth/web3auth-signin` as the website.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with WidgetsBindingObserver {
  final _emailController = TextEditingController();
  final _usernameController = TextEditingController();

  bool _needsUsername = false;
  bool _busy = false;
  bool _awaitingRedirect = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _emailController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingRedirect) {
      // Web3Auth returns via w3a:// redirect — finish backend sync after a beat
      Future<void>.delayed(const Duration(milliseconds: 400), _tryFinishAfterRedirect);
    }
  }

  AuthController get _auth => TycoonAuthScope.of(context);

  Future<void> _tryFinishAfterRedirect() async {
    if (!_awaitingRedirect || !mounted) return;

    try {
      final hasSession = await Web3AuthService.tryRestoreSession();
      if (!hasSession) {
        Web3AuthFlutter.setCustomTabsClosed();
        return;
      }

      final result = await _auth.completeBackendSignIn(
        username: _needsUsername ? _usernameController.text.trim() : null,
      );
      if (!mounted) return;
      await _handleSignInResult(result);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _awaitingRedirect = false;
        _busy = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _handleSignInResult(Web3AuthSignInResult result) async {
    if (result.needsUsername) {
      setState(() {
        _needsUsername = true;
        _awaitingRedirect = false;
        _busy = false;
        _error = result.message;
      });
      return;
    }

    if (!result.ok) {
      setState(() {
        _awaitingRedirect = false;
        _busy = false;
        _error = result.message ?? 'Sign-in failed';
      });
      return;
    }

    await _auth.refreshUser();
    if (!mounted) return;
    _awaitingRedirect = false;
    Navigator.of(context).pop(true);
  }

  Future<void> _signIn() async {
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
      final result = await _auth.completeUsername(name);
      if (!mounted) return;
      await _handleSignInResult(result);
      return;
    }

    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email');
      return;
    }

    setState(() {
      _busy = true;
      _awaitingRedirect = true;
      _error = null;
    });

    try {
      await Web3AuthService.loginWithEmail(email);
      if (!mounted) return;
      final result = await _auth.completeBackendSignIn();
      if (!mounted) return;
      await _handleSignInResult(result);
    } on UserCancelledException {
      if (!mounted) return;
      // User may have completed login — resume handler will try session sync
      if (!_awaitingRedirect) {
        setState(() {
          _busy = false;
          _error = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      // Login may still succeed via redirect — resume handler runs next
      if (!_awaitingRedirect) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AppConfig.hasWeb3Auth || !_auth.canUseWeb3Auth) {
      return const Web3AuthSetupScreen();
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
                'Enter your email — Web3Auth opens a secure browser tab for the one-time code. '
                'Same flow as the website.',
                style: TextStyle(color: TycoonColors.textMuted, height: 1.4),
              ),
              const SizedBox(height: 24),
              if (!_needsUsername)
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  enabled: !_busy,
                  style: const TextStyle(color: TycoonColors.cyanBright),
                  decoration: _inputDecoration('Email'),
                )
              else ...[
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
                onPressed: _busy ? null : _signIn,
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
                          : "Let's Go!",
                ),
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
