const mongoose = require('mongoose');

const BidSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, index: true },
  group: { type: String, enum: ['A', 'B', 'C'], required: true },
  toolId: { type: String, required: true },
  playerName: { type: String, required: true },
  playerId: { type: String, required: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bid', BidSchema);
