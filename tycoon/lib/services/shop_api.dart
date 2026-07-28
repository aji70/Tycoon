import 'package:tycoon/services/api_client.dart';

class ShopBundle {
  const ShopBundle({
    required this.id,
    required this.name,
    required this.description,
    required this.priceTyc,
    required this.priceUsdc,
    required this.priceNgn,
  });

  final int id;
  final String name;
  final String description;
  final String priceTyc;
  final String priceUsdc;
  final int priceNgn;

  factory ShopBundle.fromJson(Map<String, dynamic> json) {
    int n(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    return ShopBundle(
      id: n(json['id']),
      name: json['name']?.toString() ?? 'Bundle',
      description: json['description']?.toString() ?? '',
      priceTyc: json['price_tyc']?.toString() ?? '0',
      priceUsdc: json['price_usdc']?.toString() ?? '0',
      priceNgn: n(json['price_ngn']),
    );
  }
}

class CatalogPerk {
  const CatalogPerk({
    required this.perk,
    required this.name,
    required this.strength,
    required this.tycPrice,
    required this.usdcPrice,
    required this.ngnPrice,
  });

  final int perk;
  final String name;
  final int strength;
  final String tycPrice;
  final String usdcPrice;
  final int ngnPrice;
}

/// Mirrors backend `shopStockConstants` + NGN conversion used by `/api/shop/bundles`.
abstract final class PerkCatalog {
  static const names = <int, String>{
    1: 'Extra Turn',
    2: 'Get Out of Jail Free',
    3: 'Double Rent',
    4: 'Roll Boost',
    5: 'Instant Cash',
    6: 'Teleport',
    7: 'Shield',
    8: 'Property Discount',
    9: 'Tax Refund',
    10: 'Exact Roll',
    11: 'Rent Cashback',
    12: 'Interest',
    13: 'Lucky 7',
    14: 'Free Parking Bonus',
  };

  static const _raw = <(int, int, String, String)>[
    (1, 1, '0.75', '0.10'),
    (2, 1, '1.0', '0.12'),
    (3, 1, '1.4', '0.30'),
    (4, 1, '1.0', '0.10'),
    (8, 1, '1.25', '0.25'),
    (7, 1, '1.5', '0.40'),
    (6, 1, '1.8', '0.60'),
    (10, 1, '2.5', '1.00'),
    (11, 1, '1.2', '0.25'),
    (12, 1, '1.0', '0.20'),
    (13, 1, '1.1', '0.22'),
    (5, 1, '0.5', '0.10'),
    (5, 2, '0.8', '0.15'),
    (5, 3, '1.2', '0.30'),
    (5, 4, '1.6', '0.50'),
    (5, 5, '2.0', '0.90'),
    (9, 1, '0.6', '0.10'),
    (14, 1, '1.0', '0.20'),
  ];

  static int _ngnFromUsdc(String usdc) {
    const rate = 1600;
    const minNgn = 100;
    final base = ((double.tryParse(usdc) ?? 0) * rate).round();
    if (base < minNgn) return minNgn;
    if (base > 1000) return (base * 0.8).round();
    return base;
  }

  static List<CatalogPerk> all() {
    return _raw.map((e) {
      final (perk, strength, tyc, usdc) = e;
      final baseName = names[perk] ?? 'Perk $perk';
      final name = strength > 1 ? '$baseName (T$strength)' : baseName;
      return CatalogPerk(
        perk: perk,
        name: name,
        strength: strength,
        tycPrice: tyc,
        usdcPrice: usdc,
        ngnPrice: _ngnFromUsdc(usdc),
      );
    }).toList();
  }
}

class ShopApi {
  ShopApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<({List<ShopBundle> bundles, bool ngnAvailable})> fetchBundles() async {
    final body = await _client.getJson('/api/shop/bundles');
    final data = body['data'] as Map? ?? body;
    final list = data['bundles'] as List? ?? const [];
    final bundles = list
        .whereType<Map>()
        .map((e) => ShopBundle.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return (
      bundles: bundles,
      ngnAvailable: data['ngn_available'] == true,
    );
  }

  /// Returns Flutterwave checkout URL for a bundle (requires delivery wallet on account).
  Future<String> initializeBundleNgn(int bundleId) async {
    final body = await _client.postJson(
      '/api/shop/flutterwave/initialize',
      auth: true,
      body: {'bundle_id': bundleId},
    );
    final link = body['link']?.toString();
    if (link == null || link.isEmpty) {
      throw ApiException('No checkout link returned');
    }
    return link;
  }
}
