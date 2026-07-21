/// App settings: defaults + bundled `assets/env/app.env` + `--dart-define` overrides.
class AppConfig {
  static late final String webBaseUrl;
  static late final String apiBaseUrl;
  static late final String web3AuthClientId;
  static late final String web3AuthNetwork;

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
    web3AuthClientId = _resolve(
      defineKey: 'WEB3AUTH_CLIENT_ID1',
      envKey: 'WEB3AUTH_CLIENT_ID1',
      dotEnv: dotEnv,
      fallback: '',
    );
    web3AuthNetwork = _resolve(
      defineKey: 'WEB3AUTH_NETWORK',
      envKey: 'WEB3AUTH_NETWORK',
      dotEnv: dotEnv,
      fallback: 'sapphire_devnet',
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

  static bool get hasWeb3Auth => web3AuthClientId.isNotEmpty;

  static List<String> get missingWeb3AuthKeys {
    if (web3AuthClientId.isEmpty) return ['WEB3AUTH_CLIENT_ID1'];
    return [];
  }

  static Uri path(String route) {
    final base = webBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final p = route.startsWith('/') ? route : '/$route';
    return Uri.parse('$base$p');
  }
}
