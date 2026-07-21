import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

/// Email lookup sign-in — finds existing user in DB via POST /auth/mobile-email-login.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  AuthController get _auth => TycoonAuthScope.of(context);

  Future<void> _signIn() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final result = await _auth.signInWithEmail(email);
      if (!mounted) return;

      if (!result.ok) {
        setState(() {
          _busy = false;
          _error = result.message ?? 'Sign-in failed';
        });
        return;
      }

      if (!_auth.isLoggedIn) {
        setState(() {
          _busy = false;
          _error = 'Signed in but could not load your profile. Try again.';
        });
        return;
      }

      Navigator.of(context).pop(true);
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
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
                'Enter the email you used on Tycoon. We\'ll find your account and sign you in.',
                style: TextStyle(color: TycoonColors.textMuted, height: 1.4),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                enabled: !_busy,
                style: const TextStyle(color: TycoonColors.cyanBright),
                decoration: _inputDecoration('Email'),
                onSubmitted: (_) => _busy ? null : _signIn(),
              ),
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
                child: Text(_busy ? 'Please wait…' : "Let's Go!"),
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
