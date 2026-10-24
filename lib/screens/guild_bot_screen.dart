import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:math';

class GuildBotScreen extends StatefulWidget {
  const GuildBotScreen({super.key});
  @override
  State<GuildBotScreen> createState() => _GuildBotScreenState();
}

enum BotStatus { idle, running, stopped, error }

class _GuildBotScreenState extends State<GuildBotScreen> {
  final _guildCtrl = TextEditingController();
  final _logsCtrl = ScrollController();
  int _matchCount = 5;
  int _matchesPlayed = 0;
  BotStatus _status = BotStatus.idle;
  final List<String> _logs = [];
  Timer? _botTimer;
  final Random _rand = Random();

  void _log(String msg) {
    final time = TimeOfDay.now().format(context);
    setState(() => _logs.add('[$time] $msg'));
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_logsCtrl.hasClients) {
        _logsCtrl.animateTo(
          _logsCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _start() {
    final guildId = _guildCtrl.text.trim();
    if (guildId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter Guild ID'), backgroundColor: Color(0xFFF85149)));
      return;
    }

    setState(() {
      _status = BotStatus.running;
      _matchesPlayed = 0;
      _logs.clear();
    });

    _log('Bot started');
    _log('Target Guild: $guildId');
    _log('Matches to play: $_matchCount');
    _log('Sending guild join request...');

    Future.delayed(Duration(seconds: 1 + _rand.nextInt(3)), () {
      if (_status != BotStatus.running) return;
      _log('Guild request sent ✓');
      _runMatches(guildId);
    });
  }

  void _runMatches(String guildId) {
    if (_matchesPlayed >= _matchCount || _status != BotStatus.running) {
      _log('All matches complete. Bot stopped.');
      setState(() => _status = BotStatus.stopped);
      return;
    }

    final matchNum = _matchesPlayed + 1;
    _log('Starting match #$matchNum...');

    // Simulate match phases
    int elapsed = 0;

    void phase(int delayMs, String msg) {
      _botTimer = Timer(Duration(milliseconds: elapsed + delayMs), () {
        if (_status != BotStatus.running) return;
        _log(msg);
      });
      elapsed += delayMs;
    }

    phase(0, 'In queue...');
    phase(3000 + _rand.nextInt(5000), 'Joined match — parachuting');
    phase(8000 + _rand.nextInt(5000), 'Landed at ${_randomZone()}');
    phase(5000 + _rand.nextInt(4000), 'Looting...');
    phase(8000 + _rand.nextInt(6000), 'Moving to safe zone');
    phase(6000 + _rand.nextInt(5000), 'Dealt ${10 + _rand.nextInt(40)} damage');
    phase(10000 + _rand.nextInt(8000), 'Match #$matchNum complete ✓');

    _botTimer = Timer(Duration(milliseconds: elapsed + 500), () {
      if (_status != BotStatus.running) return;
      setState(() => _matchesPlayed++);
      
      final rest = 5000 + _rand.nextInt(10000);
      _log('Resting ${(rest / 1000).toStringAsFixed(0)}s...');
      
      _botTimer = Timer(Duration(milliseconds: rest), () {
        _runMatches(guildId);
      });
    });
  }

  String _randomZone() {
    const zones = ['Clock Tower', 'Peak', 'Pochinok', 'Bimasakti', 'Shipyard', 'Graveyard', 'Hangar', 'Mars Electric'];
    return zones[_rand.nextInt(zones.length)];
  }

  void _stop() {
    _botTimer?.cancel();
    setState(() => _status = BotStatus.stopped);
    _log('Stop signal received — bot halted');
  }

  Color get _statusColor {
    switch (_status) {
      case BotStatus.running: return const Color(0xFF3FB950);
      case BotStatus.stopped: return const Color(0xFFD29922);
      case BotStatus.error: return const Color(0xFFF85149);
      default: return const Color(0xFF8B949E);
    }
  }

  String get _statusText {
    switch (_status) {
      case BotStatus.running: return 'RUNNING';
      case BotStatus.stopped: return 'STOPPED';
      case BotStatus.error: return 'ERROR';
      default: return 'IDLE';
    }
  }

  @override
  void dispose() {
    _botTimer?.cancel();
    _guildCtrl.dispose();
    _logsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080C10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1117),
        title: const Text('GUILD BOT',
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
            // Status bar
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1117),
                border: Border.all(color: _statusColor.withOpacity(0.4)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(children: [
                    Container(width: 8, height: 8,
                      decoration: BoxDecoration(color: _statusColor, shape: BoxShape.circle)),
                    const SizedBox(width: 8),
                    Text(_statusText, style: TextStyle(
                      color: _statusColor, fontFamily: 'monospace', fontSize: 13, letterSpacing: 1)),
                  ]),
                  Text('$_matchesPlayed / $_matchCount matches',
                    style: const TextStyle(color: Color(0xFF8B949E), fontSize: 12, fontFamily: 'monospace')),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Inputs
            TextField(
              controller: _guildCtrl,
              enabled: _status != BotStatus.running,
              style: const TextStyle(color: Color(0xFFC9D1D9), fontFamily: 'monospace'),
              decoration: _inputDeco('Guild ID'),
            ),
            const SizedBox(height: 12),

            // Match count
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1117),
                border: Border.all(color: const Color(0xFF1E2733)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Matches', style: TextStyle(color: Color(0xFF8B949E), fontFamily: 'monospace', fontSize: 13)),
                  Row(children: [
                    _counterBtn(Icons.remove, () {
                      if (_matchCount > 1 && _status != BotStatus.running) {
                        setState(() => _matchCount--);
                      }
                    }),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text('$_matchCount', style: const TextStyle(
                        color: Color(0xFF00E5FF), fontFamily: 'monospace', fontSize: 18, fontWeight: FontWeight.bold)),
                    ),
                    _counterBtn(Icons.add, () {
                      if (_matchCount < 50 && _status != BotStatus.running) {
                        setState(() => _matchCount++);
                      }
                    }),
                  ]),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Start/Stop
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _status == BotStatus.running ? _stop : _start,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _status == BotStatus.running
                    ? const Color(0xFFF85149)
                    : const Color(0xFF00E5FF),
                  foregroundColor: _status == BotStatus.running ? Colors.white : Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: Text(
                  _status == BotStatus.running ? '⏹ STOP BOT' : '▶ START BOT',
                  style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 2, fontFamily: 'monospace'),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Logs
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1117),
                  border: Border.all(color: const Color(0xFF1E2733)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: _logs.isEmpty
                  ? const Center(child: Text('Logs appear here', style: TextStyle(color: Color(0xFF3A4250), fontFamily: 'monospace', fontSize: 12)))
                  : ListView.builder(
                      controller: _logsCtrl,
                      itemCount: _logs.length,
                      itemBuilder: (_, i) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(_logs[i], style: const TextStyle(
                          color: Color(0xFF8B949E), fontFamily: 'monospace', fontSize: 11)),
                      ),
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDeco(String hint) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: Color(0xFF3A4250), fontFamily: 'monospace'),
    filled: true,
    fillColor: const Color(0xFF0D1117),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1E2733))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1E2733))),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF00E5FF))),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  );

  Widget _counterBtn(IconData icon, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(0xFF1E2733),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Icon(icon, color: const Color(0xFF8B949E), size: 16),
    ),
  );
}
