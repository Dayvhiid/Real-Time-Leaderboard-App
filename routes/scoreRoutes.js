import express from 'express';
import { submitScore, getUserScores, getUserBestScores, getRecentScores } from '../controllers/scoreController.js';
import auth from '../middleware/auth.js';
import { validateScore, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Submit a new score (protected route)
router.post('/submit', auth, validateScore, handleValidationErrors, submitScore);

// Get current user's score history (protected route)
router.get('/my-scores', auth, getUserScores);

// Get current user's best scores by game type (protected route)
router.get('/my-best', auth, getUserBestScores);

// Get recent scores from all users (public route)
router.get('/recent', getRecentScores);

export default router;
