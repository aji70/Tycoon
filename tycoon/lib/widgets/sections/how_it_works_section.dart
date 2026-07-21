import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/game_badge.dart';
import 'package:tycoon/widgets/game_panel.dart';

class _SlideData {
  const _SlideData({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;
}

const _slides = [
  _SlideData(
    icon: Icons.power,
    title: 'Connect & Play',
    description:
        'Connect your Web3 wallet to start playing Tycoon. It helps you join games, save progress, and keep your rewards safe.',
  ),
  _SlideData(
    icon: Icons.casino_outlined,
    title: 'Let the Games Begin',
    description:
        "Once you're in, join a game and play with people from around the world. Roll the dice, buy virtual properties, make deals, and try to win!",
  ),
  _SlideData(
    icon: Icons.show_chart,
    title: 'Think Smart, Play Hard',
    description:
        "Tycoon isn't just about luck—it's about smart moves. Buy wisely, make good deals, and try to beat your opponents. Every choice you make counts.",
  ),
  _SlideData(
    icon: Icons.emoji_events_outlined,
    title: 'Rise to the Top',
    description:
        'The more you play, the higher you go! Win games, finish challenges, and earn rewards to move up the leaderboard.',
  ),
];

const _backgrounds = [
  'assets/images/howItWorksBg1.png',
  'assets/images/howItWorksBg2.png',
  'assets/images/howItWorksBg3.png',
  'assets/images/howItWorksBg4.png',
];

class HowItWorksSection extends StatefulWidget {
  const HowItWorksSection({super.key});

  @override
  State<HowItWorksSection> createState() => _HowItWorksSectionState();
}

class _HowItWorksSectionState extends State<HowItWorksSection> {
  final _pageController = PageController(viewportFraction: 0.9);
  int _current = 0;
  Timer? _autoTimer;

  @override
  void initState() {
    super.initState();
    _autoTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_pageController.hasClients) return;
      final next = (_current + 1) % _slides.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 720,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 700),
            child: Image.asset(
              _backgrounds[_current],
              key: ValueKey(_current),
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) =>
                  const ColoredBox(color: TycoonColors.background),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  TycoonColors.background.withValues(alpha: 0),
                  TycoonColors.background,
                  TycoonColors.background,
                ],
              ),
            ),
          ),
          Column(
            children: [
              const SizedBox(height: 48),
              const GameBadge(label: 'TUTORIAL'),
              const SizedBox(height: 8),
              const Text(
                'How it works',
                style: TextStyle(
                  color: TycoonColors.textWhite,
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'Complete each step to master Tycoon. Simple flow, zero stress.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: TycoonColors.textBodyAlt,
                    fontSize: 18,
                    height: 1.5,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: _slides.length,
                  onPageChanged: (i) => setState(() => _current = i),
                  itemBuilder: (context, index) {
                    final slide = _slides[index];
                    final active = index == _current;
                    return AnimatedScale(
                      scale: active ? 1 : 0.95,
                      duration: const Duration(milliseconds: 300),
                      child: AnimatedOpacity(
                        opacity: active ? 1 : 0.4,
                        duration: const Duration(milliseconds: 300),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: GamePanel(
                            padding: const EdgeInsets.all(24),
                            backgroundAlpha: 0.12,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Icon(
                                      slide.icon,
                                      color: TycoonColors.cyanBrightAlt,
                                      size: 24,
                                    ),
                                    Text(
                                      'LEVEL ${index + 1}',
                                      style: TextStyle(
                                        color: TycoonColors.cyan
                                            .withValues(alpha: 0.9),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: 1.8,
                                      ),
                                    ),
                                  ],
                                ),
                                const Spacer(),
                                Text(
                                  slide.title.toUpperCase(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  slide.description,
                                  style: const TextStyle(
                                    color: TycoonColors.slideText,
                                    fontSize: 17,
                                    height: 1.55,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _slides.length; i++)
                    GestureDetector(
                      onTap: () => _pageController.animateToPage(
                        i,
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      ),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: _current == i ? 36 : 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: _current == i
                              ? TycoonColors.cyan
                              : TycoonColors.dotInactive,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: _current == i
                              ? [
                                  BoxShadow(
                                    color: TycoonColors.cyan
                                        .withValues(alpha: 0.45),
                                    blurRadius: 12,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 32),
            ],
          ),
        ],
      ),
    );
  }
}
