import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import scoreRoutes from './routes/scoreRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import redisService from './services/redisService.js';
import { handleValidationErrors } from './middleware/validation.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Connect to MongoDB first, then try Redis
mongoose.connect(process.env.MONGO_URI)
       .then(() => {
        console.log("✅ Database Connected Successfully");
        
        // Try to connect to Redis (non-blocking)
        return redisService.connect();
       })
       .then(() => {
        // Start server regardless of Redis connection status
        app.listen(process.env.PORT || 4000, () => {
            console.log(`🚀 Server running on PORT ${process.env.PORT || 4000}`);
            console.log(`📊 MongoDB: Connected`);
            console.log(`⚡ Redis: ${redisService.isReady() ? 'Connected' : 'Disconnected (using MongoDB fallback)'}`);
        });
       })
       .catch((err) => {
        console.log('❌ MongoDB connection error:', err);
        process.exit(1);
       });