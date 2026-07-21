import 'dart:io';

import 'package:web3auth_flutter/enums.dart';
import 'package:web3auth_flutter/input.dart';
import 'package:web3auth_flutter/web3auth_flutter.dart';
import 'package:tycoon/app_config.dart';

/// Same Web3Auth setup as the web app (`Web3AuthProviderWrapper`).
class Web3AuthService {
  static const androidPackage = 'com.example.tycoon';

  static Uri get redirectUrl {
    if (Platform.isAndroid) {
      return Uri.parse('w3a://$androidPackage/auth');
    }
    return Uri.parse('$androidPackage://auth');
  }

  static Network get network {
    final n = AppConfig.web3AuthNetwork.toLowerCase();
    if (n == 'sapphire_mainnet' || n == 'mainnet') {
      return Network.sapphire_mainnet;
    }
    return Network.sapphire_devnet;
  }

  static Future<void> init() async {
    await Web3AuthFlutter.init(
      Web3AuthOptions(
        clientId: AppConfig.web3AuthClientId,
        network: network,
        redirectUrl: redirectUrl,
      ),
    );
  }

  /// Restore an existing Web3Auth session if present.
  static Future<bool> tryRestoreSession() async {
    try {
      await Web3AuthFlutter.initialize();
      final key = await Web3AuthFlutter.getPrivKey();
      return key.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  static Future<String?> getIdToken() async {
    try {
      final info = await Web3AuthFlutter.getUserInfo();
      final token = info.idToken;
      if (token != null && token.isNotEmpty) return token;
      final response = await Web3AuthFlutter.getWeb3AuthResponse();
      return response.userInfo?.idToken;
    } catch (_) {
      return null;
    }
  }

  static Future<void> loginWithEmail(String email) async {
    await Web3AuthFlutter.login(
      LoginParams(
        loginProvider: Provider.email_passwordless,
        extraLoginOptions: ExtraLoginOptions(login_hint: email.trim()),
      ),
    );
  }

  static Future<void> logout() => Web3AuthFlutter.logout();
}
