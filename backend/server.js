const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const Player = require('./models/Player');
const GameRoom = require('./models/GameRoom');
const Bid = require('./models/Bid');

const app = express();

// Explicit CORS config — required for Railway + Vercel cross-origin POST requests
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Explicitly handle ALL preflight OPTIONS requests
app.use(express.json());

// Health check — confirms backend is live
app.get('/', (req, res) => {
  res.json({ status: '🟢 ML Craft Bid-n-Build backend is live!', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for deployment security
    methods: ["GET", "POST"]
  }
});

// MongoDB Atlas Connection Setup
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pipeline-arena";
mongoose.connect(MONGO_URI)
  .then(() => console.log("🌱 Connected successfully to MongoDB Atlas!"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ==========================================
// STATE & MEMORY DICTIONARIES (Per Room & Group)
// ==========================================
const roomsState = {}; 
/*
Structure:
roomsState[roomCode] = {
  activeRound: 1,
  status: 'lobby', // 'lobby' | 'auction' | 'builder' | 'cooldown'
  groups: {
    'A': {
      players: [], // PlayerIds
      currentAuction: {
        toolId: null,
        basePrice: 0,
        currentBid: 0,
        leadingPlayer: null,
        endsAt: null,
        timerActive: false,
        unsold: false,
        closed: false,
        bids: [] // List of bid snapshots
      },
      builderEndsAt: null,
      builderActive: false,
      cooldownEndsAt: null,
      cooldownActive: false
    },
    'B': { ... },
    'C': { ... }
  },
  gracePeriodEndsAt: null,
  gracePeriodActive: false,
  queue: [] // preloaded tool IDs
}
*/

// Fetch tool base price catalog matching data list
const TOOL_CATALOG = {
  'cobblestone_sample': { name: 'Cobblestone', basePrice: 0, tier: 'Basic' },
  'raw_iron_ore': { name: 'Raw Iron Ore', basePrice: 200, tier: 'C' },
  'raw_gold_ore': { name: 'Raw Gold Ore', basePrice: 350, tier: 'B' },
  'diamond_matrix_ore': { name: 'Diamond Ore', basePrice: 700, tier: 'A' },
  'standard_furnace': { name: 'Furnace', basePrice: 100, tier: 'C' },
  'high_speed_blast_furnace': { name: 'Fast Blast Furnace', basePrice: 300, tier: 'B' },
  'axe_blueprint': { name: 'Axe Blueprint', basePrice: 150, tier: 'Basic' },
  'pickaxe_blueprint': { name: 'Pickaxe Blueprint', basePrice: 150, tier: 'Basic' },
  'sword_blueprint': { name: 'Sword Blueprint', basePrice: 150, tier: 'Basic' },
  'shovel_blueprint': { name: 'Shovel Blueprint', basePrice: 150, tier: 'Basic' },
  'standard_crafting_table': { name: 'Crafting Table', basePrice: 200, tier: 'Basic' },
  'auto_crafter_block': { name: 'Auto-Crafter', basePrice: 450, tier: 'B' },
  'redstone_compute_block': { name: 'Redstone Block', basePrice: 500, tier: 'A' },
  'anvil_restructurer': { name: 'Anvil', basePrice: 120, tier: 'C' },
  'enchanting_bench': { name: 'Enchanting Bench', basePrice: 250, tier: 'B' },
  'wooden_chest': { name: 'Wooden Chest', basePrice: 50, tier: 'Basic' },
  'ender_chest': { name: 'Ender Chest', basePrice: 400, tier: 'A' }
};

// ==========================================
// 🧬 DETERMINISTIC HASHING & VERIFICATION UTILITIES
// ==========================================
// Pure JavaScript implementation of 32-bit FNV-1a algorithm
function calculateFNV1a8Digit(str) {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // 32-bit integer multiplication
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0');
}

async function generateRoomVerificationHashes(roomCode) {
  try {
    const players = await Player.find({ roomCode });
    for (const player of players) {
      if (!player.verificationHash) {
        const finalScore = player.currentScore / 1000;
        const hashInput = `${player.displayName}_${player.enrollmentId}_${finalScore}_${player.totalTimeSpent}`;
        const hash = calculateFNV1a8Digit(hashInput);
        player.verificationHash = hash;
        player.hashGeneratedAt = new Date();
        await player.save();
        console.log(`🔑 Generated verification hash for player ${player.displayName}: ${hash}`);
      }
    }
  } catch (err) {
    console.error("❌ Error generating verification hashes:", err);
  }
}

// ==========================================
// CORE ADMIN SYNCHRONIZATION HELPERS
// ==========================================
function broadcastAdminSync(roomCode) {
  const room = roomsState[roomCode];
  if (!room) return;
  io.to(`${roomCode}-admins`).emit('admin:sync', {
    roomStatus: room.status,
    activeRound: room.activeRound,
    admins: room.admins || [],
    groups: room.groups,
    queue: room.queue
  });
}

// ==========================================
// SOCKET.IO CONTROLLERS
// ==========================================
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // 0. Admin Login & Room Connection (Validates "aloharean" Passcode)
  socket.on('admin:join', async ({ roomCode, displayName, passcode, action }) => {
    try {
      const cleanRoomCode = roomCode.toUpperCase().trim();
      const cleanName = displayName.trim();

      if (passcode !== "aloharean") {
        socket.emit('error:adminJoin', 'Incorrect admin access passcode!');
        return;
      }

      // If joining, verify that the room exists in memory or DB
      if (action === 'join' && !roomsState[cleanRoomCode]) {
        const dbRoom = await GameRoom.findOne({ roomCode: cleanRoomCode });
        if (!dbRoom) {
          socket.emit('error:adminJoin', 'Room does not exist! Please create the room first.');
          return;
        }
      }

      // Initialize room state memory if new
      if (!roomsState[cleanRoomCode]) {
        roomsState[cleanRoomCode] = {
          activeRound: 0,
          status: 'lobby',
          groups: {
            'A': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false },
            'B': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false },
            'C': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false }
          },
          gracePeriodEndsAt: null,
          gracePeriodActive: false,
          queue: [],
          admins: []
        };
      }

      const room = roomsState[cleanRoomCode];
      if (!room.admins) room.admins = [];

      // Add admin to in-memory list
      if (!room.admins.includes(cleanName)) {
        room.admins.push(cleanName);
      }

      // Save admin indicators to socket metadata
      socket.isAdmin = true;
      socket.roomCode = cleanRoomCode;
      socket.displayName = cleanName;

      socket.join(cleanRoomCode);
      socket.join(`${cleanRoomCode}-admins`);

      console.log(`👑 Admin ${cleanName} joined room ${cleanRoomCode}`);

      // Instantly sync room settings to joining admin
      socket.emit('admin:sync', {
        roomStatus: room.status,
        activeRound: room.activeRound,
        admins: room.admins,
        groups: room.groups,
        queue: room.queue
      });

      // Broadcast list updates to admin room channel
      io.to(`${cleanRoomCode}-admins`).emit('admin:list', { admins: room.admins });

    } catch (err) {
      console.error("Admin join error:", err);
      socket.emit('error:adminJoin', 'Could not connect admin. Server database error.');
    }
  });

  // 1. Join Room & Assign Group Lobby
  socket.on('room:join', async ({ roomCode, displayName, enrollmentId }) => {
    try {
      const cleanRoomCode = roomCode.toUpperCase().trim();
      const cleanName = displayName.trim();
      const cleanEnrollmentId = enrollmentId ? enrollmentId.trim() : '';

      // Enrollment ID 10-digit validation
      if (!/^\d{10}$/.test(cleanEnrollmentId)) {
        socket.emit('error:join', 'Enrollment ID must be exactly 10 numeric digits.');
        return;
      }

      // Initialize room state memory if new
      if (!roomsState[cleanRoomCode]) {
        roomsState[cleanRoomCode] = {
          activeRound: 0,
          status: 'lobby',
          groups: {
            'A': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false },
            'B': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false },
            'C': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false }
          },
          gracePeriodEndsAt: null,
          gracePeriodActive: false,
          queue: [],
          admins: []
        };
      }

      const room = roomsState[cleanRoomCode];

      // Reconnection check by enrollment ID
      let playerDoc = await Player.findOne({ roomCode: cleanRoomCode, enrollmentId: cleanEnrollmentId });
      let groupName = 'A';

      if (playerDoc) {
        // Verify same nickname
        if (playerDoc.displayName !== cleanName) {
          socket.emit('error:join', 'Enrollment ID already registered under a different display name.');
          return;
        }
        playerDoc.isDisconnected = false;
        playerDoc.lastActiveAt = Date.now();
        await playerDoc.save();
        groupName = playerDoc.group;
      } else {
        // If enrollment is new, make sure displayName is not already taken by someone else
        const nameTaken = await Player.findOne({ roomCode: cleanRoomCode, displayName: cleanName });
        if (nameTaken) {
          socket.emit('error:join', 'Display name already taken in this room.');
          return;
        }

        // Default to group A, we will rebalance at the end of the join process
        groupName = 'A';

        // Generate custom player ID
        const randomId = Math.floor(1000 + Math.random() * 9000);
        const playerId = `PLAYER-${randomId}-${groupName}`;

        playerDoc = new Player({
          roomCode: cleanRoomCode,
          displayName: cleanName,
          enrollmentId: cleanEnrollmentId,
          playerId,
          group: groupName
        });
        await playerDoc.save();
      }

      // Link socket to channels
      socket.join(cleanRoomCode); // Global channel
      socket.join(`${cleanRoomCode}-${groupName}`); // Group channel

      // Save player information to socket metadata
      socket.playerId = playerDoc.playerId;
      socket.displayName = playerDoc.displayName;
      socket.roomCode = cleanRoomCode;
      socket.group = groupName;

      // Add to memory list
      if (!room.groups[groupName].players.includes(playerDoc.playerId)) {
        room.groups[groupName].players.push(playerDoc.playerId);
      }

      console.log(`👤 Player ${cleanName} joined room ${cleanRoomCode} in Group ${groupName}`);

      // Rebalance all players across groups dynamically and sync their clients
      await rebalanceGroups(cleanRoomCode, io);

      // Update global leaderboard broadcast
      await broadcastLeaderboard(cleanRoomCode);
      broadcastAdminSync(cleanRoomCode);

    } catch (err) {
      console.error("Join error:", err);
      socket.emit('error:join', 'Could not join room. Server database error.');
    }
  });

  // 2. Real-Time Bidding Controller
  socket.on('auction:bid', async ({ amount }) => {
    const { roomCode, group, displayName, playerId } = socket;
    if (!roomCode || !group) return;

    const room = roomsState[roomCode];
    const auction = room.groups[group].currentAuction;

    if (room.status !== 'auction' || auction.closed) {
      socket.emit('error:bid', 'Bidding is currently closed or in builder phase.');
      return;
    }

    try {
      // Validate budget
      const playerDoc = await Player.findOne({ playerId });
      if (!playerDoc) return;

      const bidAmount = parseInt(amount, 10);

      // Floor check (Base Price)
      if (bidAmount < auction.basePrice) {
        socket.emit('error:bid', `First bid must be at least the base price of 💎${auction.basePrice}!`);
        return;
      }

      // Increment raise check (Min 100 raise)
      if (auction.leadingPlayer && bidAmount < (auction.currentBid + 100)) {
        socket.emit('error:bid', `Raise must be at least 100 Emeralds above current leading bid!`);
        return;
      }

      // Budget check
      if (bidAmount > playerDoc.emeraldBalance) {
        socket.emit('error:bid', `Insufficient Emerald Balance! Maximum bid allowed: 💎${playerDoc.emeraldBalance}`);
        return;
      }

      // Accept Bid (Authors leading)
      auction.currentBid = bidAmount;
      auction.leadingPlayer = { playerId, displayName };
      
      // Start timer on FIRST bid placed
      if (!auction.timerActive) {
        auction.timerActive = true;
      }
      // Reset timer to 25 seconds
      auction.endsAt = Date.now() + 25000;

      // Add to local history
      const bidRecord = {
        displayName,
        amount: bidAmount,
        timeAgo: 'just now',
        timestamp: Date.now()
      };
      auction.bids.unshift(bidRecord);

      // Broadcast bid update to group only
      io.to(`${roomCode}-${group}`).emit('auction:bidUpdate', {
        currentBid: bidAmount,
        leadingPlayer: auction.leadingPlayer,
        endsAt: auction.endsAt,
        bids: auction.bids
      });

      // Outbid warning notifications to all others in the group
      socket.to(`${roomCode}-${group}`).emit('auction:outbid', {
        message: `⚠ Outbid! ${displayName} bid 💎${bidAmount}`,
        currentBid: bidAmount
      });

      broadcastAdminSync(roomCode);

    } catch (err) {
      console.error("Bid placement error:", err);
    }
  });

  // 2.5 Request Auction Sync (On Mount)
  socket.on('auction:requestSync', () => {
    const { roomCode, group } = socket;
    if (!roomCode || !group) return;

    const room = roomsState[roomCode];
    if (room && room.status === 'auction') {
      const auction = room.groups[group].currentAuction;
      socket.emit('auction:sync', {
        toolId: auction.toolId,
        basePrice: auction.basePrice,
        currentBid: auction.currentBid,
        leadingPlayer: auction.leadingPlayer,
        endsAt: auction.endsAt,
        bids: auction.bids || [],
        queue: room.groups[group].queue || []
      });
    } else if (room && room.status === 'bidding_grace') {
      socket.emit('transition:biddingGraceStarted', {
        activeRound: room.activeRound,
        queue: room.groups[group].queue || [],
        endsAt: room.biddingGraceEndsAt,
        firstToolId: room.groups[group].currentAuction?.toolId,
        firstToolBasePrice: room.groups[group].currentAuction?.basePrice
      });
    }
  });

  // 3. Grid Pipeline Submission
  socket.on('pipeline:submit', async ({ gridState, score, roundTimeSpent, isFinal }) => {
    const { roomCode, group, playerId, displayName } = socket;
    if (!roomCode || !playerId) return;

    try {
      const playerDoc = await Player.findOne({ playerId });
      if (!playerDoc) return;

      // Backend lockout enforcement
      if (playerDoc.isRoundSubmitted) {
        socket.emit('error:bid', 'Pipeline is locked! You cannot edit after submitting.');
        return;
      }

      // Save state to MongoDB Atlas
      playerDoc.gridState = gridState;
      playerDoc.currentScore = score;

      if (isFinal) {
        playerDoc.isRoundSubmitted = true;
        const timeSpent = Math.max(0, Math.min(360, parseInt(roundTimeSpent, 10) || 360));
        playerDoc.totalTimeSpent += timeSpent;
        console.log(`🔒 Final pipeline lockout for ${displayName}: round time spent = ${timeSpent}s. Total time = ${playerDoc.totalTimeSpent}s.`);
      }

      await playerDoc.save();

      console.log(`💾 Pipeline submitted by ${displayName} (Score: ${score}, isFinal: ${!!isFinal})`);

      // Sync global leaderboard
      await broadcastLeaderboard(roomCode);
      socket.emit('pipeline:submitted', { 
        score, 
        isRoundSubmitted: playerDoc.isRoundSubmitted,
        totalTimeSpent: playerDoc.totalTimeSpent
      });
      broadcastAdminSync(roomCode);

    } catch (err) {
      console.error("Pipeline submission error:", err);
    }
  });

  // 4. Disconnect Handling (Graceful reconnection logs)
  socket.on('disconnect', async () => {
    const { roomCode, displayName, isAdmin, playerId } = socket;
    if (!roomCode) return;

    try {
      if (isAdmin) {
        const room = roomsState[roomCode];
        if (room && room.admins) {
          room.admins = room.admins.filter(a => a !== displayName);
          io.to(`${roomCode}-admins`).emit('admin:list', { admins: room.admins });
          broadcastAdminSync(roomCode);
        }
        console.log(`🔌 Admin disconnected: ${displayName} from room ${roomCode}`);
        return;
      }

      if (playerId) {
        const playerDoc = await Player.findOne({ playerId });
        if (playerDoc) {
          playerDoc.isDisconnected = true;
          await playerDoc.save();
        }
        console.log(`🔌 Client disconnected: ${displayName} from room ${roomCode}`);
      }

    } catch (err) {
      console.error("Disconnect log error:", err);
    }
  });
});

