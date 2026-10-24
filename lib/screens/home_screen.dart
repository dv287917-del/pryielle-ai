import 'package:flutter/material.dart';
import '../services/ff_api.dart';
import 'player_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _searchCtrl = TextEditingController();
  bool _loading = false;
  List<FFSearchResult> _results = [];
  String? _error;

  Future<void> _search() async {
    final q = _searchCtrl.text.trim();
    if (q.isEmpty) return;
    setState(() { _loading = true; _error = null; _results = []; });
    try {
      final api = FFApiService();
      if (RegExp(r'^\d{6,}$').hasMatch(q)) {
        final profile = await api.getProfile(q);
        if (mounted) {
          Navigator.push(context,
              MaterialPageRoute(
                  builder: (_) => PlayerScreen(uid: q, name: profile.nickname)));
        }
        return;
      }
      final res = await api.searchPlayer(q);
      setState(() => _results = res);
      if (res.isEmpty) setState(() => _error = 'Koi player nahi mila');
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080C10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1117),
        elevation: 0,
        title: const Text('FF GLORY',
            style: TextStyle(
                color: Color(0xFF00E5FF),
                fontFamily: 'monospace',
                letterSpacing: 2,
                fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Color(0xFF8B949E)),
            onPressed: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchCtrl,
                    style: const TextStyle(
                        color: Color(0xFFC9D1D9), fontFamily: 'monospace'),
                    onSubmitted: (_) => _search(),
                    decoration: InputDecoration(
                      hintText: 'Player naam ya UID daalo...',
                      hintStyle: const TextStyle(
                          color: Color(0xFF3A4250),
                          fontFamily: 'monospace',
                          fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFF0D1117),
                      prefixIcon: const Icon(Icons.search,
                          color: Color(0xFF8B949E), size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF1E2733)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF1E2733)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF00E5FF)),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  onPressed: _loading ? null : _search,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00E5FF),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.black))
                      : const Icon(Icons.arrow_forward, size: 18),
                ),
              ],
            ),
          ),

          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1A0A0A),
                  border: Border.all(
                      color: const Color(0xFFF85149).withOpacity(0.4)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_error!,
                    style: const TextStyle(
                        color: Color(0xFFF85149),
                        fontSize: 12,
                        fontFamily: 'monospace')),
              ),
            ),

          Expanded(
            child: _results.isEmpty && _error == null && !_loading
                ? _emptyState()
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _results.length,
                    itemBuilder: (_, i) => _resultTile(_results[i]),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _resultTile(FFSearchResult p) {
    return GestureDetector(
      onTap: () => Navigator.push(context,
          MaterialPageRoute(
              builder: (_) => PlayerScreen(uid: p.uid, name: p.nickname))),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          border: Border.all(color: const Color(0xFF1E2733)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFF1E2733),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  p.nickname.isNotEmpty ? p.nickname[0].toUpperCase() : '?',
                  style: const TextStyle(
                      color: Color(0xFF00E5FF),
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                      fontSize: 16),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.nickname,
                      style: const TextStyle(
                          color: Color(0xFFC9D1D9),
                          fontFamily: 'monospace',
                          fontSize: 14,
                          fontWeight: FontWeight.bold)),
                  const SizedBox(height: 3),
                  Text('UID: ${p.uid}  •  Lv ${p.level}  •  ${p.region}',
                      style: const TextStyle(
                          color: Color(0xFF8B949E),
                          fontSize: 11,
                          fontFamily: 'monospace')),
                ],
              ),
            ),
            const Icon(Icons.chevron_right,
                color: Color(0xFF3A4250), size: 20),
          ],
        ),
      ),
    );
  }

  Widget _emptyState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('🎮', style: TextStyle(fontSize: 48)),
          SizedBox(height: 16),
          Text('Player dhundo',
              style: TextStyle(
                  color: Color(0xFF3A4250),
                  fontFamily: 'monospace',
                  fontSize: 14)),
          SizedBox(height: 6),
          Text('naam ya UID se search karo',
              style: TextStyle(
                  color: Color(0xFF3A4250),
                  fontFamily: 'monospace',
                  fontSize: 11)),
        ],
      ),
    );
  }
}
