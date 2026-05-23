import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/session_store.dart';
import 'package:tycoon/auth/tycoon_user.dart';

class PrivySignInResult {
  const PrivySignInResult({
    required this.ok,
    this.token,
    this.needsUsername = false,
    this.message,
  });

  final bool ok;
  final String? token;
  final bool needsUsername;
  final String? message;
}

class AuthRepository {
  AuthRepository({SessionStore? store}) : _store = store ?? SessionStore();

  final SessionStore _store;

  Future<TycoonUser?> fetchMe() async {
    final token = await _store.readToken();
    if (token == null || token.isEmpty) return null;

    final res = await http.get(
      Uri.parse('${AppConfig.apiBaseUrl}/auth/me'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (res.statusCode != 200) {
      if (res.statusCode == 401) await _store.clearToken();
      return null;
    }

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final data = body['data'];
    if (data is! Map<String, dynamic>) return null;
    return TycoonUser.fromJson(data);
  }

  Future<PrivySignInResult> privySignIn({
    required String privyAccessToken,
    String? username,
  }) async {
    final payload = <String, String>{};
    if (username != null && username.trim().length >= 2) {
      payload['username'] = username.trim();
    }

    final res = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}/auth/privy-signin'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $privyAccessToken',
      },
      body: jsonEncode(payload),
    );

    Map<String, dynamic> body = {};
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return PrivySignInResult(
        ok: false,
        message: 'Server returned ${res.statusCode} (invalid JSON)',
      );
    }

    final message = body['message'] as String?;
    final data = body['data'];
    final token = data is Map<String, dynamic> ? data['token'] as String? : null;

    if (res.statusCode == 400 &&
        (message ?? '').toLowerCase().contains('username')) {
      return const PrivySignInResult(ok: false, needsUsername: true);
    }

    if (res.statusCode == 409) {
      return PrivySignInResult(
        ok: false,
        needsUsername: true,
        message: message ?? 'Username already taken',
      );
    }

    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        token != null &&
        token.isNotEmpty) {
      await _store.saveToken(token);
      return PrivySignInResult(ok: true, token: token);
    }

    return PrivySignInResult(
      ok: false,
      message: message ?? 'Sign-in failed (${res.statusCode})',
    );
  }

  Future<void> clearSession() => _store.clearToken();
}