// ==========================================
// TIMER SYSTEM TICK LOOPS (500ms precision)
// ==========================================
setInterval(async () => {
  for (const roomCode of Object.keys(roomsState)) {
    const room = roomsState[roomCode];

    // Tick 0: Bidding Grace Phase Timer
    if (room.status === 'bidding_grace') {
      if (Date.now() >= room.biddingGraceEndsAt) {
        room.status = 'auction';

        for (const groupName of Object.keys(room.groups)) {
          const group = room.groups[groupName];
          
          if (group.queue.length > 0) {
            const firstToolId = group.queue[0];
            const toolDetails = TOOL_CATALOG[firstToolId];
            
            // Emit transition to active bidding!
            io.to(`${roomCode}-${groupName}`).emit('transition:auctionStarted', {
              activeRound: room.activeRound,
              queue: group.queue
            });

            // Sync first tool details
            io.to(`${roomCode}-${groupName}`).emit('auction:sync', {
              toolId: firstToolId,
              basePrice: toolDetails.basePrice,
              currentBid: toolDetails.basePrice,
              leadingPlayer: null,
              endsAt: null,
              bids: [],
              queue: group.queue
            });
          } else {
            // Empty queue transition
            io.to(`${roomCode}-${groupName}`).emit('transition:auctionStarted', {
              activeRound: room.activeRound,
              queue: []
            });
          }
        }

        // Update GameRoom status in DB
        await GameRoom.findOneAndUpdate(
          { roomCode },
          { status: `round${room.activeRound}_auction` },
          { upsert: true, new: true }
        );

        broadcastAdminSync(roomCode);
      }
    }

    // Tick 1: Auction Phase Timers
    if (room.status === 'auction') {
      let allClosed = true;

      for (const groupName of Object.keys(room.groups)) {
        const group = room.groups[groupName];
        const auction = group.currentAuction;

        // Load next item if closed and queue has remaining tools
        if (auction.closed && !group.nextItemLoading && group.currentAuctionIdx + 1 < (group.queue || []).length) {
          group.nextItemLoading = true;
          setTimeout(async () => {
            try {
              group.currentAuctionIdx += 1;
              const nextToolId = group.queue[group.currentAuctionIdx];
              const toolDetails = TOOL_CATALOG[nextToolId];

              group.currentAuction = {
                toolId: nextToolId,
                basePrice: toolDetails.basePrice,
                currentBid: toolDetails.basePrice,
                leadingPlayer: null,
                endsAt: null,
                timerActive: false,
                unsold: false,
                closed: false,
                bids: []
              };
              group.nextItemLoading = false;

              // Emit group-specific sync update for the next item
              io.to(`${roomCode}-${groupName}`).emit('auction:sync', {
                toolId: nextToolId,
                basePrice: toolDetails.basePrice,
                currentBid: toolDetails.basePrice,
                leadingPlayer: null,
                endsAt: null,
                bids: [],
                queue: group.queue
              });
              broadcastAdminSync(roomCode);
            } catch (err) {
              console.error("❌ Error loading next auction item:", err);
              group.nextItemLoading = false;
            }
          }, 3500);
        }

        const isFullyClosed = auction.closed && (group.currentAuctionIdx + 1 >= (group.queue || []).length);
        if (isFullyClosed) continue;
        allClosed = false;

        // Verify timer expiration
        if (auction.timerActive && Date.now() >= auction.endsAt) {
          auction.closed = true;
          auction.timerActive = false;

          await handleAuctionClose(roomCode, groupName);
        }
      }

      // A group is fully closed if its current item is closed AND it has no more items in queue
      const isGroupFullyClosed = (gn) => {
        const g = room.groups[gn];
        return g.currentAuction.closed && (g.currentAuctionIdx + 1 >= (g.queue || []).length);
      };

      // Find all groups that actually have active players connected or registered
      const activeGroups = Object.keys(room.groups).filter(gn => room.groups[gn].players.length > 0);
      const closedActiveCount = activeGroups.filter(gn => isGroupFullyClosed(gn)).length;

      // Grace Period Trigger (When first active group closes its auction, only if multiple active groups exist)
      if (activeGroups.length > 1 && closedActiveCount > 0 && closedActiveCount < activeGroups.length && !room.gracePeriodActive) {
        // Start 60s Grace Period
        room.gracePeriodActive = true;
        room.gracePeriodEndsAt = Date.now() + 60000;
        
        // Notify global channels
        io.to(roomCode).emit('transition:graceStarted', { endsAt: room.gracePeriodEndsAt });
      }

      // Check Grace Period Expiry or All Active Groups Finished
      const shouldTransitionToBuilder = 
        (room.gracePeriodActive && Date.now() >= room.gracePeriodEndsAt) || 
        (closedActiveCount === activeGroups.length && activeGroups.length > 0);

      if (shouldTransitionToBuilder) {
        // Grace period expired ➔ Transition all groups to Builder Phase together!
        room.gracePeriodActive = false;
        room.status = 'builder';

        for (const groupName of Object.keys(room.groups)) {
          const group = room.groups[groupName];
          
          // Force close any remaining open groups
          if (!group.currentAuction.closed) {
            group.currentAuction.closed = true;
            group.currentAuction.timerActive = false;
            await handleAuctionClose(roomCode, groupName);
          }

          // Start 6-minute Builder timer
          group.builderEndsAt = Date.now() + 360000; // 360s
          group.builderActive = true;

          io.to(`${roomCode}-${groupName}`).emit('transition:builderStarted', { endsAt: group.builderEndsAt });
        }
        
        // Sync Global State Room
        io.to(roomCode).emit('room:phaseUpdate', { status: 'builder' });
        await GameRoom.findOneAndUpdate(
          { roomCode },
          { status: `round${room.activeRound}_builder` },
          { upsert: true, new: true }
        );
      }
    }

    // Tick 2: Builder Phase Timers
    if (room.status === 'builder') {
      let allBuilderDone = true;

      for (const groupName of Object.keys(room.groups)) {
        const group = room.groups[groupName];

        if (!group.builderActive) continue;
        allBuilderDone = false;

        if (Date.now() >= group.builderEndsAt) {
          group.builderActive = false;
          
          // Start 30s planning Cooldown
          group.cooldownEndsAt = Date.now() + 30000;
          group.cooldownActive = true;
 
          // Award emeralds to all players in this group for their Elder Flow Score!
          awardEndRoundEmeraldsForGroup(roomCode, groupName);

          // Backend auto-lock for players who did not submit manually
          const autoLockRoomAndGroup = async (rc, gn) => {
            try {
              const players = await Player.find({ roomCode: rc, group: gn });
              for (const p of players) {
                if (!p.isRoundSubmitted) {
                  p.isRoundSubmitted = true;
                  p.totalTimeSpent += 360; // Max round duration
                  await p.save();
                  console.log(`⏱️ Auto-locked player ${p.displayName} (+360s) due to round builder expiration.`);
                }
              }
              await broadcastLeaderboard(rc);
            } catch (err) {
              console.error("❌ Error during builder expiration auto-lock:", err);
            }
          };
          autoLockRoomAndGroup(roomCode, groupName);

          // Force auto-submit grids client-side trigger
          io.to(`${roomCode}-${groupName}`).emit('transition:builderEnded');
        }
      }

      // Verify cooldown completions
      let allCooldownDone = true;
      let hasActiveCooldowns = false;

      for (const groupName of Object.keys(room.groups)) {
        const group = room.groups[groupName];
        if (group.cooldownActive) {
          hasActiveCooldowns = true;
          if (Date.now() >= group.cooldownEndsAt) {
            group.cooldownActive = false;
          } else {
            allCooldownDone = false;
          }
        }
      }

      // Next Auction starts only after ALL groups have completed their cooldown
      if (hasActiveCooldowns && allCooldownDone) {
        // Increment round
        if (room.activeRound < 3) {
          room.activeRound += 1;
          
          // Trigger the 10-second grace and tool line-up phase
          await triggerBiddingGracePeriod(roomCode);
        } else {
          // End match
          room.status = 'finished';
          await generateRoomVerificationHashes(roomCode);
          io.to(roomCode).emit('match:finished');
          await GameRoom.findOneAndUpdate(
            { roomCode },
            { status: 'finished' },
            { upsert: true, new: true }
          );
        }
      }
    }
  }
}, 500);

