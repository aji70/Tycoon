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
      id: json['id'] as int,
      username: json['username'] as String,
      address: json['address'] as String,
      isGuest: (json['is_guest'] as bool?) ?? true,
      email: json['email'] as String?,
    );
  }
}
