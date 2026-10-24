import 'package:flutter/material.dart';
import '../config.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080C10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1117),
        title: const Text('SETTINGS',
          style: TextStyle(color: Color(0xFF00E5FF), fontFamily: 'monospace', letterSpacing: 2, fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF8B949E)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _infoTile('📱', 'App Version', AppConfig.version),
            const SizedBox(height: 12),
            _infoTile('⚡', 'Access', 'Unlimited'),
          ],
        ),
      ),
    );
  }

  Widget _infoTile(String emoji, String title, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        border: Border.all(color: const Color(0xFF1E2733)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Text(emoji, style: const TextStyle(fontSize: 22)),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(color: Color(0xFF8B949E), fontSize: 12)),
          Text(value, style: const TextStyle(color: Color(0xFFC9D1D9), fontFamily: 'monospace', fontSize: 13)),
        ]),
      ]),
    );
  }
}