// ==========================================
// CORE SYSTEM HELPER METHODS
// ==========================================

function resetGroupAuction() {
  return {
    toolId: null,
    basePrice: 0,
    currentBid: 0,
    leadingPlayer: null,
    endsAt: null,
    timerActive: false,
    unsold: false,
    closed: false,
    bids: []
  };
}

async function handleAuctionClose(roomCode, groupName) {
  const room = roomsState[roomCode];
  const group = room.groups[groupName];
  const auction = group.currentAuction;

  if (auction.leadingPlayer) {
    const { playerId, displayName } = auction.leadingPlayer;
    const price = auction.currentBid;

    try {
      const playerDoc = await Player.findOne({ playerId });
      if (playerDoc) {
        // Deduct budget
        playerDoc.emeraldBalance -= price;
        // Unlock tool
        playerDoc.ownedToolIds.push(auction.toolId);
        await playerDoc.save();

        // Archive Bid details to MongoDB Atlas
        const bidLog = new Bid({
          roomCode,
          group: groupName,
          toolId: auction.toolId,
          playerName: displayName,
          playerId,
          amount: price
        });
        await bidLog.save();

        console.log(`🏆 Auction won by ${displayName}: '${auction.toolId}' for 💎${price}`);

        // Notify group channel
        io.to(`${roomCode}-${groupName}`).emit('auction:sold', {
          toolId: auction.toolId,
          winner: displayName,
          winnerId: playerId,
          price,
          emeraldBalance: playerDoc.emeraldBalance
        });
      }
    } catch (err) {
      console.error("Auction close transaction error:", err);
    }
  } else {
    // Unsold item logic
    auction.unsold = true;
    io.to(`${roomCode}-${groupName}`).emit('auction:unsold', { toolId: auction.toolId });
  }

  // Sync grid items
  await broadcastLeaderboard(roomCode);
}

