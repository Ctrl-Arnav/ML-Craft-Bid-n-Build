const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  enrollmentId: { type: String, required: true }, // 10-digit enrollment number
  playerId: { type: String, required: true, unique: true },
  group: { type: String, enum: ['A', 'B', 'C'], required: true },
  emeraldBalance: { type: Number, default: 1000 },
  ownedToolIds: { 
    type: [String], 
    default: [
      'cobblestone_sample',
      'axe_blueprint',
      'pickaxe_blueprint',
      'sword_blueprint',
      'shovel_blueprint',
      'standard_crafting_table',
      'wooden_chest'
    ] 
  },
  gridState: { type: [String], default: Array(81).fill(null) },
  currentScore: { type: Number, default: 0 },
  totalTimeSpent: { type: Number, default: 0 }, // Accumulated seconds spent in builder phase
  isRoundSubmitted: { type: Boolean, default: false }, // Immediate lockout indicator
  verificationHash: { type: String, default: null, index: true }, // 8-digit FNV-1a verification hash
  hashGeneratedAt: { type: Date, default: null },
  isDisconnected: { type: Boolean, default: false },
  lastActiveAt: { type: Date, default: Date.now }
});

// Enforce unique display name per room
PlayerSchema.index({ roomCode: 1, displayName: 1 }, { unique: true });

// Enforce unique enrollment ID per room
PlayerSchema.index({ roomCode: 1, enrollmentId: 1 }, { unique: true });

module.exports = mongoose.model('Player', PlayerSchema);
