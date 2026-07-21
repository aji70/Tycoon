import 'dart:io';

import 'package:flutter/services.dart';

/// Reads env from bundled `assets/env/app.env`, then optional `tycoon/.env` on desktop.
Future<Map<String, String>> loadLocalEnvFile() async {
  final out = <String, String>{};

  try {
    final bundled = await rootBundle.loadString('assets/env/app.env');
    out.addAll(_parseEnvLines(bundled.split('\n')));
  } catch (_) {}

  try {
    final file = File('.env');
    if (await file.exists()) {
      out.addAll(_parseEnvLines(await file.readAsLines()));
    }
  } catch (_) {}

  return out;
}

Map<String, String> _parseEnvLines(Iterable<String> lines) {
  final out = <String, String>{};
  for (final line in lines) {
    final trimmed = line.trim();
    if (trimmed.isEmpty || trimmed.startsWith('#')) continue;
    final eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    final key = trimmed.substring(0, eq).trim();
    var value = trimmed.substring(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    if (value.isNotEmpty) out[key] = value;
  }
  return out;
}