async function triggerBiddingGracePeriod(roomCode) {
  const room = roomsState[roomCode];
  room.status = 'bidding_grace';
  room.biddingGraceEndsAt = Date.now() + 10000; // 10 seconds

  // Reset round submitted state for all players in room
  try {
    await Player.updateMany({ roomCode }, { isRoundSubmitted: false });
    console.log(`🔄 Reset submission lockout state for all players in room ${roomCode}`);
  } catch (err) {
    console.error("❌ Error resetting player submission states:", err);
  }

  let roundTier = room.activeRound === 1 ? 'C' : (room.activeRound === 2 ? 'B' : 'A');
  const roundTools = Object.keys(TOOL_CATALOG).filter(id => TOOL_CATALOG[id].tier === roundTier);

  for (const groupName of Object.keys(room.groups)) {
    const group = room.groups[groupName];
    
    // Count active players in this group in MongoDB
    const groupPlayers = await Player.find({ roomCode, group: groupName });
    const n = groupPlayers.length;
    const numTools = Math.max(0, n - 1); // Exactly n - 1 tools

    // Build group-specific queue cycling roundTools
    group.queue = [];
    for (let i = 0; i < numTools; i++) {
      group.queue.push(roundTools[i % roundTools.length]);
    }
    
    group.currentAuctionIdx = 0;
    group.nextItemLoading = false;
    group.currentAuction = resetGroupAuction();
    
    if (group.queue.length > 0) {
      // Pre-load first item details
      const firstToolId = group.queue[0];
      const toolDetails = TOOL_CATALOG[firstToolId];

      group.currentAuction.toolId = firstToolId;
      group.currentAuction.basePrice = toolDetails.basePrice;
      group.currentAuction.currentBid = toolDetails.basePrice;
      
      // Emit transition grace start to the group
      io.to(`${roomCode}-${groupName}`).emit('transition:biddingGraceStarted', {
        activeRound: room.activeRound,
        queue: group.queue,
        endsAt: room.biddingGraceEndsAt,
        firstToolId: firstToolId,
        firstToolBasePrice: toolDetails.basePrice
      });
    } else {
      group.currentAuction.closed = true;
      
      // Emit transition grace start for empty queue
      io.to(`${roomCode}-${groupName}`).emit('transition:biddingGraceStarted', {
        activeRound: room.activeRound,
        queue: [],
        endsAt: room.biddingGraceEndsAt
      });
    }
  }

  // Update GameRoom status in DB
  await GameRoom.findOneAndUpdate(
    { roomCode },
    { status: `round${room.activeRound}_bidding_grace`, activeRound: room.activeRound },
    { upsert: true, new: true }
  );

  broadcastAdminSync(roomCode);
}

