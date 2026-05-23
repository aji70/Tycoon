import 'dart:io';

/// Reads `tycoon/.env` (KEY=value). Optional — dart-define still overrides.
Future<Map<String, String>> loadLocalEnvFile() async {
  try {
    final file = File('.env');
    if (!await file.exists()) return {};
    final out = <String, String>{};
    for (final line in await file.readAsLines()) {
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
      out[key] = value;
    }
    return out;
  } catch (_) {
    return {};
  }
}
