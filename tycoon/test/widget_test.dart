import 'package:flutter_test/flutter_test.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/home_screen.dart';

void main() {
  testWidgets('Tycoon home screen builds', (WidgetTester tester) async {
    AppConfig.init({});
    final auth = AuthController();
    auth.isLoading = false;
    await tester.pumpWidget(TycoonApp(auth: auth));
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('TYCOON'), findsOneWidget);
    expect(find.text("Let's Go!"), findsOneWidget);
  });
}
