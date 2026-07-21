import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/session_store.dart';
import 'package:tycoon/auth/tycoon_user.dart';

class SignInResult {
  const SignInResult({
    required this.ok,
    this.token,
    this.message,
    this.user,
  });

  final bool ok;
  final String? token;
  final String? message;
  final TycoonUser? user;
}

class AuthRepository {
  AuthRepository({SessionStore? store}) : _store = store ?? SessionStore();

  final SessionStore _store;

  Future<TycoonUser?> fetchMe() async {
    final token = await _store.readToken();
    if (token == null || token.isEmpty) return null;

    try {
      final res = await http
          .get(
            Uri.parse('${AppConfig.apiBaseUrl}/auth/me'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 45));

      if (res.statusCode != 200) {
        if (res.statusCode == 401) await _store.clearToken();
        return null;
      }

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final data = body['data'];
      if (data is! Map<String, dynamic>) return null;
      return TycoonUser.fromJson(data);
    } on SocketException {
      return null;
    } on HttpException {
      return null;
    }
  }

  Future<SignInResult> loginByEmail(String email) async {
    try {
      final res = await http
          .post(
            Uri.parse('${AppConfig.apiBaseUrl}/auth/mobile-email-login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email.trim().toLowerCase()}),
          )
          .timeout(const Duration(seconds: 30));

      Map<String, dynamic> body = {};
      try {
        body = jsonDecode(res.body) as Map<String, dynamic>;
      } catch (_) {
        return SignInResult(
          ok: false,
          message: 'Server returned ${res.statusCode} (invalid JSON)',
        );
      }

      final message = body['message'] as String?;
      final data = body['data'];
      final token =
          data is Map<String, dynamic> ? data['token'] as String? : null;
      final userJson = data is Map<String, dynamic> ? data['user'] : null;

      if (res.statusCode >= 200 &&
          res.statusCode < 300 &&
          token != null &&
          token.isNotEmpty) {
        await _store.saveToken(token);
        TycoonUser? user;
        if (userJson is Map<String, dynamic>) {
          user = TycoonUser.fromJson(userJson);
        }
        return SignInResult(ok: true, token: token, user: user);
      }

      return SignInResult(
        ok: false,
        message: message ?? 'Sign-in failed (${res.statusCode})',
      );
    } on SocketException {
      return const SignInResult(
        ok: false,
        message: 'No internet connection. Check your network and try again.',
      );
    } on HttpException {
      return const SignInResult(
        ok: false,
        message: 'Could not reach the server. Try again in a moment.',
      );
    } on TimeoutException {
      return const SignInResult(
        ok: false,
        message: 'Request timed out. Check your connection and try again.',
      );
    }
  }

  Future<void> clearSession() => _store.clearToken();
}
