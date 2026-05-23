/// App settings: defaults + optional `tycoon/.env` + `--dart-define` overrides.
class AppConfig {
  static late final String webBaseUrl;
  static late final String apiBaseUrl;
  static late final String privyAppId;
  static late final String privyClientId;

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
    privyAppId = _resolve(
      defineKey: 'PRIVY_APP_ID',
      envKey: 'PRIVY_APP_ID',
      dotEnv: dotEnv,
      fallback: '',
    );
    privyClientId = _resolve(
      defineKey: 'PRIVY_CLIENT_ID',
      envKey: 'PRIVY_CLIENT_ID',
      dotEnv: dotEnv,
      fallback: '',
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

  static bool get hasPrivy =>
      privyAppId.isNotEmpty && privyClientId.isNotEmpty;

  static Uri path(String route) {
    final base = webBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final p = route.startsWith('/') ? route : '/$route';
    return Uri.parse('$base$p');
  }
}
