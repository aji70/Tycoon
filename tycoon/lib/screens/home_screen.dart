import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/hero_section.dart';
import 'package:tycoon/widgets/mobile_nav_bar.dart';
import 'package:tycoon/widgets/sections/home_footer.dart';
import 'package:tycoon/widgets/sections/how_it_works_section.dart';
import 'package:tycoon/widgets/sections/join_community_section.dart';
import 'package:tycoon/widgets/sections/what_is_tycoon_section.dart';

/// Full home page — matches web `HomeClient` (mobile hero + sections + nav).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToTop() {
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      body: Stack(
        children: [
          SingleChildScrollView(
            controller: _scrollController,
            child: const Column(
              children: [
                HeroSection(),
                WhatIsTycoonSection(),
                HowItWorksSection(),
                JoinCommunitySection(),
                HomeFooter(),
              ],
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: MobileNavBar(onHomeTap: _scrollToTop),
          ),
        ],
      ),
    );
  }
}
