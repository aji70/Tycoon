import 'package:flutter/material.dart';
import 'package:tycoon/theme/tycoon_colors.dart';
import 'package:tycoon/widgets/hero_section.dart';
import 'package:tycoon/widgets/sections/home_footer.dart';
import 'package:tycoon/widgets/sections/how_it_works_section.dart';
import 'package:tycoon/widgets/sections/join_community_section.dart';
import 'package:tycoon/widgets/sections/what_is_tycoon_section.dart';

/// Full home page — matches web `HomeClient` (mobile hero + sections).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TycoonColors.background,
      body: const SingleChildScrollView(
        child: Column(
          children: [
            HeroSection(),
            WhatIsTycoonSection(),
            HowItWorksSection(),
            JoinCommunitySection(),
            HomeFooter(),
          ],
        ),
      ),
    );
  }
}
