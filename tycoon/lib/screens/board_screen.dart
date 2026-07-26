import 'package:flutter/material.dart';
import 'package:tycoon/app_config.dart';
import 'package:tycoon/auth/session_store.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Loads the production web 3D board (`/board-3d-mobile`) inside the app.
class BoardScreen extends StatefulWidget {
  const BoardScreen({
    super.key,
    required this.gameCode,
    this.multiplayer = false,
  });

  final String gameCode;
  final bool multiplayer;

  @override
  State<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends State<BoardScreen> {
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

  Uri get _boardUri {
    final base = AppConfig.webBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final path = widget.multiplayer ? 'board-3d-multi-mobile' : 'board-3d-mobile';
    return Uri.parse(
      '$base/$path?gameCode=${Uri.encodeQueryComponent(widget.gameCode.trim().toUpperCase())}',
    );
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
            // Ignore subresource errors; only fail hard on main-frame issues.
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
    // Stop loading so native WebView stops posting events after Flutter detaches.
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
      if (url.contains('board-3d') || url.contains('about:blank')) {
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
      await c.loadRequest(_boardUri);
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
        title: Text('Game ${widget.gameCode}'),
        actions: [
          IconButton(
            tooltip: 'Reload board',
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
                    const Text(
                      'Loading 3D board…',
                      style: TextStyle(color: TycoonColors.textMuted),
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
