import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { Trash2, HelpCircle, BookOpen, X, RefreshCw, Trophy, Coins, User, ArrowRight } from 'lucide-react';
import { TOOLS, TYPE_COLORS, getToolColor } from './data/tools';
import { calculateGridScore, validateGridPipeline, QUEST_DOMAINS } from './utils/scoring';
import AuctionPanel from './components/AuctionPanel';

const COLS = 9;
const ROWS = 9;
const GRID_SIZE = 81;
const TILE_SIZE = 55; // 55px seamless cell size

const QUESTS = [
  { problemId: 'spam_detect', name: 'Quest: Spam Detection', description: 'Detect junk messages in a high-volume social network.', domain: 'text', priority: 'accuracy', spotlightTools: ['axe_blueprint', 'ender_chest'], spotlightBonus: 0.20 },
  { problemId: 'fraud_detect', name: 'Quest: Fraud Detection', description: 'Flag transaction anomalies. Highly imbalanced datasets.', domain: 'anomaly', priority: 'accuracy', spotlightTools: ['sword_blueprint', 'high_speed_blast_furnace'], spotlightBonus: 0.25 },
  { problemId: 'disease_predict', name: 'Quest: Disease Detection', description: 'Identify clinical diagnostic markers in hospital medical scans.', domain: 'visual', priority: 'accuracy', spotlightTools: ['pickaxe_blueprint', 'anvil_restructurer'], spotlightBonus: 0.30 },
  { problemId: 'stock_forecast', name: 'Quest: Stock Market Forecasting', description: 'Predict chronological trend indices.', domain: 'timeseries', priority: 'speed', spotlightTools: ['shovel_blueprint', 'redstone_compute_block'], spotlightBonus: 0.15 },
  { problemId: 'realtime_recs', name: 'Quest: Real-time Recommendations', description: 'Calculate product recommendations inside a 10ms frame.', domain: 'timeseries', priority: 'speed', spotlightTools: ['diamond_matrix_ore', 'auto_crafter_block'], spotlightBonus: 0.20 }
];

const TIER_STYLES = {
  Basic: {
    baseBg: 'bg-[#4e5157]',
    border: 'border-2 border-[#2d2f33]',
    glow: 'shadow-[inset_0_0_6px_rgba(255,255,255,0.05)]',
    text: 'text-slate-300'
  },
  C: {
    baseBg: 'bg-[#9c6644]', // Bronze
    border: 'border-2 border-[#5c3821]',
    glow: 'shadow-[inset_0_0_8px_rgba(246,135,17,0.15)]',
    text: 'text-orange-200'
  },
  B: {
    baseBg: 'bg-[#2563eb]', // Lapis Blue
    border: 'border-2 border-[#1e3a8a]',
    glow: 'shadow-[inset_0_0_10px_rgba(96,165,250,0.3)]',
    text: 'text-blue-200'
  },
  A: {
    baseBg: 'bg-[#dca51a]', // Premium Gold
    border: 'border-2 border-[#fef08a] shadow-[0_0_8px_rgba(234,179,8,0.4)]',
    glow: 'shadow-[inset_0_0_12px_rgba(254,240,138,0.6)]',
    text: 'text-yellow-100'
  }
};

