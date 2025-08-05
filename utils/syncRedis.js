import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Score from '../models/Score.js';
import redisService from '../services/redisService.js';
import leaderboardService from '../services/leaderboardService.js';

dotenv.config();

const syncDataToRedis = async () => {
  try {
    console.log('🔄 Starting data sync to Redis...');

    // Connect to databases
    await mongoose.connect(process.env.MONGO_URI);
    await redisService.connect();

    console.log('✅ Connected to MongoDB and Redis');

    // Sync global leaderboard (all users by total score)
    const users = await User.find({ isActive: true }).select('_id totalScore');
    console.log(`📊 Syncing ${users.length} users to global leaderboard...`);

    for (const user of users) {
      if (user.totalScore > 0) {
        await leaderboardService.updateGlobalLeaderboard(user._id, user.totalScore);
      }
    }

    // Sync game-specific leaderboards
    const gameTypes = ['puzzle', 'racing', 'quiz', 'arcade', 'strategy'];
    
    for (const gameType of gameTypes) {
      console.log(`🎮 Syncing ${gameType} leaderboard...`);
      
      // Get best score for each user in this game type
      const bestScores = await Score.aggregate([
        { $match: { gameType, isValid: true } },
        {
          $group: {
            _id: '$userId',
            bestScore: { $max: '$score' }
          }
        }
      ]);

      console.log(`   Found ${bestScores.length} players for ${gameType}`);

      for (const { _id: userId, bestScore } of bestScores) {
        await leaderboardService.updateGameLeaderboard(gameType, userId, bestScore);
      }
    }

    console.log('✅ Data sync completed successfully!');
    
    // Show some stats
    const globalSize = await leaderboardService.getGlobalLeaderboardSize();
    console.log(`📈 Global leaderboard has ${globalSize} players`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
};

// Run the sync
syncDataToRedis();