async function awardEndRoundEmeraldsForGroup(roomCode, groupName) {
  try {
    const players = await Player.find({ roomCode, group: groupName });
    for (const player of players) {
      const scoreAwarded = player.currentScore || 0;
      player.emeraldBalance += scoreAwarded;
      
      // Save changes to DB
      await player.save();
      console.log(`💎 Awarded 💎${scoreAwarded} Emeralds to player ${player.displayName} in Group ${groupName}!`);

      // Emit notification to player socket so they get the alert/toast instantly
      const sockets = await io.in(roomCode).fetchSockets();
      const playerSocket = sockets.find(s => s.playerId === player.playerId);
      if (playerSocket) {
        playerSocket.emit('emerald:awarded', {
          score: scoreAwarded,
          newBalance: player.emeraldBalance
        });
        
        // Broadcast profile sync
        playerSocket.emit('room:sync', {
          playerId: player.playerId,
          displayName: player.displayName,
          enrollmentId: player.enrollmentId,
          group: player.group,
          emeraldBalance: player.emeraldBalance,
          ownedToolIds: player.ownedToolIds,
          gridState: player.gridState,
          roomStatus: roomsState[roomCode]?.status || 'builder',
          activeRound: roomsState[roomCode]?.activeRound || 1,
          isRoundSubmitted: player.isRoundSubmitted
        });
      }
    }
    await broadcastLeaderboard(roomCode);
  } catch (err) {
    console.error("❌ Error awarding end-of-round emeralds for group:", err);
  }
}

async function awardEndRoundEmeraldsForRoom(roomCode) {
  try {
    const room = roomsState[roomCode];
    if (!room) return;
    for (const groupName of Object.keys(room.groups)) {
      await awardEndRoundEmeraldsForGroup(roomCode, groupName);
    }
  } catch (err) {
    console.error("❌ Error awarding end-of-round emeralds for room:", err);
  }
}

async function startNewAuctionRound(roomCode) {
  const room = roomsState[roomCode];
  room.status = 'auction';

  // Reset round submitted state for all players in room
  try {
    await Player.updateMany({ roomCode }, { isRoundSubmitted: false });
    console.log(`🔄 Reset submission lockout state for all players in room ${roomCode}`);
  } catch (err) {
    console.error("❌ Error resetting player submission states:", err);
  }

  // Fetch next tools matching round tier catalog
  let roundTier = room.activeRound === 1 ? 'C' : (room.activeRound === 2 ? 'B' : 'A');
  const roundTools = Object.keys(TOOL_CATALOG).filter(id => TOOL_CATALOG[id].tier === roundTier);

  // Group-specific queues of size exactly n - 1
  for (const groupName of Object.keys(room.groups)) {
    const group = room.groups[groupName];
    
    // Count active players in this group in MongoDB
    const groupPlayers = await Player.find({ roomCode, group: groupName });
    const n = groupPlayers.length;
    const numTools = Math.max(0, n - 1); // Exactly n - 1 tools, minimum of 0

    // Build group specific queue cycling roundTools
    group.queue = [];
    for (let i = 0; i < numTools; i++) {
      group.queue.push(roundTools[i % roundTools.length]);
    }
    
    group.currentAuctionIdx = 0;
    group.nextItemLoading = false;
    group.currentAuction = resetGroupAuction();
    
    if (group.queue.length > 0) {
      // Load first item for this group
      const firstToolId = group.queue[0];
      const toolDetails = TOOL_CATALOG[firstToolId];

      group.currentAuction.toolId = firstToolId;
      group.currentAuction.basePrice = toolDetails.basePrice;
      group.currentAuction.currentBid = toolDetails.basePrice;

      // Emit group-specific sync start
      io.to(`${roomCode}-${groupName}`).emit('transition:auctionStarted', {
        activeRound: room.activeRound,
        queue: group.queue
      });
    } else {
      // Empty queue for groups with 0 or 1 player: mark auction closed cleanly
      group.currentAuction.closed = true;
      
      // Emit group-specific sync start with empty queue
      io.to(`${roomCode}-${groupName}`).emit('transition:auctionStarted', {
        activeRound: room.activeRound,
        queue: []
      });
    }
  }

  // Upsert GameRoom status in DB (safe whether room doc exists or not)
  await GameRoom.findOneAndUpdate(
    { roomCode },
    { status: `round${room.activeRound}_auction`, activeRound: room.activeRound },
    { upsert: true, new: true }
  );
}

