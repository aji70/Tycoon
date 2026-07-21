class TycoonUser {
  const TycoonUser({
    required this.id,
    required this.username,
    required this.address,
    this.isGuest = true,
    this.email,
  });

  final int id;
  final String username;
  final String address;
  final bool isGuest;
  final String? email;

  factory TycoonUser.fromJson(Map<String, dynamic> json) {
    return TycoonUser(
      id: _asInt(json['id']),
      username: json['username']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      isGuest: _asBool(json['is_guest'], fallback: true),
      email: json['email']?.toString(),
    );
  }

  static int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static bool _asBool(dynamic value, {required bool fallback}) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final v = value.toLowerCase();
      if (v == 'true' || v == '1') return true;
      if (v == 'false' || v == '0') return false;
    }
    return fallback;
  }
}
