import 'package:flutter/foundation.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/auth_repository.dart';
import 'package:tycoon/auth/tycoon_user.dart';
import 'package:tycoon/auth/web3auth_service.dart';

class AuthController extends ChangeNotifier {
  AuthController({AuthRepository? repository})
      : _repository = repository ?? AuthRepository();

  final AuthRepository _repository;

  TycoonUser? user;
  bool isLoading = true;
  String? bootstrapError;
  bool web3AuthReady = false;

  bool get isLoggedIn => user != null;
  bool get canUseWeb3Auth => AppConfig.hasWeb3Auth && web3AuthReady;

  Future<void> bootstrap() async {
    isLoading = true;
    bootstrapError = null;
    notifyListeners();
    try {
      if (AppConfig.hasWeb3Auth) {
        await Web3AuthService.init();
        web3AuthReady = true;
        final hasSession = await Web3AuthService.tryRestoreSession();
        if (hasSession) {
          final idToken = await Web3AuthService.getIdToken();
          if (idToken != null) {
            await _repository.web3AuthSignIn(idToken: idToken);
          }
        }
      }
      user = await _repository.fetchMe();
    } catch (e) {
      bootstrapError = e.toString();
      user = null;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshUser() async {
    user = await _repository.fetchMe();
    notifyListeners();
  }

  Future<Web3AuthSignInResult> completeBackendSignIn({String? username}) async {
    final idToken = await Web3AuthService.getIdToken();
    if (idToken == null) {
      return const Web3AuthSignInResult(
        ok: false,
        message: 'Could not get Web3Auth session. Try again.',
      );
    }
    return _repository.web3AuthSignIn(idToken: idToken, username: username);
  }

  Future<Web3AuthSignInResult> signInWithEmail({
    required String email,
    String? username,
  }) async {
    await Web3AuthService.loginWithEmail(email);
    return completeBackendSignIn(username: username);
  }

  Future<Web3AuthSignInResult> completeUsername(String username) async {
    return completeBackendSignIn(username: username);
  }

  Future<void> signOut() async {
    await _repository.clearSession();
    if (web3AuthReady) {
      try {
        await Web3AuthService.logout();
      } catch (_) {}
    }
    user = null;
    notifyListeners();
  }

  AuthRepository get repository => _repository;
}
