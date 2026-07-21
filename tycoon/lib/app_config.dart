/// App settings: defaults + bundled `assets/env/app.env` + `--dart-define` overrides.
class AppConfig {
  static late final String webBaseUrl;
  static late final String apiBaseUrl;

  static void init(Map<String, String> dotEnv) {
    webBaseUrl = _resolve(
      defineKey: 'TYCOON_WEB_URL',
      envKey: 'TYCOON_WEB_URL',
      dotEnv: dotEnv,
      fallback: 'https://tycoonworld.xyz',
    );
    apiBaseUrl = _resolve(
      defineKey: 'TYCOON_API_URL',
      envKey: 'TYCOON_API_URL',
      dotEnv: dotEnv,
      fallback: 'https://base-monopoly-production.up.railway.app/api',
    );
  }

  static String _resolve({
    required String defineKey,
    required String envKey,
    required Map<String, String> dotEnv,
    required String fallback,
  }) {
    final fromDefine = String.fromEnvironment(defineKey);
    if (fromDefine.trim().isNotEmpty) return fromDefine.trim();
    final fromFile = dotEnv[envKey]?.trim();
    if (fromFile != null && fromFile.isNotEmpty) return fromFile;
    return fallback;
  }

  static Uri path(String route) {
    final base = webBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final p = route.startsWith('/') ? route : '/$route';
    return Uri.parse('$base$p');
  }
}
