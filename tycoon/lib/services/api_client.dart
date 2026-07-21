import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/session_store.dart';

class ApiClient {
  ApiClient({SessionStore? store}) : _store = store ?? SessionStore();

  final SessionStore _store;

  Future<Map<String, String>> _headers({bool auth = false}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      final token = await _store.readToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  Future<Map<String, dynamic>> getJson(
    String path, {
    bool auth = false,
  }) async {
    final res = await http
        .get(
          Uri.parse('${AppConfig.apiBaseUrl}$path'),
          headers: await _headers(auth: auth),
        )
        .timeout(const Duration(seconds: 30));

    final body = _decodeBody(res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(
        body['message']?.toString() ?? 'Request failed (${res.statusCode})',
        statusCode: res.statusCode,
      );
    }
    return body;
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Map<String, dynamic>? body,
    bool auth = false,
  }) async {
    final res = await http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}$path'),
          headers: await _headers(auth: auth),
          body: jsonEncode(body ?? {}),
        )
        .timeout(const Duration(seconds: 60));

    final decoded = _decodeBody(res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(
        decoded['message']?.toString() ??
            'Request failed (${res.statusCode})',
        statusCode: res.statusCode,
      );
    }
    return decoded;
  }

  Map<String, dynamic> _decodeBody(String raw) {
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return {'message': raw};
    }
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
