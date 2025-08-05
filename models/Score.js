import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameType: {
    type: String,
    required: true,
    trim: true,
    enum: ['puzzle', 'racing', 'quiz', 'arcade', 'strategy']
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  duration: {
    type: Number, // in seconds
    required: true,
    min: 0
  },
  isValid: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
scoreSchema.index({ userId: 1, gameType: 1 });
scoreSchema.index({ gameType: 1, score: -1 });
scoreSchema.index({ createdAt: -1 });

export default mongoose.model('Score', scoreSchema);
