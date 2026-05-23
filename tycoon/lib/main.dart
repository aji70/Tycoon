import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:privy_flutter/privy_flutter.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/env_loader.dart';
import 'package:tycoon/screens/home_screen.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: TycoonColors.background,
    ),
  );

  AppConfig.init(await loadLocalEnvFile());

  Privy? privy;
  if (AppConfig.hasPrivy) {
    privy = Privy.init(
      config: PrivyConfig(
        appId: AppConfig.privyAppId,
        appClientId: AppConfig.privyClientId,
      ),
    );
  }

  final auth = AuthController(privy: privy);
  await auth.bootstrap();

  runApp(TycoonApp(auth: auth));
}

class TycoonAuthScope extends InheritedNotifier<AuthController> {
  const TycoonAuthScope({
    required AuthController auth,
    required super.child,
    super.key,
  }) : super(notifier: auth);

  static AuthController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<TycoonAuthScope>();
    assert(scope != null, 'TycoonAuthScope not found');
    return scope!.notifier!;
  }
}

class TycoonApp extends StatelessWidget {
  const TycoonApp({required this.auth, super.key});

  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    return TycoonAuthScope(
      auth: auth,
      child: MaterialApp(
        title: 'Tycoon',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.dark,
          scaffoldBackgroundColor: TycoonColors.background,
          colorScheme: const ColorScheme.dark(
            primary: TycoonColors.cyan,
            surface: TycoonColors.background,
          ),
          useMaterial3: true,
        ),
        home: ListenableBuilder(
          listenable: auth,
          builder: (context, _) {
            if (auth.isLoading) {
              return const Scaffold(
                backgroundColor: TycoonColors.background,
                body: Center(
                  child: CircularProgressIndicator(color: TycoonColors.cyan),
                ),
              );
            }
            return const HomeScreen();
          },
        ),
      ),
    );
  }
}
