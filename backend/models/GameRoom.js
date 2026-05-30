const mongoose = require('mongoose');

const GameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  status: { 
    type: String, 
    enum: ['lobby', 'round1_auction', 'round1_builder', 'round2_auction', 'round2_builder', 'round3_auction', 'round3_builder', 'finished'], 
    default: 'lobby' 
  },
  activeRound: { type: Number, default: 1 },
  toolQueue: { type: [String], default: [] }, // Queued tools to auction
  currentToolIndex: { type: Number, default: -1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameRoom', GameRoomSchema);
