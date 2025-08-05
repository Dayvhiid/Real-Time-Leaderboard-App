import Score from '../models/Score.js';
import User from '../models/User.js';
import leaderboardService from '../services/leaderboardService.js';

// Submit a new score
const submitScore = async (req, res) => {
  try {
    const { gameType, score, level, duration } = req.body;
    const userId = req.user._id;

    // Create new score entry
    const newScore = new Score({
      userId,
      gameType,
      score,
      level,
      duration
    });

    await newScore.save();

    // Update user's total score and games played
    const updatedUser = await User.findByIdAndUpdate(userId, {
      $inc: { 
        totalScore: score,
        gamesPlayed: 1
      }
    }, { new: true });

    // Update Redis leaderboards
    try {
      // Update global leaderboard with new total score
      await leaderboardService.updateGlobalLeaderboard(userId, updatedUser.totalScore);
      
      // Update game-specific leaderboard (use the highest score for this game)
      const userBestInGame = await Score.findOne({ userId, gameType })
        .sort({ score: -1 })
        .limit(1);
      
      if (userBestInGame) {
        await leaderboardService.updateGameLeaderboard(gameType, userId, userBestInGame.score);
      }
    } catch (redisError) {
      console.warn('Redis update failed:', redisError.message);
      // Continue even if Redis fails - we still saved to MongoDB
    }

    res.status(201).json({
      message: 'Score submitted successfully',
      score: {
        id: newScore._id,
        gameType: newScore.gameType,
        score: newScore.score,
        level: newScore.level,
        duration: newScore.duration,
        createdAt: newScore.createdAt
      }
    });

  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Server error submitting score' });
  }
};

// Get user's score history
const getUserScores = async (req, res) => {
  try {
    const userId = req.user._id;
    const { gameType, limit = 10, page = 1 } = req.query;

    const query = { userId };
    if (gameType) {
      query.gameType = gameType;
    }

    const scores = await Score.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-userId');

    const totalScores = await Score.countDocuments(query);

    res.json({
      scores,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalScores / parseInt(limit)),
        totalScores,
        hasNext: page * limit < totalScores
      }
    });

  } catch (error) {
    console.error('Get user scores error:', error);
    res.status(500).json({ error: 'Server error fetching scores' });
  }
};

// Get user's best scores by game type
const getUserBestScores = async (req, res) => {
  try {
    const userId = req.user._id;

    const bestScores = await Score.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$gameType',
          bestScore: { $max: '$score' },
          totalGames: { $sum: 1 },
          avgScore: { $avg: '$score' },
          lastPlayed: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          gameType: '$_id',
          bestScore: 1,
          totalGames: 1,
          avgScore: { $round: ['$avgScore', 2] },
          lastPlayed: 1,
          _id: 0
        }
      }
    ]);

    res.json({ bestScores });

  } catch (error) {
    console.error('Get best scores error:', error);
    res.status(500).json({ error: 'Server error fetching best scores' });
  }
};

// Get recent scores (for activity feed)
const getRecentScores = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const recentScores = await Score.find({ isValid: true })
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('gameType score level duration createdAt');

    res.json({ recentScores });

  } catch (error) {
    console.error('Get recent scores error:', error);
    res.status(500).json({ error: 'Server error fetching recent scores' });
  }
};

export { submitScore, getUserScores, getUserBestScores, getRecentScores };
