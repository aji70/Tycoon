import 'package:flutter/foundation.dart';
import 'package:tycoon/auth/auth_repository.dart';
import 'package:tycoon/auth/tycoon_user.dart';

class AuthController extends ChangeNotifier {
  AuthController({AuthRepository? repository})
      : _repository = repository ?? AuthRepository();

  final AuthRepository _repository;

  TycoonUser? user;
  bool isLoading = true;
  String? bootstrapError;

  bool get isLoggedIn => user != null;

  Future<void> bootstrap() async {
    isLoading = true;
    bootstrapError = null;
    notifyListeners();
    try {
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

  Future<SignInResult> signInWithEmail(String email) async {
    final result = await _repository.loginByEmail(email);
    if (!result.ok) return result;

    if (result.user != null) {
      user = result.user;
      notifyListeners();
    }

    // /auth/me can be slow (on-chain wallet setup). Refresh in background.
    _refreshUserInBackground();
    return result;
  }

  void _refreshUserInBackground() {
    _repository.fetchMe().then((profile) {
      if (profile != null) {
        user = profile;
        notifyListeners();
      }
    }).catchError((_) {});
  }

  Future<void> signOut() async {
    await _repository.clearSession();
    user = null;
    notifyListeners();
  }

  AuthRepository get repository => _repository;
}
