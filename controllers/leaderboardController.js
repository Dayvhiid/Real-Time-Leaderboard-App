import leaderboardService from '../services/leaderboardService.js';
import User from '../models/User.js';

// Get global leaderboard
const getGlobalLeaderboard = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const leaderboard = await leaderboardService.getGlobalLeaderboard(
      parseInt(limit),
      offset
    );

    const totalPlayers = await leaderboardService.getGlobalLeaderboardSize();

    res.json({
      leaderboard,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPlayers / parseInt(limit)),
        totalPlayers,
        hasNext: offset + parseInt(limit) < totalPlayers
      }
    });

  } catch (error) {
    console.error('Get global leaderboard error:', error);
    res.status(500).json({ error: 'Server error fetching global leaderboard' });
  }
};

// Get game-specific leaderboard
const getGameLeaderboard = async (req, res) => {
  try {
    const { gameType } = req.params;
    const { limit = 10, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Validate game type
    const validGameTypes = ['puzzle', 'racing', 'quiz', 'arcade', 'strategy'];
    if (!validGameTypes.includes(gameType)) {
      return res.status(400).json({ error: 'Invalid game type' });
    }

    const leaderboard = await leaderboardService.getGameLeaderboard(
      gameType,
      parseInt(limit),
      offset
    );

    res.json({
      gameType,
      leaderboard,
      pagination: {
        currentPage: parseInt(page),
        totalPlayers: leaderboard.length
      }
    });

  } catch (error) {
    console.error('Get game leaderboard error:', error);
    res.status(500).json({ error: 'Server error fetching game leaderboard' });
  }
};

// Get user's current rankings
const getUserRankings = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get global rank
    const globalRank = await leaderboardService.getUserGlobalRank(userId);
    const totalPlayers = await leaderboardService.getGlobalLeaderboardSize();

    // Get ranks for each game type
    const gameTypes = ['puzzle', 'racing', 'quiz', 'arcade', 'strategy'];
    const gameRanks = {};

    for (const gameType of gameTypes) {
      const rank = await leaderboardService.getUserGameRank(gameType, userId);
      if (rank) {
        gameRanks[gameType] = rank;
      }
    }

    // Get user details
    const user = await User.findById(userId).select('username totalScore gamesPlayed');

    res.json({
      user: {
        username: user.username,
        totalScore: user.totalScore,
        gamesPlayed: user.gamesPlayed
      },
      rankings: {
        global: {
          rank: globalRank,
          outOf: totalPlayers
        },
        byGame: gameRanks
      }
    });

  } catch (error) {
    console.error('Get user rankings error:', error);
    res.status(500).json({ error: 'Server error fetching user rankings' });
  }
};

// Get top players for a specific period (last 7 days, 30 days, etc.)
const getTopPlayersReport = async (req, res) => {
  try {
    const { period = '7d', gameType } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get leaderboard (Redis gives us current state, but we can filter by recent activity)
    let leaderboard;
    if (gameType) {
      leaderboard = await leaderboardService.getGameLeaderboard(gameType, 20);
    } else {
      leaderboard = await leaderboardService.getGlobalLeaderboard(20);
    }

    res.json({
      period,
      gameType: gameType || 'global',
      reportDate: now.toISOString(),
      topPlayers: leaderboard,
      summary: {
        totalPlayers: leaderboard.length,
        periodDescription: `Top players in the last ${period}`
      }
    });

  } catch (error) {
    console.error('Get top players report error:', error);
    res.status(500).json({ error: 'Server error generating report' });
  }
};

export { 
  getGlobalLeaderboard, 
  getGameLeaderboard, 
  getUserRankings, 
  getTopPlayersReport 
};
