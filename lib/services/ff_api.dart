import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

class FFPlayer {
  final String uid;
  final String nickname;
  final int level;
  final int exp;
  final String region;
  final int likes;
  final String createdAt;
  final String lastLogin;
  final String petName;

  FFPlayer({
    required this.uid,
    required this.nickname,
    required this.level,
    required this.exp,
    required this.region,
    required this.likes,
    required this.createdAt,
    required this.lastLogin,
    required this.petName,
  });

  factory FFPlayer.fromJson(Map<String, dynamic> j) {
    final b = j['basic_info'] ?? j;
    final p = j['pet_info'] ?? {};
    return FFPlayer(
      uid: '${b['accountid'] ?? ''}',
      nickname: '${b['nickname'] ?? 'Unknown'}',
      level: (b['level'] ?? 0) as int,
      exp: (b['exp'] ?? 0) as int,
      region: '${b['region'] ?? ''}',
      likes: (b['likes'] ?? 0) as int,
      createdAt: '${b['createdat'] ?? ''}',
      lastLogin: '${b['lastlogin'] ?? ''}',
      petName: '${p['name'] ?? '—'}',
    );
  }
}

class FFSearchResult {
  final String uid;
  final String nickname;
  final int level;
  final String region;

  FFSearchResult({
    required this.uid,
    required this.nickname,
    required this.level,
    required this.region,
  });

  factory FFSearchResult.fromJson(Map<String, dynamic> j) {
    return FFSearchResult(
      uid: '${j['uid'] ?? j['accountid'] ?? ''}',
      nickname: '${j['nickname'] ?? 'Unknown'}',
      level: (j['level'] ?? 0) as int,
      region: '${j['region'] ?? ''}',
    );
  }
}

class FFStats {
  final int gamesPlayed;
  final int wins;
  final int kills;
  final int deaths;
  final int headshots;
  final int damage;
  final int highestKills;

  FFStats({
    required this.gamesPlayed,
    required this.wins,
    required this.kills,
    required this.deaths,
    required this.headshots,
    required this.damage,
    required this.highestKills,
  });

  double get winRate =>
      gamesPlayed > 0 ? (wins / gamesPlayed * 100) : 0;

  double get kd =>
      deaths > 0 ? (kills / deaths) : kills.toDouble();

  factory FFStats.fromJson(Map<String, dynamic> j) {
    final d = j['detailedstats'] ?? {};
    return FFStats(
      gamesPlayed: (j['gamesplayed'] ?? 0) as int,
      wins: (j['wins'] ?? 0) as int,
      kills: (j['kills'] ?? 0) as int,
      deaths: (d['deaths'] ?? 0) as int,
      headshots: (d['headshotkills'] ?? 0) as int,
      damage: (d['damage'] ?? 0) as int,
      highestKills: (d['highestkills'] ?? 0) as int,
    );
  }
}

class FFItems {
  final String nickname;
  final List<String> outfits;
  final List<String> weapons;
  final List<String> skills;
  final String petName;

  FFItems({
    required this.nickname,
    required this.outfits,
    required this.weapons,
    required this.skills,
    required this.petName,
  });

  factory FFItems.fromJson(Map<String, dynamic> j) {
    final b = j['basic_info'] ?? {};
    final items = j['items'] ?? {};
    final outfitList = (items['outfit'] as List? ?? [])
        .map((e) => '${e['name'] ?? 'Item ${e['id']}'}')
        .toList();
    final weaponList =
        ((items['weapons']?['shown_skins']) as List? ?? [])
            .map((e) => '${e['name'] ?? 'Weapon ${e['id']}'}')
            .toList();
    final skillIds =
        (items['skills']?['equipped'] as List? ?? [])
            .map((e) => '${e['name'] ?? 'Skill ${e['id']}'}')
            .toList();
    return FFItems(
      nickname: '${b['nickname'] ?? ''}',
      outfits: outfitList,
      weapons: weaponList,
      skills: skillIds,
      petName: '${items['pet']?['name'] ?? '—'}',
    );
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class FFApiService {
  // Backend proxy endpoints — Node.js backend (api-server) jo
  // @arbakti_store/freefire-api wrap karta hai
  final String _base;

  FFApiService() : _base = AppConfig.backendUrl;

  Future<T> _get<T>(
      String path, T Function(Map<String, dynamic>) fromJson) async {
    final uri = Uri.parse('$_base$path');
    final res = await http.get(uri).timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) {
      final body = jsonDecode(res.body);
      throw Exception(body['detail'] ?? 'Server error ${res.statusCode}');
    }
    return fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<List<FFSearchResult>> searchPlayer(String keyword) async {
    final uri = Uri.parse('$_base/search?q=${Uri.encodeComponent(keyword)}');
    final res = await http.get(uri).timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) throw Exception('Search failed');
    final List data = jsonDecode(res.body);
    return data
        .map((e) => FFSearchResult.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<FFPlayer> getProfile(String uid) =>
      _get('/profile/$uid', FFPlayer.fromJson);

  Future<Map<String, FFStats>> getBRStats(String uid) async {
    final uri = Uri.parse('$_base/stats/$uid/br/career');
    final res = await http.get(uri).timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) throw Exception('Stats fetch failed');
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return {
      'solo': FFStats.fromJson(data['solo'] ?? {}),
      'duo': FFStats.fromJson(data['duo'] ?? {}),
      'squad': FFStats.fromJson(data['squad'] ?? {}),
    };
  }

  Future<Map<String, FFStats>> getBRRanked(String uid) async {
    final uri = Uri.parse('$_base/stats/$uid/br/ranked');
    final res = await http.get(uri).timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) throw Exception('Ranked stats failed');
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return {
      'solo': FFStats.fromJson(data['solo'] ?? {}),
      'duo': FFStats.fromJson(data['duo'] ?? {}),
      'squad': FFStats.fromJson(data['squad'] ?? {}),
    };
  }

  Future<FFItems> getItems(String uid) =>
      _get('/items/$uid', FFItems.fromJson);


}
