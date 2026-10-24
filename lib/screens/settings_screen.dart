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
            style: TextStyle(
                color: Color(0xFF00E5FF),
                fontFamily: 'monospace',
                letterSpacing: 2,
                fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF8B949E)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _tile('App', AppConfig.appName),
            _tile('Version', AppConfig.version),
            _tile('Region', AppConfig.region.toUpperCase()),
          ],
        ),
      ),
    );
  }

  Widget _tile(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        border: Border.all(color: const Color(0xFF1E2733)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: Color(0xFF8B949E),
                  fontFamily: 'monospace',
                  fontSize: 12)),
          Text(value,
              style: const TextStyle(
                  color: Color(0xFFC9D1D9),
                  fontFamily: 'monospace',
                  fontSize: 12)),
        ],
      ),
    );
  }
}
