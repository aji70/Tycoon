/// In-app route ids. Each maps to a native screen (or Coming Soon for now).
class AppRoutes {
  AppRoutes._();

  static const home = '/';
  static const profile = '/profile';
  static const leaderboard = '/leaderboard';
  static const howToPlay = '/how-to-play';
  static const gameShop = '/game-shop';
  static const tournaments = '/tournaments';
  static const agentTournaments = '/agent-tournaments';
  static const arena = '/arena';
  static const rooms = '/rooms';
  static const terms = '/terms';
  static const privacy = '/privacy';
  static const cookies = '/cookies';
  static const multiplayer = '/game-settings-3d';
  static const joinRoom = '/join-room-3d';
  static const playAi = '/play-ai-3d';

  static const titles = <String, String>{
    home: 'Home',
    profile: 'Profile',
    leaderboard: 'Leaderboard',
    howToPlay: 'How to Play',
    gameShop: 'Perk Shop',
    tournaments: 'Tournaments',
    agentTournaments: 'Agent Tournaments',
    arena: 'Agents',
    rooms: 'Rooms',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    cookies: 'Cookies',
    multiplayer: 'Multiplayer',
    joinRoom: 'Join Room',
    playAi: 'Challenge AI',
  };

  static String titleFor(String route) => titles[route] ?? 'Tycoon';
}
