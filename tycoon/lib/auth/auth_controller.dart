import 'package:flutter/foundation.dart';
import 'package:privy_flutter/privy_flutter.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/auth_repository.dart';
import 'package:tycoon/auth/tycoon_user.dart';

class AuthController extends ChangeNotifier {
  AuthController({Privy? privy, AuthRepository? repository})
      : privy = privy,
        _repository = repository ?? AuthRepository();

  final Privy? privy;
  final AuthRepository _repository;

  TycoonUser? user;
  bool isLoading = true;
  String? bootstrapError;

  bool get isLoggedIn => user != null;
  bool get canUsePrivy => privy != null && AppConfig.hasPrivy;

  Future<void> bootstrap() async {
    isLoading = true;
    bootstrapError = null;
    notifyListeners();
    try {
      if (privy != null) {
        await privy!.getAuthState();
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

  Future<void> signOut() async {
    await _repository.clearSession();
    if (privy != null) {
      await privy!.logout();
    }
    user = null;
    notifyListeners();
  }

  Future<String?> getPrivyAccessToken() async {
    if (privy == null) return null;
    final privyUser = await privy!.getUser();
    if (privyUser == null) return null;
    final tokenResult = await privyUser.getAccessToken();
    return switch (tokenResult) {
      Success(:final value) => value,
      Failure() => null,
    };
  }

  AuthRepository get repository => _repository;
}
