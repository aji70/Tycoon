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

  Future<SignInResult> signInWithEmail(String email) =>
      _repository.loginByEmail(email);

  Future<void> signOut() async {
    await _repository.clearSession();
    user = null;
    notifyListeners();
  }

  AuthRepository get repository => _repository;
}
