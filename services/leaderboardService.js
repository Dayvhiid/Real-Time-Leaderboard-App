import redisService from './redisService.js';
import User from '../models/User.js';
import Score from '../models/Score.js';

class LeaderboardService {
  constructor() {
    this.globalLeaderboardKey = 'leaderboard:global';
    this.gameLeaderboardPrefix = 'leaderboard:game:';
  }

  // Fallback method to get global leaderboard from MongoDB
  async getGlobalLeaderboardFromDB(limit = 10, offset = 0) {
    const users = await User.find({ isActive: true, totalScore: { $gt: 0 } })
      .sort({ totalScore: -1 })
      .skip(offset)
      .limit(limit)
      .select('username totalScore');

    return users.map((user, index) => ({
      rank: offset + index + 1,
      userId: user._id,
      username: user.username,
      totalScore: user.totalScore
    }));
  }

  // Fallback method to get game leaderboard from MongoDB
  async getGameLeaderboardFromDB(gameType, limit = 10, offset = 0) {
    const pipeline = [
      { $match: { gameType, isValid: true } },
      {
        $group: {
          _id: '$userId',
          bestScore: { $max: '$score' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $match: { 'user.isActive': true } },
      { $sort: { bestScore: -1 } },
      { $skip: offset },
      { $limit: limit }
    ];

    const results = await Score.aggregate(pipeline);
    
    return results.map((result, index) => ({
      rank: offset + index + 1,
      userId: result._id,
      username: result.user.username,
      bestScore: result.bestScore,
      gameType
    }));
  }

  // Fallback method to get user's global rank from MongoDB
  async getUserGlobalRankFromDB(userId) {
    const user = await User.findById(userId).select('totalScore');
    if (!user || user.totalScore <= 0) return null;

    const higherScoreCount = await User.countDocuments({
      isActive: true,
      totalScore: { $gt: user.totalScore }
    });

    return higherScoreCount + 1;
  }

  // Fallback method to get user's game rank from MongoDB
  async getUserGameRankFromDB(gameType, userId) {
    // Get user's best score for this game
    const userBestScore = await Score.findOne({ userId, gameType, isValid: true })
      .sort({ score: -1 })
      .select('score');
    
    if (!userBestScore) return null;

    // Count how many users have better scores
    const pipeline = [
      { $match: { gameType, isValid: true } },
      {
        $group: {
          _id: '$userId',
          bestScore: { $max: '$score' }
        }
      },
      {
        $match: { bestScore: { $gt: userBestScore.score } }
      },
      {
        $count: 'higherScores'
      }
    ];

    const result = await Score.aggregate(pipeline);
    const higherScoreCount = result.length > 0 ? result[0].higherScores : 0;

    return higherScoreCount + 1;
  }

  // Add or update user score in global leaderboard
  async updateGlobalLeaderboard(userId, totalScore) {
    try {
      if (!redisService.isReady()) {
        console.log('Redis not available, skipping global leaderboard update');
        return true; // Return success, MongoDB is the source of truth
      }

      const client = redisService.getClient();
      await client.zAdd(this.globalLeaderboardKey, {
        score: totalScore,
        value: userId.toString()
      });

      return true;
    } catch (error) {
      console.warn('Error updating global leaderboard in Redis:', error.message);
      return true; // Don't fail the operation, MongoDB has the data
    }
  }

  // Add or update user score in game-specific leaderboard
  async updateGameLeaderboard(gameType, userId, score) {
    try {
      if (!redisService.isReady()) {
        console.log('Redis not available, skipping game leaderboard update');
        return true; // Return success, MongoDB is the source of truth
      }

      const client = redisService.getClient();
      const key = `${this.gameLeaderboardPrefix}${gameType}`;
      
      await client.zAdd(key, {
        score: score,
        value: userId.toString()
      });

      return true;
    } catch (error) {
      console.warn('Error updating game leaderboard in Redis:', error.message);
      return true; // Don't fail the operation, MongoDB has the data
    }
  }

  // Get global leaderboard (top players)
  async getGlobalLeaderboard(limit = 10, offset = 0) {
    try {
      // Try Redis first
      if (redisService.isReady()) {
        const client = redisService.getClient();
        
        // Get top players with scores (highest to lowest)
        const results = await client.zRevRangeWithScores(
          this.globalLeaderboardKey,
          offset,
          offset + limit - 1
        );

        // Format results and get user details
        const leaderboard = [];
        for (let i = 0; i < results.length; i++) {
          const { value: userId, score } = results[i];
          const user = await User.findById(userId).select('username');
          
          if (user) {
            leaderboard.push({
              rank: offset + i + 1,
              userId,
              username: user.username,
              totalScore: score
            });
          }
        }

        return leaderboard;
      } else {
        // Fallback to MongoDB
        console.log('Using MongoDB fallback for global leaderboard');
        return await this.getGlobalLeaderboardFromDB(limit, offset);
      }
    } catch (error) {
      console.error('Error getting global leaderboard from Redis, falling back to MongoDB:', error);
      return await this.getGlobalLeaderboardFromDB(limit, offset);
    }
  }

  // Get game-specific leaderboard
  async getGameLeaderboard(gameType, limit = 10, offset = 0) {
    try {
      // Try Redis first
      if (redisService.isReady()) {
        const client = redisService.getClient();
        const key = `${this.gameLeaderboardPrefix}${gameType}`;
        
        const results = await client.zRevRangeWithScores(key, offset, offset + limit - 1);

        const leaderboard = [];
        for (let i = 0; i < results.length; i++) {
          const { value: userId, score } = results[i];
          const user = await User.findById(userId).select('username');
          
          if (user) {
            leaderboard.push({
              rank: offset + i + 1,
              userId,
              username: user.username,
              bestScore: score,
              gameType
            });
          }
        }

        return leaderboard;
      } else {
        // Fallback to MongoDB
        console.log(`Using MongoDB fallback for ${gameType} leaderboard`);
        return await this.getGameLeaderboardFromDB(gameType, limit, offset);
      }
    } catch (error) {
      console.error('Error getting game leaderboard from Redis, falling back to MongoDB:', error);
      return await this.getGameLeaderboardFromDB(gameType, limit, offset);
    }
  }

  // Get user's rank in global leaderboard
  async getUserGlobalRank(userId) {
    try {
      if (!redisService.isReady()) {
        console.log('Redis not available, calculating rank from MongoDB');
        return await this.getUserGlobalRankFromDB(userId);
      }

      const client = redisService.getClient();
      const rank = await client.zRevRank(this.globalLeaderboardKey, userId.toString());
      
      return rank !== null ? rank + 1 : null; // Convert to 1-based ranking
    } catch (error) {
      console.warn('Error getting user global rank from Redis, falling back to MongoDB:', error.message);
      return await this.getUserGlobalRankFromDB(userId);
    }
  }

  // Get user's rank in game-specific leaderboard
  async getUserGameRank(gameType, userId) {
    try {
      if (!redisService.isReady()) {
        console.log('Redis not available, calculating game rank from MongoDB');
        return await this.getUserGameRankFromDB(gameType, userId);
      }

      const client = redisService.getClient();
      const key = `${this.gameLeaderboardPrefix}${gameType}`;
      const rank = await client.zRevRank(key, userId.toString());
      
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      console.warn('Error getting user game rank from Redis, falling back to MongoDB:', error.message);
      return await this.getUserGameRankFromDB(gameType, userId);
    }
  }

  // Get total number of players in global leaderboard
  async getGlobalLeaderboardSize() {
    try {
      if (!redisService.isReady()) {
        console.log('Redis not available, counting from MongoDB');
        return await User.countDocuments({ isActive: true, totalScore: { $gt: 0 } });
      }

      const client = redisService.getClient();
      return await client.zCard(this.globalLeaderboardKey);
    } catch (error) {
      console.warn('Error getting leaderboard size from Redis, falling back to MongoDB:', error.message);
      return await User.countDocuments({ isActive: true, totalScore: { $gt: 0 } });
    }
  }

  // Remove user from all leaderboards
  async removeUserFromLeaderboards(userId) {
    try {
      if (!redisService.isReady()) {
        console.log('Redis not available, skipping leaderboard cleanup');
        return true; // MongoDB operations will handle data consistency
      }

      const client = redisService.getClient();
      
      // Remove from global leaderboard
      await client.zRem(this.globalLeaderboardKey, userId.toString());
      
      // Remove from all game leaderboards
      const gameTypes = ['puzzle', 'racing', 'quiz', 'arcade', 'strategy'];
      for (const gameType of gameTypes) {
        const key = `${this.gameLeaderboardPrefix}${gameType}`;
        await client.zRem(key, userId.toString());
      }

      return true;
    } catch (error) {
      console.warn('Error removing user from Redis leaderboards:', error.message);
      return true; // Don't fail the operation
    }
  }
}

// Create singleton instance
const leaderboardService = new LeaderboardService();

export default leaderboardService;