async function broadcastLeaderboard(roomCode) {
  try {
    const players = await Player.find({ roomCode }).sort({ currentScore: -1 });
    
    const globalLeaderboard = players.map((p, idx) => ({
      rank: idx + 1,
      name: p.displayName,
      playerId: p.playerId,
      group: p.group,
      score: p.currentScore,
      budget: p.emeraldBalance,
      totalTimeSpent: p.totalTimeSpent
    }));

    io.to(roomCode).emit('leaderboard:update', { globalLeaderboard });
  } catch (err) {
    console.error("Leaderboard build error:", err);
  }
}

// ==========================================
// ADMIN CONTROL COMMAND HOOKS
// ==========================================
app.post('/api/admin/match/start', async (req, res) => {
  const { roomCode, toolsQueue } = req.body;
  if (!roomCode) return res.status(400).json({ error: 'Room code is required.' });
  const cleanRoomCode = roomCode.toUpperCase().trim();

  // Initialize room in memory if admin hasn't connected via socket yet
  if (!roomsState[cleanRoomCode]) {
    roomsState[cleanRoomCode] = {
      activeRound: 0,
      status: 'lobby',
      groups: {
        'A': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false },
        'B': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false },
        'C': { players: [], currentAuction: resetGroupAuction(), builderEndsAt: null, builderActive: false, cooldownEndsAt: null, cooldownActive: false }
      },
      gracePeriodEndsAt: null,
      gracePeriodActive: false,
      queue: [],
      admins: []
    };
  }

  const room = roomsState[cleanRoomCode];

  try {
    room.status = 'lobby'; // Keep status as 'lobby' so admin can start it manually!
    room.activeRound = 0;  // Set activeRound to 0 until round 1 starts!
    
    // Preload round 1 tools queue
    const round1Tools = Object.keys(TOOL_CATALOG).filter(id => TOOL_CATALOG[id].tier === 'C');
    room.queue = toolsQueue || round1Tools.slice(0, 3);

    for (const groupName of Object.keys(room.groups)) {
      const group = room.groups[groupName];
      group.currentAuction = resetGroupAuction();
    }

    io.to(cleanRoomCode).emit('transition:lobbyReady'); // Notify players that match is initialized!
    
    // Use upsert to avoid duplicate key errors on re-initialization
    await GameRoom.findOneAndUpdate(
      { roomCode: cleanRoomCode },
      { roomCode: cleanRoomCode, toolQueue: room.queue, status: 'lobby', activeRound: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Reset player profiles for match start
    try {
      await Player.updateMany(
        { roomCode: cleanRoomCode },
        { 
          isRoundSubmitted: false, 
          totalTimeSpent: 0, 
          verificationHash: null, 
          hashGeneratedAt: null,
          currentScore: 0,
          emeraldBalance: 1000,
          gridState: Array(81).fill(null),
          ownedToolIds: [
            'cobblestone_sample',
            'axe_blueprint',
            'pickaxe_blueprint',
            'sword_blueprint',
            'shovel_blueprint',
            'standard_crafting_table',
            'wooden_chest'
          ]
        }
      );
      console.log(`🌱 Reset all player profiles for start of match in room ${cleanRoomCode}`);
    } catch (err) {
      console.error("❌ Error resetting players on match start:", err);
    }

    broadcastAdminSync(cleanRoomCode);
    res.json({ message: 'Match initialized in lobby! Click Start Round 1 Bidding to begin.', queue: room.queue });
  } catch (err) {
    console.error('❌ Match start error:', err);
    res.status(500).json({ error: 'Could not initialize game room.' });
  }
});

// Admin force skip group auction command
app.post('/api/admin/auction/skip', async (req, res) => {
  const { roomCode, group } = req.body;
  const cleanRoomCode = roomCode.toUpperCase().trim();

  const room = roomsState[cleanRoomCode];
  if (!room) return res.status(404).json({ error: 'Room state not found.' });

  const targetGroup = room.groups[group];
  if (!targetGroup) return res.status(404).json({ error: 'Group channel not found.' });

  if (room.status !== 'auction' || targetGroup.currentAuction.closed) {
    return res.status(400).json({ error: 'Auction is not active in this group.' });
  }

  // Force close group auction
  targetGroup.currentAuction.closed = true;
  targetGroup.currentAuction.timerActive = false;
  
  await handleAuctionClose(cleanRoomCode, group);
  broadcastAdminSync(cleanRoomCode);

  res.json({ message: `Group ${group} auction has been forcefully closed (skipped).` });
});

// Admin timer manipulation command
app.post('/api/admin/timer/modify', async (req, res) => {
  const { roomCode, group, action } = req.body;
  const cleanRoomCode = roomCode.toUpperCase().trim();

  const room = roomsState[cleanRoomCode];
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const targetGroup = room.groups[group];
  if (!targetGroup) return res.status(404).json({ error: 'Group channel not found.' });

  const auction = targetGroup.currentAuction;
  if (room.status !== 'auction' || auction.closed) {
    return res.status(400).json({ error: 'Auction is not active in this group.' });
  }

  if (action === 'add30') {
    auction.endsAt = (auction.endsAt || Date.now()) + 30000;
  } else if (action === 'reset25') {
    auction.endsAt = Date.now() + 25000;
  }

  // Broadcast bid update or tick sync to group
  io.to(`${cleanRoomCode}-${group}`).emit('auction:bidUpdate', {
    currentBid: auction.currentBid,
    leadingPlayer: auction.leadingPlayer,
    endsAt: auction.endsAt,
    bids: auction.bids
  });

  broadcastAdminSync(cleanRoomCode);
  res.json({ message: `Timer modified successfully for Group ${group}!` });
});

// Admin tool queue injection command
app.post('/api/admin/auction/inject', async (req, res) => {
  const { roomCode, toolId } = req.body;
  const cleanRoomCode = roomCode.toUpperCase().trim();

  const room = roomsState[cleanRoomCode];
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  if (!TOOL_CATALOG[toolId]) {
    return res.status(400).json({ error: 'Invalid tool ID!' });
  }

  // Inject to queue
  room.queue.push(toolId);

  io.to(cleanRoomCode).emit('transition:auctionStarted', {
    activeRound: room.activeRound,
    queue: room.queue
  });

  broadcastAdminSync(cleanRoomCode);
  res.json({ message: `Tool successfully injected into queue!`, queue: room.queue });
});

