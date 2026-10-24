import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  Widget _menuCard(BuildContext context, String emoji, String label, String route) {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, route),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          border: Border.all(color: const Color(0xFF1E2733)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 36)),
            const SizedBox(height: 12),
            Text(label, style: const TextStyle(
              color: Color(0xFFC9D1D9),
              fontSize: 13,
              fontFamily: 'monospace',
              letterSpacing: 1,
            ), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080C10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1117),
        title: const Text('FF GLORY BOT',
          style: TextStyle(color: Color(0xFF00E5FF), fontFamily: 'monospace', letterSpacing: 2, fontSize: 16)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1117),
                border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.3)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(children: [
                Text('⚡', style: TextStyle(fontSize: 24)),
                SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('FF Glory Bot', style: TextStyle(color: Color(0xFF00E5FF), fontFamily: 'monospace', fontSize: 15, fontWeight: FontWeight.bold)),
                  Text('Unlimited Access', style: TextStyle(color: Color(0xFF3FB950), fontSize: 12, fontFamily: 'monospace')),
                ]),
              ]),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 14,
                mainAxisSpacing: 14,
                children: [
                  _menuCard(context, '⚔️', 'GUILD BOT', '/guild-bot'),
                  _menuCard(context, '⚙️', 'SETTINGS', '/settings'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
