import 'package:flutter/material.dart';
import 'package:tycoon/auth/auth_controller.dart';
import 'package:tycoon/main.dart';
import 'package:tycoon/screens/checkout_webview_screen.dart';
import 'package:tycoon/screens/login_screen.dart';
import 'package:tycoon/screens/web_app_screen.dart';
import 'package:tycoon/services/api_client.dart';
import 'package:tycoon/services/shop_api.dart';
import 'package:tycoon/theme/tycoon_colors.dart';

class PerkShopScreen extends StatefulWidget {
  const PerkShopScreen({super.key});

  @override
  State<PerkShopScreen> createState() => _PerkShopScreenState();
}

class _PerkShopScreenState extends State<PerkShopScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final _api = ShopApi();

  List<ShopBundle> _bundles = const [];
  final List<CatalogPerk> _perks = PerkCatalog.all();
  bool _ngnAvailable = false;
  bool _loading = true;
  String? _error;
  bool _buying = false;

  AuthController get _auth => TycoonAuthScope.of(context);

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _api.fetchBundles();
      if (!mounted) return;
      setState(() {
        _bundles = result.bundles;
        _ngnAvailable = result.ngnAvailable;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<bool> _ensureAuth() async {
    if (_auth.isLoggedIn) return true;
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
    return ok == true && mounted && _auth.isLoggedIn;
  }

  void _openWebShop() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const WebAppScreen(
          title: 'Perk Shop',
          path: '/game-shop',
        ),
      ),
    );
  }

  Future<void> _buyBundleNgn(ShopBundle bundle) async {
    if (!_ngnAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Naira checkout is unavailable right now')),
      );
      return;
    }
    if (!await _ensureAuth()) return;
    if (!mounted) return;

    setState(() => _buying = true);
    try {
      final link = await _api.initializeBundleNgn(bundle.id);
      if (!mounted) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => CheckoutWebViewScreen(
            title: 'Pay ₦${bundle.priceNgn}',
            url: link,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      final needsWallet = e.message.toLowerCase().contains('wallet') ||
          e.message.toLowerCase().contains('delivery');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          action: needsWallet
              ? SnackBarAction(label: 'Web shop', onPressed: _openWebShop)
              : null,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _buying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      appBar: AppBar(
        backgroundColor: TycoonColors.background,
        foregroundColor: TycoonColors.cyan,
        title: const Text('Perk Shop'),
        actions: [
          IconButton(
            tooltip: 'Full web shop',
            onPressed: _openWebShop,
            icon: const Icon(Icons.open_in_browser),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: TycoonColors.cyan,
          labelColor: TycoonColors.cyan,
          unselectedLabelColor: TycoonColors.textMuted,
          tabs: const [
            Tab(text: 'Bundles'),
            Tab(text: 'Perks'),
          ],
        ),
      ),
      body: Stack(
        children: [
          if (_loading)
            const Center(child: CircularProgressIndicator(color: TycoonColors.cyan))
          else if (_error != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          else
            TabBarView(
              controller: _tabs,
              children: [
                RefreshIndicator(
                  color: TycoonColors.cyan,
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: _bundles.length + 1,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      if (i == 0) {
                        return Text(
                          _ngnAvailable
                              ? 'Buy bundles in Naira in-app. TYC / USDC purchases use the full shop (wallet).'
                              : 'Browse bundles here. Open the full shop to complete purchases.',
                          style: const TextStyle(
                            color: TycoonColors.textMuted,
                            fontSize: 13,
                            height: 1.35,
                          ),
                        );
                      }
                      final b = _bundles[i - 1];
                      return _BundleTile(
                        bundle: b,
                        ngnAvailable: _ngnAvailable,
                        onBuyNgn: () => _buyBundleNgn(b),
                        onOpenWeb: _openWebShop,
                      );
                    },
                  ),
                ),
                ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: _perks.length + 1,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    if (i == 0) {
                      return const Text(
                        'Single perks mint on-chain. Open the full shop to buy with TYC, USDC, or Naira.',
                        style: TextStyle(
                          color: TycoonColors.textMuted,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      );
                    }
                    final p = _perks[i - 1];
                    return _PerkTile(perk: p, onBuy: _openWebShop);
                  },
                ),
              ],
            ),
          if (_buying)
            Container(
              color: Colors.black54,
              child: const Center(
                child: CircularProgressIndicator(color: TycoonColors.cyan),
              ),
            ),
        ],
      ),
    );
  }
}

class _BundleTile extends StatelessWidget {
  const _BundleTile({
    required this.bundle,
    required this.ngnAvailable,
    required this.onBuyNgn,
    required this.onOpenWeb,
  });

  final ShopBundle bundle;
  final bool ngnAvailable;
  final VoidCallback onBuyNgn;
  final VoidCallback onOpenWeb;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: TycoonColors.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: TycoonColors.tealDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            bundle.name,
            style: const TextStyle(
              color: TycoonColors.cyanBright,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            bundle.description,
            style: const TextStyle(color: TycoonColors.textBody, height: 1.35),
          ),
          const SizedBox(height: 10),
          Text(
            '${bundle.priceTyc} TYC · \$${bundle.priceUsdc} · ₦${bundle.priceNgn}',
            style: const TextStyle(
              color: TycoonColors.textMuted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (ngnAvailable)
                Expanded(
                  child: FilledButton(
                    onPressed: onBuyNgn,
                    style: FilledButton.styleFrom(
                      backgroundColor: TycoonColors.cyan,
                      foregroundColor: TycoonColors.background,
                    ),
                    child: Text('Buy ₦${bundle.priceNgn}'),
                  ),
                ),
              if (ngnAvailable) const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: onOpenWeb,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: TycoonColors.cyan,
                    side: const BorderSide(color: TycoonColors.tealDark),
                  ),
                  child: const Text('TYC / USDC'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PerkTile extends StatelessWidget {
  const _PerkTile({required this.perk, required this.onBuy});

  final CatalogPerk perk;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: TycoonColors.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: TycoonColors.tealDark),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  perk.name,
                  style: const TextStyle(
                    color: TycoonColors.textWhite,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${perk.tycPrice} TYC · \$${perk.usdcPrice} · ₦${perk.ngnPrice}',
                  style: const TextStyle(
                    color: TycoonColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onBuy,
            child: const Text('Buy'),
          ),
        ],
      ),
    );
  }
}