// Admin global force start round command
app.post('/api/admin/round/forcestart', async (req, res) => {
  const { roomCode } = req.body;
  const cleanRoomCode = roomCode.toUpperCase().trim();

  const room = roomsState[cleanRoomCode];
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  try {
    if (room.status === 'lobby' || room.activeRound === 0) {
      room.activeRound = 1;
      await triggerBiddingGracePeriod(cleanRoomCode);
    } else {
      if (room.activeRound < 3) {
        // Award emeralds for the completing round first
        await awardEndRoundEmeraldsForRoom(cleanRoomCode);
        room.activeRound += 1;
        await triggerBiddingGracePeriod(cleanRoomCode);
      } else {
        // Award emeralds for the final round 3 first
        await awardEndRoundEmeraldsForRoom(cleanRoomCode);
        room.status = 'finished';
        await generateRoomVerificationHashes(cleanRoomCode);
        io.to(cleanRoomCode).emit('match:finished');
        await GameRoom.findOneAndUpdate(
          { roomCode: cleanRoomCode },
          { status: 'finished' },
          { upsert: true, new: true }
        );
      }
    }

    broadcastAdminSync(cleanRoomCode);
    res.json({ message: `Round forcefully started!`, activeRound: room.activeRound, status: room.status });
  } catch (err) {
    console.error("❌ Force start round error:", err);
    res.status(500).json({ error: "Could not force start round." });
  }
});

// Admin room results extraction endpoint
app.get('/api/admin/room/:roomCode/results', async (req, res) => {
  try {
    const cleanRoomCode = req.params.roomCode.toUpperCase().trim();
    const players = await Player.find({ roomCode: cleanRoomCode }).sort({ currentScore: -1 });
    
    const results = players.map(p => ({
      displayName: p.displayName,
      enrollmentId: p.enrollmentId,
      group: p.group,
      playerId: p.playerId,
      score: p.currentScore,
      finalScoreNormalized: p.currentScore / 1000,
      totalTimeSpent: p.totalTimeSpent,
      verificationHash: p.verificationHash,
      hashGeneratedAt: p.hashGeneratedAt
    }));

    res.json({ roomCode: cleanRoomCode, results });
  } catch (err) {
    console.error("❌ Error fetching room results:", err);
    res.status(500).json({ error: "Could not retrieve room results." });
  }
});

// Verification lookup endpoint by unique hash code
app.get('/api/admin/verify/:hash', async (req, res) => {
  try {
    const hash = req.params.hash.toUpperCase().trim();
    const player = await Player.findOne({ verificationHash: hash });
    if (!player) {
      return res.status(404).json({ error: "Verification hash not found! Invalid credentials." });
    }
    res.json({
      authenticated: true,
      displayName: player.displayName,
      enrollmentId: player.enrollmentId,
      roomCode: player.roomCode,
      group: player.group,
      score: player.currentScore,
      finalScoreNormalized: player.currentScore / 1000,
      totalTimeSpent: player.totalTimeSpent,
      hashGeneratedAt: player.hashGeneratedAt
    });
  } catch (err) {
    console.error("❌ Error verifying hash:", err);
    res.status(500).json({ error: "Could not verify credentials due to database error." });
  }
});

// Admin manual player registration endpoint
app.post('/api/admin/player/create-manual', async (req, res) => {
  const { roomCode, displayName, enrollmentId, score, totalTimeSpent } = req.body;
  
  if (!roomCode || !displayName || !enrollmentId) {
    return res.status(400).json({ error: 'Room code, display name, and enrollment ID are required.' });
  }

  const cleanRoomCode = roomCode.toUpperCase().trim();
  const cleanName = displayName.trim();
  const cleanEnrollment = enrollmentId.trim();

  // 10-digit enrollment check
  if (!/^\d{10}$/.test(cleanEnrollment)) {
    return res.status(400).json({ error: 'Enrollment ID must be exactly 10 digits.' });
  }

  const parsedScore = parseInt(score, 10) || 0;
  const parsedTime = parseInt(totalTimeSpent, 10) || 0;

  if (parsedScore < 0 || parsedScore > 1000) {
    return res.status(400).json({ error: 'Elder Flow Score must be between 0 and 1000.' });
  }
  if (parsedTime < 0) {
    return res.status(400).json({ error: 'Cumulative builder time must be non-negative.' });
  }

  try {
    // Check if player or enrollment already exists in this room
    const existingEnrollment = await Player.findOne({ roomCode: cleanRoomCode, enrollmentId: cleanEnrollment });
    if (existingEnrollment) {
      return res.status(400).json({ error: 'Enrollment ID already registered in this room.' });
    }

    const existingName = await Player.findOne({ roomCode: cleanRoomCode, displayName: cleanName });
    if (existingName) {
      return res.status(400).json({ error: 'Display name already taken in this room.' });
    }

    // Determine group: manual players are placed in Group A by default unless roomState has other setup
    const room = roomsState[cleanRoomCode];
    let groupName = 'A';
    if (room) {
      // Find group with fewest players
      const groupCounts = {};
      for (const g of Object.keys(room.groups)) {
        groupCounts[g] = room.groups[g].players.length;
      }
      // Pick group with minimum player count
      groupName = Object.keys(groupCounts).reduce((a, b) => groupCounts[a] <= groupCounts[b] ? a : b);
    }

    // Generate random player ID
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const playerId = `PLAYER-MANUAL-${randomId}-${groupName}`;

    // Compute unique verification hash
    const finalScoreNormalized = parsedScore / 1000;
    const hashInput = `${cleanName}_${cleanEnrollment}_${finalScoreNormalized}_${parsedTime}`;
    const verificationHash = calculateFNV1a8Digit(hashInput);

    const playerDoc = new Player({
      roomCode: cleanRoomCode,
      displayName: cleanName,
      enrollmentId: cleanEnrollment,
      playerId,
      group: groupName,
      currentScore: parsedScore,
      totalTimeSpent: parsedTime,
      isRoundSubmitted: true,
      verificationHash,
      hashGeneratedAt: new Date()
    });

    await playerDoc.save();

    // Add to in-memory room state list if initialized
    if (room && room.groups[groupName]) {
      if (!room.groups[groupName].players.includes(playerId)) {
        room.groups[groupName].players.push(playerId);
      }
    }

    console.log(`👤 Manually registered player ${cleanName} in Group ${groupName} (Hash: ${verificationHash})`);

    // Broadcast updates
    await broadcastLeaderboard(cleanRoomCode);
    broadcastAdminSync(cleanRoomCode);

    res.json({ 
      message: `Successfully registered ${cleanName} in Group ${groupName}!`, 
      playerId, 
      groupName, 
      verificationHash 
    });

  } catch (err) {
    console.error("❌ Manual player registration error:", err);
    res.status(500).json({ error: 'Server database error while registering player.' });
  }
});

