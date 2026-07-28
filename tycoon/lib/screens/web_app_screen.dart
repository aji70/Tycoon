import 'package:flutter/material.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/session_store.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Loads a Tycoon web page inside the app with JWT injected into localStorage.
class WebAppScreen extends StatefulWidget {
  const WebAppScreen({
    super.key,
    required this.title,
    required this.path,
    this.readyWhenContains,
  });

  final String title;

  /// Path on the web app, e.g. `/game-shop` or `/arena`.
  final String path;

  /// Optional substring of the final URL used to hide the loading overlay.
  /// Defaults to [path].
  final String? readyWhenContains;

  @override
  State<WebAppScreen> createState() => _WebAppScreenState();
}

class _WebAppScreenState extends State<WebAppScreen> {
  WebViewController? _controller;
  final _store = SessionStore();

  bool _booting = true;
  bool _tokenInjected = false;
  bool _injecting = false;
  bool _disposed = false;
  String? _error;
  double _progress = 0;

  Uri get _originUri {
    final base = AppConfig.webBaseUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse(base);
  }

  Uri get _targetUri {
    final base = AppConfig.webBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final path = widget.path.startsWith('/') ? widget.path : '/${widget.path}';
    return Uri.parse('$base$path');
  }

  String get _readyNeedle {
    final custom = widget.readyWhenContains;
    if (custom != null && custom.isNotEmpty) return custom;
    return widget.path.replaceFirst(RegExp(r'^/'), '');
  }

  @override
  void initState() {
    super.initState();
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF010F10))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) {
            if (_disposed || !mounted) return;
            setState(() => _progress = p / 100);
          },
          onPageFinished: _onPageFinished,
          onWebResourceError: (err) {
            if (_disposed || !mounted) return;
            if (err.isForMainFrame != true) return;
            setState(() {
              _error = err.description;
              _booting = false;
            });
          },
        ),
      );
    _controller = controller;
    controller.loadRequest(_originUri);
  }

  @override
  void dispose() {
    _disposed = true;
    final c = _controller;
    _controller = null;
    if (c != null) {
      c
        ..setNavigationDelegate(NavigationDelegate())
        ..loadRequest(Uri.parse('about:blank'));
    }
    super.dispose();
  }

  Future<void> _onPageFinished(String url) async {
    if (_disposed || !mounted) return;

    if (_tokenInjected) {
      if (url.contains(_readyNeedle) || url.contains('about:blank')) {
        if (mounted && !_disposed) setState(() => _booting = false);
      }
      return;
    }
    if (_injecting) return;
    _injecting = true;

    try {
      final token = await _store.readToken();
      if (_disposed || !mounted) return;

      final c = _controller;
      if (c == null) return;

      if (token != null && token.isNotEmpty) {
        final escaped = token
            .replaceAll('\\', '\\\\')
            .replaceAll("'", "\\'")
            .replaceAll('\n', '');
        await c.runJavaScript(
          "try{localStorage.setItem('token','$escaped');}catch(e){}",
        );
      }
      if (_disposed || !mounted) return;

      _tokenInjected = true;
      await c.loadRequest(_targetUri);
    } catch (e) {
      if (_disposed || !mounted) return;
      setState(() {
        _error = e.toString();
        _booting = false;
      });
    } finally {
      _injecting = false;
    }
  }

  void _reload() {
    if (_disposed || _controller == null) return;
    setState(() {
      _booting = true;
      _tokenInjected = false;
      _injecting = false;
      _error = null;
      _progress = 0;
    });
    _controller!.loadRequest(_originUri);
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;

    return Scaffold(
      backgroundColor: const Color(0xFF010F10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF010F10),
        foregroundColor: TycoonColors.cyan,
        title: Text(widget.title),
        actions: [
          IconButton(
            tooltip: 'Reload',
            onPressed: _reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_error != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _reload,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          else if (controller != null)
            WebViewWidget(controller: controller),
          if (_booting && _error == null)
            ColoredBox(
              color: const Color(0xFF010F10),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(color: TycoonColors.cyan),
                    const SizedBox(height: 16),
                    Text(
                      'Loading ${widget.title}…',
                      style: const TextStyle(color: TycoonColors.textMuted),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: 160,
                      child: LinearProgressIndicator(
                        value: _progress > 0 ? _progress : null,
                        color: TycoonColors.cyan,
                        backgroundColor: TycoonColors.cyan.withValues(alpha: 0.15),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
