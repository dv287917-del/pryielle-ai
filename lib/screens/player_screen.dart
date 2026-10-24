import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/ff_api.dart';

class PlayerScreen extends StatefulWidget {
  final String uid;
  final String name;
  const PlayerScreen({super.key, required this.uid, required this.name});
  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  final _api = FFApiService();

  FFPlayer? _profile;
  Map<String, FFStats>? _brCareer;
  Map<String, FFStats>? _brRanked;
  FFItems? _items;

  bool _loadingProfile = true;
  bool _loadingStats = true;
  bool _loadingItems = true;

  String? _profileErr;
  String? _statsErr;
  String? _itemsErr;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
    _fetchProfile();
    _fetchStats();
    _fetchItems();
  }

  Future<void> _fetchProfile() async {
    try {
      final p = await _api.getProfile(widget.uid);
      if (mounted) setState(() { _profile = p; _loadingProfile = false; });
    } catch (e) {
      if (mounted) setState(() {
        _profileErr = e.toString().replaceAll('Exception: ', '');
        _loadingProfile = false;
      });
    }
  }

  Future<void> _fetchStats() async {
    try {
      final career = await _api.getBRStats(widget.uid);
      final ranked = await _api.getBRRanked(widget.uid);
      if (mounted) setState(() {
        _brCareer = career;
        _brRanked = ranked;
        _loadingStats = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _statsErr = e.toString().replaceAll('Exception: ', '');
        _loadingStats = false;
      });
    }
  }

  Future<void> _fetchItems() async {
    try {
      final it = await _api.getItems(widget.uid);
      if (mounted) setState(() { _items = it; _loadingItems = false; });
    } catch (e) {
      if (mounted) setState(() {
        _itemsErr = e.toString().replaceAll('Exception: ', '');
        _loadingItems = false;
      });
    }
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080C10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1117),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF8B949E)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.name,
                style: const TextStyle(
                    color: Color(0xFFC9D1D9),
                    fontFamily: 'monospace',
                    fontSize: 15,
                    fontWeight: FontWeight.bold)),
            Text('UID: ${widget.uid}',
                style: const TextStyle(
                    color: Color(0xFF8B949E),
                    fontSize: 11,
                    fontFamily: 'monospace')),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy, color: Color(0xFF8B949E), size: 18),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: widget.uid));
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                content: Text('UID copied'),
                backgroundColor: Color(0xFF1E2733),
                duration: Duration(seconds: 1),
              ));
            },
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          labelColor: const Color(0xFF00E5FF),
          unselectedLabelColor: const Color(0xFF8B949E),
          indicatorColor: const Color(0xFF00E5FF),
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: const TextStyle(
              fontFamily: 'monospace', fontSize: 12, letterSpacing: 1),
          tabs: const [
            Tab(text: 'PROFILE'),
            Tab(text: 'STATS'),
            Tab(text: 'ITEMS'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _profileTab(),
          _statsTab(),
          _itemsTab(),
        ],
      ),
    );
  }

  // ── PROFILE TAB ──────────────────────────────────────────────────────────

  Widget _profileTab() {
    if (_loadingProfile) return _loader();
    if (_profileErr != null) return _errWidget(_profileErr!);
    final p = _profile!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Avatar + name card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              border: Border.all(
                  color: const Color(0xFF00E5FF).withOpacity(0.3)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E2733),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: const Color(0xFF00E5FF).withOpacity(0.4)),
                  ),
                  child: Center(
                    child: Text(
                      p.nickname.isNotEmpty
                          ? p.nickname[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                          color: Color(0xFF00E5FF),
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace'),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(p.nickname,
                    style: const TextStyle(
                        color: Color(0xFFC9D1D9),
                        fontFamily: 'monospace',
                        fontSize: 18,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('${p.region} • Level ${p.level}',
                    style: const TextStyle(
                        color: Color(0xFF8B949E),
                        fontFamily: 'monospace',
                        fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Stats grid
          Row(children: [
            Expanded(child: _statBox('LEVEL', '${p.level}', const Color(0xFF00E5FF))),
            const SizedBox(width: 10),
            Expanded(child: _statBox('LIKES', _fmt(p.likes), const Color(0xFFFF6B35))),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _statBox('EXP', _fmt(p.exp), const Color(0xFF3FB950))),
            const SizedBox(width: 10),
            Expanded(child: _statBox('PET', p.petName, const Color(0xFFD29922))),
          ]),
          const SizedBox(height: 10),

          // Info tiles
          _infoTile('Region', p.region),
          _infoTile('UID', p.uid),
          if (p.lastLogin.isNotEmpty) _infoTile('Last Login', p.lastLogin),
          if (p.createdAt.isNotEmpty) _infoTile('Joined', p.createdAt),
        ],
      ),
    );
  }

  Widget _statBox(String label, String value, Color accent) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        border: Border.all(color: accent.withOpacity(0.25)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  color: accent.withOpacity(0.7),
                  fontSize: 10,
                  fontFamily: 'monospace',
                  letterSpacing: 1)),
          const SizedBox(height: 6),
          Text(value,
              style: const TextStyle(
                  color: Color(0xFFC9D1D9),
                  fontFamily: 'monospace',
                  fontSize: 20,
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _infoTile(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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

  // ── STATS TAB ─────────────────────────────────────────────────────────────

  Widget _statsTab() {
    if (_loadingStats) return _loader();
    if (_statsErr != null) return _errWidget(_statsErr!);

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const TabBar(
            labelColor: Color(0xFF00E5FF),
            unselectedLabelColor: Color(0xFF8B949E),
            indicatorColor: Color(0xFF00E5FF),
            labelStyle:
                TextStyle(fontFamily: 'monospace', fontSize: 11),
            tabs: [Tab(text: 'CAREER'), Tab(text: 'RANKED')],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _statsGrid(_brCareer!),
                _statsGrid(_brRanked!),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statsGrid(Map<String, FFStats> data) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: ['solo', 'duo', 'squad'].map((mode) {
          final s = data[mode];
          if (s == null) return const SizedBox.shrink();
          return _modeCard(mode.toUpperCase(), s);
        }).toList(),
      ),
    );
  }

  Widget _modeCard(String mode, FFStats s) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        border: Border.all(color: const Color(0xFF1E2733)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(mode,
              style: const TextStyle(
                  color: Color(0xFF00E5FF),
                  fontFamily: 'monospace',
                  fontSize: 12,
                  letterSpacing: 1,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _mini('Matches', '${s.gamesPlayed}')),
            Expanded(child: _mini('Wins', '${s.wins}')),
            Expanded(child: _mini('Win%', '${s.winRate.toStringAsFixed(1)}%')),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _mini('Kills', '${s.kills}')),
            Expanded(child: _mini('K/D', s.kd.toStringAsFixed(2))),
            Expanded(child: _mini('Best', '${s.highestKills}')),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _mini('Headshots', '${s.headshots}')),
            Expanded(child: _mini('Damage', _fmt(s.damage))),
            const Expanded(child: SizedBox()),
          ]),
        ],
      ),
    );
  }

  Widget _mini(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Color(0xFF8B949E),
                fontSize: 10,
                fontFamily: 'monospace')),
        const SizedBox(height: 3),
        Text(value,
            style: const TextStyle(
                color: Color(0xFFC9D1D9),
                fontFamily: 'monospace',
                fontSize: 15,
                fontWeight: FontWeight.bold)),
      ],
    );
  }

  // ── ITEMS TAB ────────────────────────────────────────────────────────────

  Widget _itemsTab() {
    if (_loadingItems) return _loader();
    if (_itemsErr != null) return _errWidget(_itemsErr!);
    final it = _items!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('PET'),
          _chipRow([it.petName]),
          const SizedBox(height: 14),
          _sectionHeader('OUTFIT (${it.outfits.length})'),
          it.outfits.isEmpty
              ? _emptyChip()
              : _chipRow(it.outfits),
          const SizedBox(height: 14),
          _sectionHeader('WEAPONS (${it.weapons.length})'),
          it.weapons.isEmpty
              ? _emptyChip()
              : _chipRow(it.weapons),
          const SizedBox(height: 14),
          _sectionHeader('SKILLS (${it.skills.length})'),
          it.skills.isEmpty
              ? _emptyChip()
              : _chipRow(it.skills),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title,
          style: const TextStyle(
              color: Color(0xFF8B949E),
              fontFamily: 'monospace',
              fontSize: 11,
              letterSpacing: 1)),
    );
  }

  Widget _chipRow(List<String> items) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((item) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFF0D1117),
            border: Border.all(color: const Color(0xFF1E2733)),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(item,
              style: const TextStyle(
                  color: Color(0xFFC9D1D9),
                  fontFamily: 'monospace',
                  fontSize: 12)),
        );
      }).toList(),
    );
  }

  Widget _emptyChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        border: Border.all(color: const Color(0xFF1E2733)),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text('—',
          style: TextStyle(
              color: Color(0xFF3A4250),
              fontFamily: 'monospace',
              fontSize: 12)),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _loader() {
    return const Center(
      child: CircularProgressIndicator(
          color: Color(0xFF00E5FF), strokeWidth: 2),
    );
  }

  Widget _errWidget(String msg) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(msg,
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Color(0xFFF85149),
                fontFamily: 'monospace',
                fontSize: 13)),
      ),
    );
  }

  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }
}