// Admin dynamic group switching endpoint
app.post('/api/admin/player/change-group', async (req, res) => {
  const { roomCode, playerId, newGroup } = req.body;

  if (!roomCode || !playerId || !newGroup) {
    return res.status(400).json({ error: 'Room code, player ID, and target group are required.' });
  }

  const cleanRoomCode = roomCode.toUpperCase().trim();
  const targetPlayerId = playerId.trim();
  const targetGroup = newGroup.toUpperCase().trim();

  if (!['A', 'B', 'C'].includes(targetGroup)) {
    return res.status(400).json({ error: 'Group must be A, B, or C.' });
  }

  try {
    const playerDoc = await Player.findOne({ roomCode: cleanRoomCode, playerId: targetPlayerId });
    if (!playerDoc) {
      return res.status(404).json({ error: 'Player not found in this room.' });
    }

    const oldGroup = playerDoc.group;
    if (oldGroup === targetGroup) {
      return res.json({ message: `Player is already in Group ${targetGroup}.` });
    }

    // Update in Database
    playerDoc.group = targetGroup;
    await playerDoc.save();

    // Update in-memory roomState
    const room = roomsState[cleanRoomCode];
    if (room) {
      // Remove from old group memory list
      if (room.groups[oldGroup]) {
        room.groups[oldGroup].players = room.groups[oldGroup].players.filter(p => p !== targetPlayerId);
      }
      // Add to new group memory list
      if (room.groups[targetGroup]) {
        if (!room.groups[targetGroup].players.includes(targetPlayerId)) {
          room.groups[targetGroup].players.push(targetPlayerId);
        }
      }
    }

    console.log(`🔄 Switched player ${playerDoc.displayName} from Group ${oldGroup} to Group ${targetGroup}`);

    // Dynamic socket channel migration
    const sockets = await io.in(cleanRoomCode).fetchSockets();
    const playerSocket = sockets.find(s => s.playerId === targetPlayerId);

    if (playerSocket) {
      playerSocket.leave(`${cleanRoomCode}-${oldGroup}`);
      playerSocket.join(`${cleanRoomCode}-${targetGroup}`);
      playerSocket.group = targetGroup;

      // Sync player client instantly to refresh group state
      playerSocket.emit('room:sync', {
        playerId: playerDoc.playerId,
        displayName: playerDoc.displayName,
        enrollmentId: playerDoc.enrollmentId,
        group: targetGroup,
        emeraldBalance: playerDoc.emeraldBalance,
        ownedToolIds: playerDoc.ownedToolIds,
        gridState: playerDoc.gridState,
        roomStatus: room ? room.status : 'lobby',
        activeRound: room ? room.activeRound : 0,
        isRoundSubmitted: playerDoc.isRoundSubmitted
      });
      
      console.log(`🔌 Dynamic socket migration complete for ${playerDoc.displayName} to Group ${targetGroup}`);
    }

    // Broadcast updates
    await broadcastLeaderboard(cleanRoomCode);
    broadcastAdminSync(cleanRoomCode);

    res.json({ 
      message: `Successfully switched ${playerDoc.displayName} from Group ${oldGroup} to Group ${targetGroup}!` 
    });

  } catch (err) {
    console.error("❌ Group switching error:", err);
    res.status(500).json({ error: 'Server database error while switching player group.' });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Bidding WebSocket Backend running on port ${PORT}`);
});

async function rebalanceGroups(roomCode, io) {
  const players = await Player.find({ roomCode }).sort({ createdAt: 1 });
  const total = players.length;
  
  let numGroups = 1;
  if (total > 10 && total <= 20) numGroups = 2;
  else if (total > 20) numGroups = 3;

  const groupNames = ['A', 'B', 'C'];
  const room = roomsState[roomCode];

  if (room) {
    room.groups['A'].players = [];
    room.groups['B'].players = [];
    room.groups['C'].players = [];
  }

  const updates = [];
  for (let i = 0; i < total; i++) {
    const p = players[i];
    const targetGroup = groupNames[i % numGroups];
    
    if (p.group !== targetGroup) {
      p.group = targetGroup;
      updates.push(p.save());
    }

    if (room) {
      room.groups[targetGroup].players.push(p.playerId);
    }
  }

  await Promise.all(updates);

  // Update sockets
  const sockets = await io.in(roomCode).fetchSockets();
  for (const sock of sockets) {
    if (sock.playerId) {
      const p = players.find(pl => pl.playerId === sock.playerId);
      if (p) {
        if (sock.group !== p.group) {
          sock.leave(`${roomCode}-${sock.group}`);
          sock.group = p.group;
          sock.join(`${roomCode}-${p.group}`);
        }
        
        const groupData = room ? room.groups[p.group] : null;
        
        // Sync the room state to the client
        sock.emit('room:sync', {
          playerId: p.playerId,
          displayName: p.displayName,
          enrollmentId: p.enrollmentId,
          group: p.group,
          emeraldBalance: p.emeraldBalance,
          ownedToolIds: p.ownedToolIds,
          gridState: p.gridState,
          roomStatus: room ? room.status : 'lobby',
          activeRound: room ? room.activeRound : 0,
          isRoundSubmitted: p.isRoundSubmitted,
          endsAt: room && groupData ? (room.status === 'builder' ? groupData.builderEndsAt : (room.status === 'cooldown' ? groupData.cooldownEndsAt : (room.status === 'auction' ? groupData.currentAuction.endsAt : null))) : null
        });

        // Reconnection payloads based on phase
        if (room && room.status === 'bidding_grace' && groupData) {
          sock.emit('transition:biddingGraceStarted', {
            activeRound: room.activeRound,
            queue: groupData.queue || [],
            endsAt: room.biddingGraceEndsAt,
            firstToolId: groupData.currentAuction.toolId,
            firstToolBasePrice: groupData.currentAuction.basePrice
          });
        } else if (room && room.status === 'auction' && groupData) {
          const auction = groupData.currentAuction;
          sock.emit('transition:auctionStarted', {
            activeRound: room.activeRound,
            queue: groupData.queue || []
          });
          sock.emit('auction:sync', {
            toolId: auction.toolId,
            basePrice: auction.basePrice,
            currentBid: auction.currentBid,
            leadingPlayer: auction.leadingPlayer,
            endsAt: auction.endsAt,
            bids: auction.bids || [],
            queue: groupData.queue || []
          });
        } else if (room && room.status === 'builder' && groupData) {
          sock.emit('transition:builderStarted', {
            endsAt: groupData.builderEndsAt
          });
        }
      }
    }
  }
}

