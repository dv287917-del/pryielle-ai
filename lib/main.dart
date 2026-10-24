import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'screens/home_screen.dart';
import 'screens/guild_bot_screen.dart';
import 'screens/settings_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FF Glory Bot',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF00E5FF),
          surface: const Color(0xFF0D1117),
        ),
        scaffoldBackgroundColor: const Color(0xFF080C10),
        fontFamily: 'monospace',
      ),
      initialRoute: '/home',
      routes: {
        '/home': (_) => const HomeScreen(),
        '/guild-bot': (_) => const GuildBotScreen(),
        '/settings': (_) => const SettingsScreen(),
      },
    );
  }
}