export default function App() {
  // --- CONNECTION & PLAYER LOBBY STATE ---
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [playerProfile, setPlayerProfile] = useState({
    playerId: '',
    displayName: '',
    group: 'A',
    emeraldBalance: 1000,
    ownedToolIds: ['cobblestone_sample', 'axe_blueprint', 'pickaxe_blueprint', 'sword_blueprint', 'shovel_blueprint', 'standard_crafting_table', 'wooden_chest'],
    activeRound: 1
  });
  
  const [socket, setSocket] = useState(null);
  const [roomStatus, setRoomStatus] = useState('lobby'); // 'lobby' | 'auction' | 'builder' | 'cooldown' | 'finished'
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  
  // --- GAMEPLAY TAB TABS STATE ---
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'auction'
  const [notificationAlert, setNotificationAlert] = useState(false);

  // --- GRID STATE (9x9 oakwood setup) ---
  const [grid, setGrid] = useState(Array(GRID_SIZE).fill(null));
  const [selectedCellIndex, setSelectedCellIndex] = useState(null);
  const [activeQuest, setActiveQuest] = useState(QUESTS[0]);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedTool, setSelectedTool] = useState(TOOLS[0]);

  // --- TIMER STATE FOR BUILDER / COOLDOWN ---
  const [builderEndsAt, setBuilderEndsAt] = useState(null);
  const [builderTimeLeft, setBuilderTimeLeft] = useState(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState(null);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(null);

  // Sound/UX alert callbacks
  const playOutbidSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime); // Low warning note
      osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      console.warn('AudioContext blocked/not supported');
    }
  };

  // --- MONGO BACKEND URL CONFIGS ---
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  // --- CONNECT SOCKETS ---
  const handleJoinLobby = (e) => {
    if (e) e.preventDefault();
    if (!roomCode.trim() || !displayName.trim()) return alert('Please input valid room code and display name!');

    const newSocket = io(backendUrl);

    newSocket.on('connect', () => {
      console.log('🌱 Connected to stateful WebSocket server');
      newSocket.emit('room:join', { roomCode, displayName });
    });

    newSocket.on('room:sync', (syncData) => {
      setPlayerProfile({
        playerId: syncData.playerId,
        displayName: syncData.displayName,
        group: syncData.group,
        emeraldBalance: syncData.emeraldBalance,
        ownedToolIds: syncData.ownedToolIds,
        activeRound: syncData.activeRound
      });
      setRoomStatus(syncData.roomStatus);
      if (syncData.gridState) {
        setGrid(syncData.gridState);
      }
      setIsJoined(true);
    });

    newSocket.on('leaderboard:update', (data) => {
      setGlobalLeaderboard(data.globalLeaderboard);
      // Auto-update local balance
      const selfItem = data.globalLeaderboard.find(p => p.playerId === newSocket.playerId || p.name === displayName);
      if (selfItem) {
        setPlayerProfile(prev => ({
          ...prev,
          emeraldBalance: selfItem.budget
        }));
      }
    });

    // Real-Time phase transitions
    newSocket.on('transition:matchStarted', (data) => {
      setRoomStatus('auction');
      setActiveTab('auction');
      setNotificationAlert(true);
      setSelectedCellIndex(null);
    });

    newSocket.on('transition:auctionStarted', (data) => {
      setRoomStatus('auction');
      setActiveTab('auction');
      setNotificationAlert(true);
      setPlayerProfile(prev => ({
        ...prev,
        activeRound: data.activeRound
      }));
      // Set quest by round sequence
      const quest = QUESTS[data.activeRound - 1] || QUESTS[0];
      setActiveQuest(quest);
    });

    newSocket.on('transition:graceStarted', (data) => {
      // Grace period before transition
      console.log('Auction concluded for first channel. Grace 60s active.');
    });

    newSocket.on('transition:builderStarted', (data) => {
      setRoomStatus('builder');
      setActiveTab('builder');
      setNotificationAlert(true);
      setBuilderEndsAt(data.endsAt);
    });

    newSocket.on('transition:builderEnded', () => {
      // Auto submit pipeline grid scan
      setRoomStatus('cooldown');
      triggerPipelineSubmit();
    });

    newSocket.on('error:join', (msg) => {
      alert(msg);
      newSocket.disconnect();
    });

    newSocket.on('error:bid', (msg) => {
      alert(msg);
    });

    setSocket(newSocket);
  };

  // --- SUBMIT ACTIVE PIPELINE ON CHANGE ---
  const activePipeline = useMemo(() => {
    const slots = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      if (grid[i]) {
        slots.push({ gridIndex: i, id: grid[i] });
      }
    }
    return slots;
  }, [grid]);

  // Main Sequential Pipeline compiler (only includes valid step blocks in flow, excluding extra/hardware blocks)
  const mainPipeline = useMemo(() => {
    const slots = [];
    const resolveTool = (id) => TOOLS.find(t => t.id === id);
    
    // Find all placed blocks with their gridIndex
    const placed = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      if (grid[i]) {
        placed.push({ gridIndex: i, id: grid[i] });
      }
    }
    
    // 1. Dataset
    const dsIndex = placed.findIndex(s => resolveTool(s.id)?.type === 'dataset');
    if (dsIndex === -1) return [];
    const dsSlot = placed[dsIndex];
    slots.push(dsSlot);
    
    const dsTool = resolveTool(dsSlot.id);
    const isNoisy = dsTool.id === 'raw_iron_ore' || dsTool.id === 'raw_gold_ore';
    
    let currentIndex = dsIndex + 1;
    
    // 2. Cleaner (Required for noisy, skip if clean)
    if (isNoisy) {
      const nextSlot = placed[currentIndex];
      if (nextSlot && resolveTool(nextSlot.id)?.type === 'process') {
        slots.push(nextSlot);
        currentIndex++;
      }
    } else {
      const nextSlot = placed[currentIndex];
      if (nextSlot && resolveTool(nextSlot.id)?.type === 'process') {
        currentIndex++;
      }
    }
    
    // 3. Domain Blueprint
    const bpIndex = placed.slice(currentIndex).findIndex(s => resolveTool(s.id)?.type === 'domain');
    if (bpIndex !== -1) {
      const bpSlot = placed[currentIndex + bpIndex];
      slots.push(bpSlot);
      currentIndex = currentIndex + bpIndex + 1;
    }
    
    // 4. Model Architecture
    const modelIdx = placed.slice(currentIndex).findIndex(s => resolveTool(s.id)?.type === 'model');
    if (modelIdx !== -1) {
      const modelSlot = placed[currentIndex + modelIdx];
      slots.push(modelSlot);
      currentIndex = currentIndex + modelIdx + 1;
    }
    
    // 5. Optional Optimizer
    const optIdx = placed.slice(currentIndex).findIndex(s => resolveTool(s.id)?.type === 'optimize');
    if (optIdx !== -1) {
      const optSlot = placed[currentIndex + optIdx];
      slots.push(optSlot);
      currentIndex = currentIndex + optIdx + 1;
    }
    
    // 6. Model Evaluator
    const evIdx = placed.slice(currentIndex).findIndex(s => resolveTool(s.id)?.type === 'evaluate');
    if (evIdx !== -1) {
      const evSlot = placed[currentIndex + evIdx];
      slots.push(evSlot);
    }
    
    return slots;
  }, [grid]);

  const scores = useMemo(() => calculateGridScore(activePipeline, activeQuest), [activePipeline, activeQuest]);
  const validationErrors = useMemo(() => validateGridPipeline(activePipeline), [activePipeline]);

  // Sync auto submit pipeline scores when grid changes
  useEffect(() => {
    if (socket && isJoined && roomStatus === 'builder') {
      socket.emit('pipeline:submit', {
        gridState: grid,
        score: validationErrors.length === 0 ? scores.totalScore : 0
      });
    }
  }, [grid, scores, validationErrors, socket, isJoined, roomStatus]);

  const triggerPipelineSubmit = () => {
    if (socket) {
      socket.emit('pipeline:submit', {
        gridState: grid,
        score: validationErrors.length === 0 ? scores.totalScore : 0
      });
    }
  };

  // --- BULDER TIMER COUNTDOWNS ---
  useEffect(() => {
    if (!builderEndsAt) {
      setBuilderTimeLeft(null);
      return;
    }
    const timer = setInterval(() => {
      const remaining = builderEndsAt - Date.now();
      if (remaining <= 0) {
        setBuilderTimeLeft(0);
        clearInterval(timer);
      } else {
        setBuilderTimeLeft(Math.ceil(remaining / 1000));
      }
    }, 200);
    return () => clearInterval(timer);
  }, [builderEndsAt]);

  // Quick Preset Loader Helper (Matches new 6-slot sequential pipeline layout)
  const loadRecipePreset = (presetNum) => {
    const newGrid = Array(GRID_SIZE).fill(null);
    if (presetNum === 1) {
      // Basic Tabular Classifier (at row 0)
      newGrid[0] = 'cobblestone_sample';
      newGrid[1] = 'axe_blueprint';
      newGrid[2] = 'standard_crafting_table';
      newGrid[3] = 'wooden_chest';
    } else if (presetNum === 2) {
      // Advanced Deep Learning Pipeline (starting at row 2 col 1) - Raw Datasets require cleaner!
      newGrid[19] = 'raw_gold_ore';
      newGrid[20] = 'high_speed_blast_furnace';
      newGrid[21] = 'pickaxe_blueprint';
      newGrid[22] = 'auto_crafter_block';
      newGrid[23] = 'redstone_compute_block';
      newGrid[24] = 'enchanting_bench';
      newGrid[25] = 'ender_chest';
    }
    setGrid(newGrid);
    setSelectedCellIndex(null);
    setShowGuide(false);
  };

  // SVG sequential wires coordinate compiler
  const renderWires = () => {
    const paths = [];
    
    // 1. Draw regular pipeline sequential wires
    for (let i = 0; i < mainPipeline.length - 1; i++) {
      const fromIdx = mainPipeline[i].gridIndex;
      const toIdx = mainPipeline[i + 1].gridIndex;

      const fromRow = Math.floor(fromIdx / COLS);
      const fromCol = fromIdx % COLS;
      const toRow = Math.floor(toIdx / COLS);
      const toCol = toIdx % COLS;

      const x1 = fromCol * TILE_SIZE + TILE_SIZE / 2;
      const y1 = fromRow * TILE_SIZE + TILE_SIZE / 2;
      const x2 = toCol * TILE_SIZE + TILE_SIZE / 2;
      const y2 = toRow * TILE_SIZE + TILE_SIZE / 2;

      if (fromRow === toRow) {
        paths.push(
          <line
            key={`wire-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#d31414"
            strokeWidth="4"
            markerEnd="url(#arrow)"
            className="drop-shadow-[0_0_6px_rgba(211,20,20,0.75)] transition-all duration-300 animate-pulse"
          />
        );
      } else {
        const pathData = `M ${x1} ${y1} H ${x2} V ${y2}`;
        paths.push(
          <path
            key={`wire-${i}`}
            d={pathData}
            fill="none"
            stroke="#d31414"
            strokeWidth="4"
            strokeDasharray="5,4"
            markerEnd="url(#arrow)"
            className="drop-shadow-[0_0_6px_rgba(211,20,20,0.6)] transition-all duration-300"
          />
        );
      }
    }

    // 2. Draw direct line from redstone block to the autocrafter regardless of their positions
    const redstoneSlotIdx = grid.findIndex(id => id === 'redstone_compute_block');
    const autocrafterSlotIdx = grid.findIndex(id => id === 'auto_crafter_block');

    if (redstoneSlotIdx !== -1 && autocrafterSlotIdx !== -1) {
      const fromRow = Math.floor(redstoneSlotIdx / COLS);
      const fromCol = redstoneSlotIdx % COLS;
      const toRow = Math.floor(autocrafterSlotIdx / COLS);
      const toCol = autocrafterSlotIdx % COLS;

      const x1 = fromCol * TILE_SIZE + TILE_SIZE / 2;
      const y1 = fromRow * TILE_SIZE + TILE_SIZE / 2;
      const x2 = toCol * TILE_SIZE + TILE_SIZE / 2;
      const y2 = toRow * TILE_SIZE + TILE_SIZE / 2;

      paths.push(
        <line
          key="wire-redstone-autocrafter"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#d31414"
          strokeWidth="5"
          markerEnd="url(#arrow)"
          className="drop-shadow-[0_0_8px_rgba(211,20,20,0.9)] transition-all duration-300"
        />
      );
    }

    return paths;
  };

  // Selection Sync
  const handleCellClick = (idx) => {
    setSelectedCellIndex(idx);
    if (grid[idx]) {
      const tool = TOOLS.find(t => t.id === grid[idx]);
      if (tool) setSelectedTool(tool);
    }
  };

  // Drag and Drop handlers
  const handleDragStartFromInventory = (e, toolId) => {
    e.dataTransfer.setData('toolId', toolId);
    e.dataTransfer.setData('source', 'inventory');
  };

  const handleDragStartFromGrid = (e, cellIndex) => {
    e.dataTransfer.setData('sourceIndex', cellIndex.toString());
    e.dataTransfer.setData('source', 'grid');
  };

  const handleDropOnGrid = (e, targetIndex) => {
    e.preventDefault();
    const source = e.dataTransfer.getData('source');
    
    if (source === 'inventory') {
      const toolId = e.dataTransfer.getData('toolId');
      
      // Unique block placement check (each tool can be placed only once)
      const isAlreadyPlaced = grid.some((placedId, idx) => idx !== targetIndex && placedId === toolId);
      if (isAlreadyPlaced) {
        alert(`Placement Warning: You can only place one '${TOOLS.find(t => t.id === toolId)?.name || "tool"}' block on the grid at a time!`);
        return;
      }

      const newGrid = [...grid];
      newGrid[targetIndex] = toolId;
      setGrid(newGrid);
      setSelectedCellIndex(targetIndex);
      const tool = TOOLS.find(t => t.id === toolId);
      if (tool) setSelectedTool(tool);
    } else if (source === 'grid') {
      const sourceIndex = parseInt(e.dataTransfer.getData('sourceIndex'), 10);
      if (sourceIndex === targetIndex) return;
      
      const newGrid = [...grid];
      // Swap or move
      const temp = newGrid[targetIndex];
      newGrid[targetIndex] = newGrid[sourceIndex];
      newGrid[sourceIndex] = temp;
      
      setGrid(newGrid);
      setSelectedCellIndex(targetIndex);
    }
  };

  // Trash bin deletion
  const handleDeleteSelected = () => {
    if (selectedCellIndex === null) return;
    const newGrid = [...grid];
    newGrid[selectedCellIndex] = null;
    setGrid(newGrid);
    setSelectedCellIndex(null);
  };

  // Render tool base tier baseBg colors and image overlays correctly
  const renderToolIcon = (tool, className = "", isGrid = false) => {
    const isUrl = tool.icon && (tool.icon.startsWith('http') || tool.icon.endsWith('.webp') || tool.icon.includes('/'));
    const tierStyle = TIER_STYLES[tool.tier] || TIER_STYLES.Basic;
    
    // Scale inside the 9x9 grass grid, scale to full tile container (100% fullsized)
    const sizeClass = isGrid ? 'w-full h-full' : (tool.imageSize === 256 ? 'w-[80%] h-[80%]' : 'w-[55%] h-[55%]');

    return (
      <div className={`w-full h-full rounded flex items-center justify-center relative overflow-hidden transition-all duration-200 ${tierStyle.baseBg} ${tierStyle.border} ${tierStyle.glow} ${className}`}>
        {isUrl ? (
          <img 
            src={tool.icon} 
            alt={tool.name} 
            className={`${sizeClass} object-contain select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]`} 
          />
        ) : (
          <span className={`text-xl select-none ${tierStyle.text}`}>{tool.icon}</span>
        )}
      </div>
    );
  };

  // --- LOBBY JOIN INTERFACE ---
  if (!isJoined) {
    return (
      <div className="min-h-screen w-full bg-minecraft-stone flex items-center justify-center p-6 text-slate-100 select-none font-sans">
        <form onSubmit={handleJoinLobby} className="max-w-md w-full bg-[#d2a06c] border-4 border-slate-950 p-8 rounded-lg shadow-2xl space-y-6 text-slate-900">
          <div className="text-center">
            <h1 className="text-2xl font-black font-mono tracking-wider uppercase text-slate-950 drop-shadow-sm">
              ⚔️ Pipeline Arena Lobby
            </h1>
            <p className="text-xs text-slate-800 font-extrabold uppercase tracking-wider font-mono mt-1">Multiplayer Auction & Build System</p>
          </div>

          <div className="space-y-4 font-mono text-xs text-left">
            <div>
              <label className="text-[10px] text-slate-900 font-black uppercase tracking-wider block mb-1.5">Game Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ARENA99"
                required
                className="w-full bg-slate-950 border-2 border-slate-900 focus:border-emerald-600 rounded px-4 py-2.5 text-xs text-white uppercase focus:outline-none tracking-widest font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-900 font-black uppercase tracking-wider block mb-1.5">Your Player Nickname</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Notch"
                maxLength={12}
                required
                className="w-full bg-slate-950 border-2 border-slate-900 focus:border-emerald-600 rounded px-4 py-2.5 text-xs text-white focus:outline-none font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white border-2 border-slate-950 font-black uppercase rounded shadow-lg transition active:scale-95 text-center text-xs tracking-widest"
          >
            Enter Crafting Station Lobby ➔
          </button>
        </form>
      </div>
    );
  }

  // --- MAIN APP WORKSPACE ---
  return (
    <div className="h-full w-full flex flex-col overflow-hidden text-slate-100 bg-minecraft-stone">
      
      {/* 1. HUD TOP BAR */}
      <header className="h-12 bg-minecraft-stone border-b-4 border-slate-700 px-4 flex items-center justify-between text-sm shrink-0 z-30 shadow-md">
        
        {/* Currency Box with Emerald Icon */}
        <div className="flex items-center bg-slate-900/60 border border-emerald-500/30 rounded px-3 h-10 select-none overflow-hidden relative pr-4 gap-2.5 shadow-[inset_0_0_8px_rgba(16,185,129,0.15)]">
          <img src="https://i.ibb.co/k2GP6hYZ/Emerald.webp" alt="Emerald" className="w-5 h-5 object-contain select-none pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] animate-pulse" />
          <div className="flex flex-col justify-center leading-none font-mono">
            <span className="text-[7px] text-emerald-400 font-extrabold uppercase tracking-widest block">Emerald budget</span>
            <span className="text-[12px] font-black text-emerald-300 mt-0.5 block">
              {playerProfile.emeraldBalance} <span className="text-[9px] text-slate-500 font-bold">EMERALDS</span>
            </span>
          </div>
        </div>

        {/* Phase Status Center Banner */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 border-2 border-slate-700 rounded px-3.5 py-1 text-xs font-mono font-bold flex items-center gap-2">
            <span className="text-slate-400 uppercase">Phase:</span>
            {roomStatus === 'lobby' && <span className="text-slate-300 animate-pulse">Lobby Waiting</span>}
            {roomStatus === 'auction' && <span className="text-yellow-400 animate-pulse">🔨 Active Auction Round {playerProfile.activeRound}</span>}
            {roomStatus === 'builder' && (
              <span className="text-emerald-400">
                ⛏️ Building (0{builderTimeLeft ? Math.floor(builderTimeLeft / 60) : 0}:{builderTimeLeft ? (builderTimeLeft % 60 < 10 ? `0${builderTimeLeft % 60}` : builderTimeLeft % 60) : '00'})
              </span>
            )}
            {roomStatus === 'cooldown' && <span className="text-red-400">⏳ Strategic planning cooldown...</span>}
            {roomStatus === 'finished' && <span className="text-yellow-300 uppercase tracking-widest font-black">🏆 Finished!</span>}
          </div>

          <div className="bg-slate-800 border-2 border-slate-700 rounded px-3 py-1 text-[10px] font-mono font-extrabold text-slate-300">
            {QUEST_DOMAINS[activeQuest.domain]?.fieldName || 'General'}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Guide HUD Trigger button */}
          <button 
            onClick={() => setShowGuide(true)}
            className="px-3.5 py-1 bg-sky-950 text-sky-400 border border-sky-800 hover:bg-sky-900 rounded-md font-bold text-xs uppercase flex items-center gap-1.5 transition-all shadow-[0_0_6px_rgba(56,189,248,0.2)]"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Guide (G)
          </button>
          
          <div className="flex items-center gap-3 border-l border-slate-700 pl-4 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-200">{playerProfile.displayName}</span>
            </div>
            <div className="flex items-center gap-1 border-l border-slate-700 pl-3">
              <span className="text-[10px] text-yellow-400 font-extrabold tracking-wider bg-yellow-950 border border-yellow-800 px-2 rounded">
                Group {playerProfile.group}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN LAYOUT PANEL */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* DOCKED LEFT SIDEBAR FOR AUCTION TOGGLE */}
        <div className="w-16 bg-[#2d2f33] border-r-4 border-slate-700 flex flex-col items-center py-4 gap-4 shrink-0 z-20 shadow-2xl relative">
          
          {/* Main Sandbox Grid Builder trigger */}
          <button
            onClick={() => {
              setActiveTab('builder');
              setNotificationAlert(false);
            }}
            className={`w-12 h-12 rounded flex flex-col items-center justify-center gap-0.5 border-2 transition-all ${
              activeTab === 'builder' 
                ? 'bg-emerald-900 border-emerald-500 shadow-[inset_0_0_8px_rgba(16,185,129,0.3)] text-emerald-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
            }`}
            title="Grid Builder sandbox"
          >
            <span className="text-[8px] font-black uppercase font-mono">Build</span>
            <span className="text-lg">⛏️</span>
          </button>

          {/* Auction Entry Card Button */}
          <button 
            onClick={() => {
              setActiveTab('auction');
              setNotificationAlert(false);
            }}
            className={`w-12 h-28 border-2 rounded flex flex-col items-center justify-center gap-2 transition-all text-white font-mono ${
              activeTab === 'auction'
                ? 'bg-gradient-to-b from-[#dca51a] to-[#b47c0b] border-[#fef08a] shadow-[0_0_12px_rgba(234,179,8,0.5)] scale-105'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-750'
            }`}
            title="Enter Auction Room"
          >
            {notificationAlert && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping z-30"></span>
            )}
            <div className="text-[8.5px] font-black uppercase tracking-widest text-yellow-100 flex flex-col items-center leading-none gap-0.5">
              <span>A</span>
              <span>U</span>
              <span>C</span>
              <span>T</span>
              <span>I</span>
              <span>O</span>
              <span>N</span>
            </div>
            <img src="https://i.ibb.co/k2GP6hYZ/Emerald.webp" className="w-4 h-4 object-contain animate-bounce mt-1" />
          </button>
        </div>

        {/* CONTROLLER DISPLAY DECISION */}
        {activeTab === 'auction' ? (
          <div className="flex-1 h-full">
            <AuctionPanel 
              socket={socket} 
              playerProfile={playerProfile} 
              activeQuest={activeQuest}
              onOutbid={playOutbidSound}
              onAuctionClosed={() => {
                setActiveTab('builder');
                setNotificationAlert(true);
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            
            {/* LEFT AREA: 9x9 GRID WORKSPACE */}
            <div className="flex-1 bg-minecraft-stone flex flex-col items-center justify-center p-6 relative overflow-auto z-10">
              
              <div className="relative bg-slate-900/40 p-4 border-4 border-slate-950 rounded-lg shadow-2xl flex flex-col justify-between">
                
                {/* Seamless 9x9 grass grid wrapper */}
                <div className="relative select-none" style={{
                  width: `${COLS * TILE_SIZE}px`,
                  height: `${ROWS * TILE_SIZE}px`
                }}>
                  
                  {/* Grid Grass Tiles Backdrop */}
                  <div className="absolute inset-0 grid" style={{
                    gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
                    gridTemplateRows: `repeat(${ROWS}, ${TILE_SIZE}px)`
                  }}>
                    {Array.from({ length: GRID_SIZE }).map((_, idx) => (
                      <div
                        key={`cell-${idx}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnGrid(e, idx)}
                        onClick={() => handleCellClick(idx)}
                        className={`grass-tile border border-minecraft-grassDark/20 cursor-pointer transition-colors duration-200 ${
                          selectedCellIndex === idx ? 'ring-2 ring-yellow-400 z-20' : 'hover:brightness-105'
                        }`}
                      />
                    ))}
                  </div>

                  {/* SVG Wires Layer (connecting centers of placed blocks) */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="4"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#d31414" />
                      </marker>
                    </defs>
                    {renderWires()}
                  </svg>

                  {/* Placed Tools Block Overlay */}
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {grid.map((toolId, idx) => {
                      if (!toolId) return null;
                      const tool = TOOLS.find(t => t.id === toolId);
                      if (!tool) return null;
                      
                      const row = Math.floor(idx / COLS);
                      const col = idx % COLS;
                      
                      const isMismatch = scores.domainMismatches.some(m => m.gridIndex === idx);

                      return (
                        <div
                          key={`placed-block-${idx}`}
                          draggable
                          onDragStart={(e) => handleDragStartFromGrid(e, idx)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(idx);
                          }}
                          className={`absolute p-1 flex items-center justify-center transition-transform hover:scale-105 pointer-events-auto cursor-grab active:cursor-grabbing ${
                            selectedCellIndex === idx ? 'scale-105' : ''
                          }`}
                          style={{
                            left: `${col * TILE_SIZE}px`,
                            top: `${row * TILE_SIZE}px`,
                            width: `${TILE_SIZE}px`,
                            height: `${TILE_SIZE}px`
                          }}
                        >
                          <div className="w-full h-full relative">
                            {renderToolIcon(tool, isMismatch ? 'ring-2 ring-amber-500 shadow-[0_0_8px_#f59e0b]' : '', true)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Bottom indicators: Trash Bin & selection coordinate label */}
                <div className="mt-4 flex items-center justify-between shrink-0 font-mono text-xs">
                  <div className="text-slate-400">
                    {selectedCellIndex !== null ? (
                      <span>Selected Block: ({Math.floor(selectedCellIndex / 9)}, {selectedCellIndex % 9})</span>
                    ) : (
                      <span>Click a cell to inspect coordinates</span>
                    )}
                  </div>

                  {/* Redstone Trash Bin */}
                  <button 
                    disabled={selectedCellIndex === null || !grid[selectedCellIndex]}
                    onClick={handleDeleteSelected}
                    className="p-2 rounded border-2 border-slate-950 text-white flex items-center gap-1.5 transition-all shadow-md font-bold text-xs uppercase disabled:opacity-30 disabled:pointer-events-none bg-red-800 hover:bg-red-700"
                    title="Remove placed block"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    REMOVE TOOL
                  </button>
                </div>

              </div>

            </div>

            {/* RIGHT SIDE PANEL: ENCYCLOPEDIA & LEADERBOARD PANEL */}
            <aside className="w-[20vw] min-w-[280px] bg-[#c6c6c6] border-l-4 border-slate-700 flex flex-col shrink-0 z-20 shadow-lg text-slate-900">
              
              {/* Leaderboard view panel */}
              <div className="p-3 bg-[#a6a6a6] border-b-2 border-slate-700/60 shrink-0">
                <h3 className="text-xs font-black tracking-widest text-slate-950 uppercase flex items-center justify-between font-mono">
                  <span>🏆 Leaderboard Rank</span>
                  <Trophy className="w-3.5 h-3.5 text-yellow-600" />
                </h3>
                
                <div className="mt-2 space-y-1 font-mono text-[9px] max-h-[110px] overflow-y-auto">
                  {globalLeaderboard.slice(0, 5).map((player, idx) => (
                    <div 
                      key={idx} 
                      className={`flex justify-between items-center p-1 rounded ${
                        player.playerId === playerProfile.playerId 
                          ? 'bg-yellow-950/20 border border-yellow-800/40 text-yellow-900 font-bold' 
                          : 'bg-slate-950/5 text-slate-800'
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{idx + 1}. {player.name} ({player.group})</span>
                      <span className="font-extrabold">{player.score} pts</span>
                    </div>
                  ))}
                  {globalLeaderboard.length === 0 && (
                    <span className="text-slate-500 italic block py-1 text-center">No scores submitted yet.</span>
                  )}
                </div>
              </div>

              {/* LIVE METRICS HUD */}
              <div className="p-4 border-b-2 border-[#a6a6a6] flex-1 overflow-y-auto space-y-4 font-sans">
                
                <div className="bg-slate-950/80 p-3.5 rounded-lg border-2 border-slate-900 text-center shadow-inner relative overflow-hidden text-white font-mono">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">Elder Flow Score</span>
                  <div className="text-3xl font-black tracking-tight mt-1 text-yellow-400">
                    {validationErrors.length === 0 ? scores.totalScore : 0} <span className="text-sm font-bold text-slate-500">/ 1000</span>
                  </div>
                  <span className="text-[8px] text-slate-500 mt-1 block leading-tight">Strict 6-Slot Sequential Validation</span>
                </div>

                {/* Progress bars details */}
                <div className="space-y-3">
                  {/* Accuracy */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-xs font-black text-slate-950">
                      <span className="uppercase tracking-wide">🎯 Accuracy Quality</span>
                      <span className="font-mono">{validationErrors.length === 0 ? Math.round(scores.accuracy * 100) : 0}%</span>
                    </div>
                    <div className="h-3.5 bg-slate-950/80 rounded border-2 border-slate-900 overflow-hidden p-0.5">
                      <div className="h-full bg-theme-lapis rounded transition-all duration-300" style={{ width: `${validationErrors.length === 0 ? scores.accuracy * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  {/* Speed */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-xs font-black text-slate-950">
                      <span className="uppercase tracking-wide">⚡ Time Efficiency</span>
                      <span className="font-mono">{validationErrors.length === 0 ? Math.round(scores.speed * 100) : 0}%</span>
                    </div>
                    <div className="h-3.5 bg-slate-950/80 rounded border-2 border-slate-900 overflow-hidden p-0.5">
                      <div className="h-full bg-theme-redstone rounded transition-all duration-300" style={{ width: `${validationErrors.length === 0 ? scores.speed * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  {/* Stability */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-xs font-black text-slate-950">
                      <span className="uppercase tracking-wide">🛡 Model Stability</span>
                      <span className="font-mono">{validationErrors.length === 0 ? Math.round(scores.stability * 100) : 0}%</span>
                    </div>
                    <div className="h-3.5 bg-slate-950/80 rounded border-2 border-slate-900 overflow-hidden p-0.5">
                      <div className="h-full bg-purple-600 rounded transition-all duration-300" style={{ width: `${validationErrors.length === 0 ? scores.stability * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-black text-slate-950 pt-1">
                    <span>💲 Cost efficiency: {Math.round(scores.costEfficiency * 100)}%</span>
                    <span>📦 Blocks: {activePipeline.length} / 8</span>
                  </div>
                </div>

                {/* recipe diagnostics messages */}
                <div className="pt-2 border-t border-slate-700/30">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider block mb-1">Recipe Diagnostics:</span>
                  {validationErrors.length > 0 ? (
                    <div className="bg-red-900/20 border-2 border-red-800 rounded p-2 text-[10px] text-red-950 font-mono space-y-1.5 leading-normal max-h-[120px] overflow-y-auto">
                      {validationErrors.map((err, i) => (
                        <div key={i} className="flex items-start gap-1">
                          <span className="font-sans">❌</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-emerald-950/20 border-2 border-emerald-900 text-emerald-950 rounded p-2 text-[10px] leading-relaxed font-mono font-bold">
                      ✔ Recipe valid! 6-Slot Sequential data flow validates correctly. Delivered scroll to Elder.
                    </div>
                  )}
                </div>

                {/* Domain Locking Diagnostics Mismatches */}
                {scores.domainMismatches.length > 0 && (
                  <div className="bg-amber-900/20 border-2 border-amber-800 rounded p-2 text-[9px] text-amber-950 space-y-1 font-mono leading-tight">
                    <span className="font-black block text-[10px] uppercase">Domain Mismatches:</span>
                    {scores.domainMismatches.map((m, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <span>•</span>
                        <span>Slot ({Math.floor(m.gridIndex / 9)}, {m.gridIndex % 9}): '{m.toolName}' is locked to {m.lockedDomain} problems! accuracy penalty applies.</span>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* BOTTOM: SELECTED ITEM DETAILS */}
              <div className="h-[35%] border-t-4 border-slate-700 bg-[#b0b0b0] p-4 flex flex-col overflow-y-auto shrink-0 select-none text-slate-900">
                <span className="text-xs font-black tracking-widest text-slate-950 uppercase mb-2">Item Encyclopedia</span>
                
                {selectedTool ? (
                   <div className="flex-1 flex flex-col text-left">
                     <div className="flex items-center justify-between">
                       <h4 className="font-black text-slate-950 text-xs flex items-center gap-2">
                        <div className="w-7 h-7 flex items-center justify-center shrink-0 border border-slate-700/30 rounded bg-slate-950/15 p-0.5 relative overflow-hidden">
                          <img 
                            src={selectedTool.icon} 
                            alt={selectedTool.name} 
                            className="w-full h-full object-contain select-none" 
                          />
                        </div>
                        <span>{selectedTool.name}</span>
                      </h4>
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded border shadow-sm ${
                        selectedTool.tier === 'A' ? 'bg-amber-950 text-yellow-300 border-yellow-700/50' :
                        selectedTool.tier === 'B' ? 'bg-blue-950 text-blue-200 border-blue-800/50' :
                        selectedTool.tier === 'C' ? 'bg-amber-950 text-orange-200 border-amber-800/50' : 'bg-slate-800 text-slate-300 border-slate-700/50'
                      }`}>
                        Tier {selectedTool.tier === 'Basic' ? 'D' : selectedTool.tier}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-950 font-semibold mt-2 leading-relaxed">
                      <span className="font-bold block text-[9px] text-slate-800 mb-0.5">Prerequisite: {selectedTool.prereq}</span>
                      {selectedTool.description}
                    </p>

                    <div className="mt-auto grid grid-cols-3 gap-1 text-center text-[9px] font-mono shrink-0 pt-2">
                      <div className="bg-slate-950/10 border border-slate-700/30 p-1 rounded">
                        <span className="text-slate-850 block text-[9px] uppercase font-extrabold">Accuracy</span>
                        <span className="text-[#1e3a8a] text-[12px] font-black mt-0.5 block">
                          {selectedTool.accuracyImpact > 0 ? `+${selectedTool.accuracyImpact}` : (selectedTool.accuracyImpact === 0 ? 'Domain' : selectedTool.accuracyImpact)}
                        </span>
                      </div>
                      <div className="bg-slate-950/10 border border-slate-700/30 p-1 rounded">
                        <span className="text-slate-850 block text-[9px] uppercase font-extrabold">Speed</span>
                        <span className="text-[#991b1b] text-[12px] font-black mt-0.5 block">
                          {selectedTool.speedImpact > 0 ? `+${selectedTool.speedImpact}` : selectedTool.speedImpact}
                        </span>
                      </div>
                      <div className="bg-slate-950/10 border border-slate-700/30 p-1 rounded">
                        <span className="text-slate-850 block text-[9px] uppercase font-extrabold">Stability</span>
                        <span className="text-[#581c87] text-[12px] font-black mt-0.5 block">
                          {selectedTool.stabilityImpact > 0 ? `+${selectedTool.stabilityImpact}` : selectedTool.stabilityImpact}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-850 text-xs text-center opacity-60">
                    <HelpCircle className="w-8 h-8 mb-2" />
                    <span>Click any item in inventory or grid to inspect characteristics</span>
                  </div>
                )}
              </div>

            </aside>
          </div>
        )}

      </div>

      {/* 3. INVENTORY SHELF Tray (Oak Wooden Texture Panel) */}
      {activeTab === 'builder' && (
        <footer className="h-[18vh] bg-[#d2a06c] border-t-4 border-slate-700 p-2 flex flex-col shrink-0 z-20 shadow-inner text-slate-900 select-none">
          <div className="flex items-center justify-between mb-1.5 px-2 shrink-0">
            <span className="text-xs font-black uppercase text-slate-950 tracking-wider">📦 Oakwood Trading Shelf (Drag Blocks)</span>
            <span className="text-[9px] text-slate-700 font-bold">💡 Drag blocks onto the 9x9 grass field grid</span>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-2 pb-1 px-1">
            {TOOLS.filter(tool => tool.tier === 'Basic' || playerProfile.ownedToolIds.includes(tool.id)).map(tool => {
              const tierStyle = TIER_STYLES[tool.tier] || TIER_STYLES.Basic;
              const isUrl = tool.icon && (tool.icon.startsWith('http') || tool.icon.endsWith('.webp') || tool.icon.includes('/'));
              const sizeClass = 'w-[90%] h-[90%]';

              return (
                <div
                  key={tool.id}
                  draggable
                  onDragStart={(e) => handleDragStartFromInventory(e, tool.id)}
                  onClick={() => setSelectedTool(tool)}
                  className={`h-full min-w-[95px] max-w-[95px] border-2 border-slate-950 rounded flex flex-col p-1.5 text-left cursor-grab active:cursor-grabbing hover:brightness-110 hover:scale-105 transition-all shadow-md shrink-0 relative overflow-hidden text-white ${tierStyle.baseBg} ${tierStyle.border} ${tierStyle.glow}`}
                >
                  <div className="flex items-center justify-between text-[7.5px] text-slate-200 font-extrabold leading-none shrink-0 z-10">
                    <span className="uppercase opacity-85 truncate max-w-[45px]">{tool.type}</span>
                    <span className="uppercase">{tool.tier}</span>
                  </div>

                  <div className="w-10 h-10 mx-auto my-1 flex items-center justify-center shrink-0">
                    {isUrl ? (
                      <img 
                        src={tool.icon} 
                        alt={tool.name} 
                        className={`${sizeClass} object-contain select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]`} 
                      />
                    ) : (
                      <span className="text-xl select-none">{tool.icon}</span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-[8.5px] text-slate-100 truncate text-center mt-auto w-full px-0.5 bg-slate-950/40 rounded leading-tight z-10 pointer-events-none">
                    {tool.name}
                  </h3>
                </div>
              );
            })}
          </div>
        </footer>
      )}

      {/* 4. 'G' GUIDE DIALOG POPUP MODAL */}
      {showGuide && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none text-slate-900">
          <div className="max-w-2xl w-full bg-[#d2a06c] border-4 border-slate-950 p-6 rounded-lg shadow-2xl relative">
            
            <button 
              onClick={() => setShowGuide(false)}
              className="absolute top-3 right-3 text-slate-950 hover:text-slate-800 bg-slate-950/10 hover:bg-slate-950/20 w-8 h-8 rounded-full flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black font-mono tracking-wide text-slate-950 uppercase border-b-2 border-slate-700/60 pb-2 mb-3 flex items-center gap-2">
              <span>📖</span>
              <span>Pipeline Crafting Recipe Guide</span>
            </h2>

            <div className="space-y-4 text-xs max-h-[65vh] overflow-y-auto pr-1 leading-relaxed">
              
              <div className="bg-slate-950/10 border-2 border-slate-700/40 p-2.5 rounded text-[11px] leading-normal font-mono font-bold text-slate-800">
                <div className="text-center border-b border-slate-700/30 pb-1 mb-1.5 uppercase font-black tracking-wider text-slate-900">
                  Standard Pipeline Crafting Flow (6 Slots)
                </div>
                <div className="flex flex-col gap-1 items-center text-center">
                  <div>Slot 1: DATA INPUT [Cobblestone / Dia Matrix / Raw Iron / Gold]</div>
                  <div className="text-[9px] text-slate-500">➔ (Optional Cleaner) [Furnace / Blast Furnace - REQUIRED for raw ores]</div>
                  <div>➔ Slot 3: DOMAIN BLUEPRINT [Axe CV / Pick CV / Sword Anom / Shovel Time]</div>
                  <div>➔ Slot 4: MODEL [Crafting Table / Auto-Crafter + Redstone GPU]</div>
                  <div className="text-[9px] text-slate-500">➔ (Optional Optimizer) [Anvil Regularizer / Enchanting Tuner]</div>
                  <div>➔ Slot 6: EVALUATOR CHEST [Wooden Chest / Ender Chest]</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/10 border-2 border-slate-700/40 rounded space-y-2">
                <h3 className="font-black text-slate-950 text-sm uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                  Crafting Recipes Presets
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/20 p-3 rounded border border-slate-700/30">
                    <span className="font-bold block text-slate-900 mb-1 text-[11px]">Tabular Classifier Preset</span>
                    <div className="font-mono text-[9px] text-slate-700 space-y-0.5 mb-2">
                      • 🪨 Cobblestone<br />
                      • 🪓 Axe Blueprint<br />
                      • 🛠️ Crafting Table<br />
                      • 📦 Wooden Chest
                    </div>
                    <button 
                      onClick={() => loadRecipePreset(1)}
                      className="w-full py-1 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded text-[9px] uppercase tracking-wider"
                    >
                      Instant Craft Preset 1
                    </button>
                  </div>

                  <div className="bg-slate-950/20 p-3 rounded border border-slate-700/30">
                    <span className="font-bold block text-slate-900 mb-1 text-[11px]">Advanced DL Preset</span>
                    <div className="font-mono text-[9px] text-slate-700 space-y-0.5 mb-2">
                      • 🪙 Raw Gold Ore<br />
                      • 🔥 Fast Blast Furnace<br />
                      • ⛏️ Pickaxe Blueprint<br />
                      • ⚙️ Auto-Crafter + Redstone Block<br />
                      • ✨ Enchanting Bench + Ender Chest
                    </div>
                    <button 
                      onClick={() => loadRecipePreset(2)}
                      className="w-full py-1 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded text-[9px] uppercase tracking-wider"
                    >
                      Instant Craft Preset 2
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t-2 border-slate-700/60 pt-3 text-right">
              <button 
                onClick={() => setShowGuide(false)}
                className="px-4 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-bold uppercase rounded text-xs"
              >
                Close Guide
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
