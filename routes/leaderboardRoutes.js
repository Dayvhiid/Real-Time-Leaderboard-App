import express from 'express';
import { 
  getGlobalLeaderboard, 
  getGameLeaderboard, 
  getUserRankings, 
  getTopPlayersReport 
} from '../controllers/leaderboardController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get global leaderboard (public route)
router.get('/global', getGlobalLeaderboard);

// Get game-specific leaderboard (public route)
router.get('/game/:gameType', getGameLeaderboard);

// Get current user's rankings (protected route)
router.get('/my-rankings', auth, getUserRankings);

// Get top players report (public route)
router.get('/report', getTopPlayersReport);

export default router;
