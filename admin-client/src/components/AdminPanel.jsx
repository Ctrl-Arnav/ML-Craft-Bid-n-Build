import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Shield, Coins, Users, Clock, Play, ArrowRight, Settings, Radio, Plus, RotateCw, AlertTriangle, FastForward } from 'lucide-react';

// Tool catalog to parse details in player simulation mode
const TOOL_CATALOG = {
  'cobblestone_sample': { name: 'Cobblestone', type: 'dataset', tier: 'Basic', description: 'Clean, tabular sample. Maximizes Stability upfront with 0% impurity, but heavily limits your final Accuracy ceiling due to its tiny size.', icon: 'https://i.ibb.co/Ng0XtyR6/Cobblestone.webp', basePrice: 0, accuracyImpact: 0.15, speedImpact: 0.00, stabilityImpact: 0.40, domainLock: null },
  'raw_iron_ore': { name: 'Raw Iron Ore', type: 'dataset', tier: 'C', description: 'Noisy, raw data. Unlocks higher Accuracy potential than Cobblestone, but heavily drains baseline Stability unless routed through a cleaning block.', icon: 'https://i.ibb.co/v4z6VRBz/Raw-Iron.webp', basePrice: 200, accuracyImpact: 0.35, speedImpact: 0.00, stabilityImpact: -0.25, domainLock: null },
  'raw_gold_ore': { name: 'Raw Gold Ore', type: 'dataset', tier: 'B', description: 'Massive raw files. Drastically raises your maximum Accuracy cap, but severely crashes pipeline Stability and slightly lowers Time Efficiency.', icon: 'https://i.ibb.co/nJk8ktS/Raw-Gold.webp', basePrice: 350, accuracyImpact: 0.60, speedImpact: -0.10, stabilityImpact: -0.45, domainLock: null },
  'diamond_matrix_ore': { name: 'Diamond Ore', type: 'dataset', tier: 'A', description: 'High-dimensional, organized feature matrix. Skyrockets Accuracy and preserves Stability, but its sheer volume inflicts a massive hit to Time Efficiency.', icon: 'https://i.ibb.co/PZdV5y1Z/Diamond-Ore.webp', basePrice: 700, accuracyImpact: 0.85, speedImpact: -0.30, stabilityImpact: 0.35, domainLock: null },
  'standard_furnace': { name: 'Furnace', type: 'process', tier: 'C', description: 'Purges noise, missing values, and outliers. Restores lost Stability points from raw input ores, but introduces a minor processing delay to Time Efficiency.', icon: 'https://i.ibb.co/pjcMwnNQ/Furnace.webp', basePrice: 100, accuracyImpact: 0.00, speedImpact: -0.10, stabilityImpact: 0.30, domainLock: null },
  'high_speed_blast_furnace': { name: 'Fast Blast Furnace', type: 'process', tier: 'B', description: 'Pre-processes, strips anomalies, and normalizes features. Maximizes Stability gains and provides a massive, high-speed boost to Time Efficiency.', icon: 'https://i.ibb.co/hRCvy83H/Blast-Furnace.webp', basePrice: 300, accuracyImpact: 0.00, speedImpact: 0.35, stabilityImpact: 0.45, domainLock: null },
  'axe_blueprint': { name: 'Axe Blueprint', type: 'domain', tier: 'Basic', description: 'Designed to parse text sequences. Triggers a massive multiplier on Accuracy if matched with a Text problem; otherwise, it degrades your score.', icon: 'https://i.ibb.co/MxQ0RB2x/axe.webp', basePrice: 150, accuracyImpact: 0.00, speedImpact: 0.00, stabilityImpact: 0.00, domainLock: 'text' },
  'pickaxe_blueprint': { name: 'Pickaxe Blueprint', type: 'domain', tier: 'Basic', description: 'Built to break down multi-dimensional grids. Yields an explosive Accuracy surge for Image tasks, but slightly penalizes your pipeline\'s Time Efficiency.', icon: 'https://i.ibb.co/hjG83Fs/pickaxe.webp', basePrice: 150, accuracyImpact: 0.00, speedImpact: -0.05, stabilityImpact: 0.00, domainLock: 'visual' },
  'sword_blueprint': { name: 'Sword Blueprint', type: 'domain', tier: 'Basic', description: 'Designed to spot sharp deviations. Maximizes Accuracy on Fraud/Irregularity problems while maintaining high baseline Time Efficiency.', icon: 'https://i.ibb.co/PsnJBLRm/sword.webp', basePrice: 150, accuracyImpact: 0.00, speedImpact: 0.15, stabilityImpact: 0.00, domainLock: 'anomaly' },
  'shovel_blueprint': { name: 'Shovel Blueprint', type: 'domain', tier: 'Basic', description: 'Tracks continuous data trends over chronological paths. Guarantees a significant Accuracy bonus on forecasting tasks with zero penalty to Stability.', icon: 'https://i.ibb.co/m5PzJw1G/shovel.webp', basePrice: 150, accuracyImpact: 0.00, speedImpact: 0.00, stabilityImpact: 0.00, domainLock: 'timeseries' },
  'standard_crafting_table': { name: 'Crafting Table', type: 'model', tier: 'Basic', description: 'Combines components into a robust tool framework. Offers highly reliable, safe baseline gains to both Accuracy and Stability across all domains.', icon: 'https://i.ibb.co/mC5s4qCh/Crafting-Table.webp', basePrice: 200, accuracyImpact: 0.25, speedImpact: 0.00, stabilityImpact: 0.20, domainLock: null },
  'auto_crafter_block': { name: 'Auto-Crafter', type: 'model', tier: 'B', description: 'Automatically optimizes weights internally. Greatly increases both Accuracy and Stability, though it asks a higher trade-off in Cost Efficiency.', icon: 'https://i.ibb.co/Ld9mXmPX/Auto-Crafter.webp', basePrice: 450, accuracyImpact: 0.45, speedImpact: 0.00, stabilityImpact: 0.35, domainLock: null },
  'redstone_compute_block': { name: 'Redstone Block', type: 'hardware', tier: 'A', description: 'Acts as an external plugin for the model. Put it beside Auto-Crafter to skyrocket Efficiency to maximum levels.', icon: 'https://i.ibb.co/tTbqYb0d/Redstone.webp', basePrice: 500, accuracyImpact: 0.00, speedImpact: 0.60, stabilityImpact: 0.00, domainLock: null },
  'anvil_restructurer': { name: 'Anvil', type: 'optimize', tier: 'C', description: 'Hammers out structural flaws. Provides a vital protective shield to pipeline Stability, keeping high-risk, volatile models from collapsing.', icon: 'https://i.ibb.co/7xHb05bF/Anvil-Upd.webp', basePrice: 120, accuracyImpact: 0.00, speedImpact: 0.00, stabilityImpact: 0.35, domainLock: null },
  'enchanting_bench': { name: 'Enchanting Bench', type: 'optimize', tier: 'B', description: 'Applies stat multipliers to the model. Severely drains your remaining Cost Efficiency, but yields unpredictable, massive spikes to Accuracy.', icon: 'https://i.ibb.co/0yTnnRFv/Enchanting-Table.webp', basePrice: 250, accuracyImpact: 0.30, speedImpact: 0.00, stabilityImpact: 0.00, domainLock: null },
  'wooden_chest': { name: 'Wooden Chest', type: 'evaluate', tier: 'Basic', description: 'A tiny validation partition. Grants top-tier Time Efficiency and preserves Cost Efficiency, but caps your potential Accuracy metrics due to high variance.', icon: 'https://i.ibb.co/nqZ00QQY/Wooden-Chest.webp', basePrice: 50, accuracyImpact: -0.15, speedImpact: 0.20, stabilityImpact: 0.00, domainLock: null },
  'ender_chest': { name: 'Ender Chest', type: 'evaluate', tier: 'A', description: 'A massive validation partition. Demands a slight penalty to Time Efficiency, but completely maximizes your true Accuracy and pipeline Stability parameters.', icon: 'https://i.ibb.co/x81srCt4/Ender-Chest.webp', basePrice: 400, accuracyImpact: 0.35, speedImpact: -0.10, stabilityImpact: 0.25, domainLock: null }
};

const TOOL_OPTIONS = Object.keys(TOOL_CATALOG).map(id => ({
  id,
  name: TOOL_CATALOG[id].name,
  tier: TOOL_CATALOG[id].tier,
  type: TOOL_CATALOG[id].type
}));

const TIER_STYLES = {
  Basic: { baseBg: 'bg-[#4e5157]', border: 'border-2 border-[#2d2f33]', text: 'text-slate-350' },
  C: { baseBg: 'bg-[#9c6644]', border: 'border-2 border-[#5c3821]', text: 'text-orange-200' },
  B: { baseBg: 'bg-[#2563eb]', border: 'border-2 border-[#1e3a8a]', text: 'text-blue-200' },
  A: { baseBg: 'bg-[#dca51a]', border: 'border-2 border-[#fef08a]', text: 'text-yellow-100' }
};

export default function AdminPanel({ backendUrl = 'http://localhost:3001' }) {
  const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  // --- JOIN & PASSCODE LOBBY STATES ---
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [lobbyAction, setLobbyAction] = useState('create'); // 'create' | 'join'
  
  // --- REAL-TIME SERVER STATE ---
  const [socket, setSocket] = useState(null);
  const [activeTab, setActiveTab] = useState('commands'); // 'commands' | 'playerSimulation'
  const [spectatorGroup, setSpectatorGroup] = useState('A'); // Group preview select on simulation mode
  const [statusMessage, setStatusMessage] = useState(null);
  
  // Dynamic parameters preloaded from server state sync
  const [roomsStateSync, setRoomsStateSync] = useState({
    roomStatus: 'lobby',
    activeRound: 1,
    admins: [],
    queue: [],
    groups: {
      'A': { players: [], currentAuction: {} },
      'B': { players: [], currentAuction: {} },
      'C': { players: [], currentAuction: {} }
    }
  });

  const [toolToInject, setToolToInject] = useState('raw_gold_ore');

  // --- RESULTS & VERIFICATION STATE VARIABLES ---
  const [roomResults, setRoomResults] = useState([]);
  const [searchHash, setSearchHash] = useState('');
  const [verifiedPlayer, setVerifiedPlayer] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  const fetchResults = async () => {
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/room/${roomCode}/results`);
      if (res.ok) {
        const data = await res.json();
        setRoomResults(data.results || []);
      }
    } catch (err) {
      console.error("Error fetching results:", err);
    }
  };

  const handleVerifyHash = async (e) => {
    if (e) e.preventDefault();
    if (!searchHash.trim()) return;
    try {
      const res = await fetch(`${cleanBackendUrl}/api/admin/verify/${searchHash.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setVerifiedPlayer(data);
        setVerifyError(null);
      } else {
        const data = await res.json();
        setVerifyError(data.error || 'Verification hash not found.');
        setVerifiedPlayer(null);
      }
    } catch (err) {
      setVerifyError('Database lookup failure.');
      setVerifiedPlayer(null);
    }
  };

  // Auto-fetch results when results tab is loaded
  useEffect(() => {
    if (activeTab === 'results' && roomCode) {
      fetchResults();
    }
  }, [activeTab, roomCode]);

  // --- CONNECT SOCKETS FOR REAL-TIME SYNC ---
  const handleAdminJoin = (e) => {
    if (e) e.preventDefault();
    if (!adminName.trim() || !roomCode.trim()) return alert('Name and Room Code are required!');
    if (passcode !== 'Aloha') return alert('Incorrect passcode! hardcoded passcode is: Aloha');

    const cleanRoomCode = roomCode.toUpperCase().trim();
    const cleanName = adminName.trim();

    const newSocket = io(cleanBackendUrl);

    newSocket.on('connect', () => {
      console.log('👑 Admin Socket connected successfully');
      newSocket.emit('admin:join', {
        roomCode: cleanRoomCode,
        displayName: cleanName,
        passcode,
        action: lobbyAction
      });
    });

    newSocket.on('admin:sync', (syncData) => {
      setRoomsStateSync({
        roomStatus: syncData.roomStatus,
        activeRound: syncData.activeRound,
        admins: syncData.admins || [],
        groups: syncData.groups || {},
        queue: syncData.queue || []
      });
      setIsAdminLoggedIn(true);
    });

    newSocket.on('admin:list', (data) => {
      setRoomsStateSync(prev => ({
        ...prev,
        admins: data.admins || []
      }));
    });

    newSocket.on('error:adminJoin', (msg) => {
      alert(msg);
      newSocket.disconnect();
    });

    setSocket(newSocket);
  };

  // --- POST ACTION TRIGGERS ---
  const triggerAdminCommand = async (endpoint, payload) => {
    try {
      const res = await fetch(`${cleanBackendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const contentType = res.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { error: await res.text() };
      }

      if (res.ok) {
        setStatusMessage({ type: 'success', text: data.message || 'Action executed successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to complete action.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: `Network failure: ${err.message}` });
    }
  };

  const handleStartMatch = () => {
    if (!roomCode) return alert('Enter Room Code!');
    triggerAdminCommand('/api/admin/match/start', { roomCode });
  };

  const handleForceSkipGroup = () => {
    if (!roomCode) return alert('Enter Room Code!');
    triggerAdminCommand('/api/admin/auction/skip', { roomCode, group: spectatorGroup });
  };

  const handleInjectTool = () => {
    if (!roomCode) return alert('Enter Room Code!');
    triggerAdminCommand('/api/admin/auction/inject', { roomCode, toolId: toolToInject });
  };

  const handleModifyTimer = (action) => {
    if (!roomCode) return alert('Enter Room Code!');
    triggerAdminCommand('/api/admin/timer/modify', { roomCode, group: spectatorGroup, action });
  };

  const handleForceRoundStart = () => {
    if (!roomCode) return alert('Enter Room Code!');
    triggerAdminCommand('/api/admin/round/forcestart', { roomCode });
  };

  // Safe accessor helper for active spectator group current auction details
  const activeAuctionSim = useMemo(() => {
    const defaultAuction = { toolId: 'raw_iron_ore', basePrice: 200, currentBid: 200, leadingPlayer: null, closed: false, bids: [] };
    const groupData = roomsStateSync.groups[spectatorGroup];
    if (!groupData || !groupData.currentAuction) return defaultAuction;
    return { ...defaultAuction, ...groupData.currentAuction };
  }, [roomsStateSync, spectatorGroup]);

  const activeToolSim = useMemo(() => {
    return TOOL_CATALOG[activeAuctionSim.toolId] || TOOL_CATALOG.raw_iron_ore;
  }, [activeAuctionSim.toolId]);

  // Countdowns calculator for admin simulation screens
  const endsAtTimestamp = activeAuctionSim.endsAt;
  const [timeLeftSim, setTimeLeftSim] = useState(null);
  
  useEffect(() => {
    if (!endsAtTimestamp) {
      setTimeLeftSim(null);
      return;
    }
    const timer = setInterval(() => {
      const remaining = endsAtTimestamp - Date.now();
      if (remaining <= 0) {
        setTimeLeftSim(0);
        clearInterval(timer);
      } else {
        setTimeLeftSim(Math.ceil(remaining / 1000));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [endsAtTimestamp]);

  // --- PASSCODE / ENTRANCE LOGIN PORTAL SCREEN ---
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#1e2024] to-[#2d2f33] flex items-center justify-center p-6 text-slate-100 select-none font-sans">
        <form onSubmit={handleAdminJoin} className="max-w-md w-full bg-slate-900 border-4 border-slate-950 p-8 rounded-lg shadow-2xl space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-black font-mono tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-amber-500">
              🛡️ Lobby Host Admin
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono mt-1">Lobby & Game Command Portal</p>
          </div>

          <div className="space-y-4 font-mono text-xs text-left">
            <div>
              <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1.5">Admin Username</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Host_Arnav"
                required
                className="w-full bg-slate-950 border-2 border-slate-800 focus:border-red-500 rounded px-4 py-2.5 text-xs text-white focus:outline-none font-bold"
              />
            </div>
            
            <div>
              <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1.5">Passcode Credentials</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode (Aloha)"
                required
                className="w-full bg-slate-950 border-2 border-slate-800 focus:border-red-500 rounded px-4 py-2.5 text-xs text-white focus:outline-none font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1.5">
              <div>
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1.5">Room Code</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ARENA99"
                  required
                  className="w-full bg-slate-950 border-2 border-slate-800 focus:border-red-500 rounded px-4 py-2.5 text-xs text-white focus:outline-none font-bold uppercase tracking-widest"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1.5">Action Method</label>
                <select
                  value={lobbyAction}
                  onChange={(e) => setLobbyAction(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-slate-800 focus:border-red-500 rounded px-4 py-2.5 text-xs text-slate-350 focus:outline-none font-bold cursor-pointer"
                >
                  <option value="create">Create Room</option>
                  <option value="join">Join Room</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold uppercase rounded shadow-lg transition active:scale-95 text-center text-xs tracking-wider"
          >
            Authenticate Admin Credentials ➔
          </button>
        </form>
      </div>
    );
  }

  // --- DUAL SCREEN MAIN HOST PORTAL ---
  return (
    <div className="min-h-screen w-full flex bg-[#1c1e22] text-slate-100 font-sans overflow-hidden">
      
      {/* ==========================================
      1. CONNECTED ADMINS SIDEBAR (Left 200px)
      ========================================== */}
      <aside className="w-[200px] bg-slate-950/80 border-r-4 border-slate-850 flex flex-col shrink-0 font-mono text-[10px] p-4 gap-4 select-none">
        <div className="border-b border-slate-800 pb-2 mb-1 flex items-center gap-1.5 text-red-400 uppercase font-black tracking-widest shrink-0">
          <Shield className="w-4 h-4" />
          <span>Room Admins</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2">
          {roomsStateSync.admins.map((admin, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 text-slate-200">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="font-extrabold truncate">{admin}</span>
            </div>
          ))}
          {roomsStateSync.admins.length === 0 && (
            <span className="text-slate-600 italic">No other admins connected.</span>
          )}
        </div>
        
        <div className="bg-slate-900/50 p-2 rounded border border-slate-850 text-[9px] text-slate-500 leading-normal shrink-0">
          <span>Room Code:</span>
          <span className="font-extrabold text-yellow-500 uppercase tracking-widest block text-[11px] mt-0.5">{roomCode}</span>
        </div>
      </aside>

      {/* ==========================================
      2. CENTRAL INTERFACE WRAPPER (Flex-1)
      ========================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP INTERFACE TAB SELECTOR BAR */}
        <header className="h-14 bg-slate-900 border-b-4 border-slate-950 px-6 flex items-center justify-between shrink-0 z-30 select-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <h1 className="text-sm font-black tracking-wider uppercase font-mono bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-amber-500 leading-none">
                Lobby Host Admin Room
              </h1>
              <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 block">Real-time stateful auction controller</span>
            </div>
          </div>

          {/* DUAL VIEW BUTTON TOGGLES */}
          <div className="flex items-center bg-slate-950 p-1 border border-slate-800 rounded-md gap-1">
            <button
              onClick={() => setActiveTab('commands')}
              className={`px-4 py-1.5 text-xs font-black uppercase font-mono rounded flex items-center gap-1.5 transition-all ${
                activeTab === 'commands'
                  ? 'bg-red-900/40 text-red-400 border border-red-900/50 shadow-inner'
                  : 'text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Command Center
            </button>
            <button
              onClick={() => setActiveTab('playerSimulation')}
              className={`px-4 py-1.5 text-xs font-black uppercase font-mono rounded flex items-center gap-1.5 transition-all ${
                activeTab === 'playerSimulation'
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 shadow-inner'
                  : 'text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Player Simulation Preview
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-1.5 text-xs font-black uppercase font-mono rounded flex items-center gap-1.5 transition-all ${
                activeTab === 'results'
                  ? 'bg-yellow-950/40 text-yellow-400 border border-yellow-900/50 shadow-inner'
                  : 'text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Results & Verification
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1 font-mono text-[10px] text-slate-400 font-extrabold uppercase">
            Phase: <span className="text-yellow-500">{roomsStateSync.roomStatus}</span>
          </div>
        </header>

        {/* CONTROLLER DISPLAY AREA */}
        <div className="flex-1 overflow-auto relative">
          
          {/* ==========================================
          TAB 1: TECHNICAL COMMAND CENTER VIEW
          ========================================== */}
          {activeTab === 'commands' && (
            <div className="p-6 max-w-4xl mx-auto space-y-6">
              
              {/* Status Alert logs */}
              {statusMessage && (
                <div className={`p-3 rounded border text-xs font-mono flex items-center justify-between shadow-md ${
                  statusMessage.type === 'success' 
                    ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400' 
                    : 'bg-red-950/20 border-red-800 text-red-400'
                }`}>
                  <span>{statusMessage.type === 'success' ? '✔' : '🚨'} {statusMessage.text}</span>
                  <button onClick={() => setStatusMessage(null)} className="opacity-60 hover:opacity-100 font-black">✕</button>
                </div>
              )}

              {/* Quick Actions Global Setup */}
              <div className="bg-slate-950/30 border border-slate-800 rounded-lg p-5 grid grid-cols-3 gap-6 font-mono text-xs items-end">
                <div>
                  <label className="text-[9px] text-slate-500 font-black uppercase block mb-2 tracking-wider">Configure Lobby Target</label>
                  <div className="bg-slate-900 border-2 border-slate-800 rounded p-2 font-bold text-center text-slate-300">
                    Room: <span className="text-yellow-400 uppercase">{roomCode}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 font-black uppercase block mb-2 tracking-wider">Group Target (Commands)</label>
                  <select 
                    value={spectatorGroup}
                    onChange={(e) => setSpectatorGroup(e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-800 focus:border-red-600 rounded px-3 py-2 text-xs font-bold text-slate-350 cursor-pointer focus:outline-none"
                  >
                    <option value="A">Group A only</option>
                    <option value="B">Group B only</option>
                    <option value="C">Group C only</option>
                  </select>
                </div>
                <div>
                  <button 
                    onClick={handleStartMatch}
                    disabled={roomsStateSync.roomStatus !== 'lobby'}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold uppercase rounded shadow-lg transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-center block text-[11px]"
                  >
                    🚀 Start Match Round 1
                  </button>
                </div>
              </div>

              {/* Grid actions controls */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* Manual Timer adjustment */}
                <div className="bg-[#212429] border border-slate-800 rounded-lg p-5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-red-400 font-mono mb-3.5 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Clock className="w-4 h-4" />
                    Timer Control Manipulation
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-normal mb-4">
                    Manually adjust or reset the active bidding endsAt timers for the selected Group **{spectatorGroup}** auction room instantly.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleModifyTimer('add30')}
                      className="py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded font-bold font-mono text-[9px] uppercase tracking-wider transition-all"
                    >
                      ➕ Add 30s
                    </button>
                    <button 
                      onClick={() => handleModifyTimer('reset25')}
                      className="py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded font-bold font-mono text-[9px] uppercase tracking-wider transition-all"
                    >
                      🔄 Reset 25s
                    </button>
                  </div>
                </div>

                {/* Force skips & phase overrides */}
                <div className="bg-[#212429] border border-slate-800 rounded-lg p-5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-red-400 font-mono mb-3.5 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Forced Phase Overrides
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-normal mb-4">
                    Forcefully skip or terminate bidding inside Group **{spectatorGroup}**. The current spotlight item goes unsold, and the group prepares for building.
                  </p>
                  <button 
                    onClick={handleForceSkipGroup}
                    className="w-full py-2.5 bg-red-950/30 hover:bg-red-950/60 border border-red-900 hover:border-red-700 text-red-400 rounded font-black font-mono text-[10px] uppercase tracking-widest transition-all"
                  >
                    🚨 Force Close Group {spectatorGroup} Auction
                  </button>
                </div>

                {/* Mid-match item queues injections */}
                <div className="bg-[#212429] border border-slate-800 rounded-lg p-5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 font-mono mb-3.5 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Plus className="w-4 h-4 text-amber-500" />
                    Tool Injection Box
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-normal mb-4">
                    Inject custom tools directly into the active round’s auction queue mid-round. Players will see it queue up in their upcoming lists.
                  </p>
                  
                  <div className="flex gap-2 font-mono">
                    <select 
                      value={toolToInject}
                      onChange={(e) => setToolToInject(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-[10px] text-slate-350 focus:outline-none cursor-pointer"
                    >
                      {TOOL_OPTIONS.map((tool) => (
                        <option key={tool.id} value={tool.id} className="bg-slate-950 text-slate-200">
                          [{tool.tier}] {tool.name}
                        </option>
                      ))}
                    </select>
                    <button 
                      onClick={handleInjectTool}
                      className="px-4 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 rounded font-extrabold uppercase text-[9px] tracking-wider transition-all shrink-0"
                    >
                      Inject Tool
                    </button>
                  </div>
                </div>

                {/* Round Force updates */}
                <div className="bg-[#212429] border border-slate-800 rounded-lg p-5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 font-mono mb-3.5 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <FastForward className="w-4 h-4 text-amber-500" />
                    Global Round Overrides
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-normal mb-4">
                    Force-start next round parameters if players get stuck or if round transitions are delayed manually.
                  </p>
                  
                  <button 
                    onClick={handleForceRoundStart}
                    className="w-full py-2 bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-500 hover:to-amber-600 text-white rounded font-extrabold uppercase text-[10px] tracking-widest transition-all font-mono"
                  >
                    ⚡ Force Start Next Round
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* ==========================================
          TAB 2: MINECRAFT-THEMED PLAYER SIMULATION PREVIEW
          ========================================== */}
          {activeTab === 'playerSimulation' && (
            <div className="h-full w-full flex flex-col bg-[#5a5e65] overflow-hidden text-slate-100">
              
              {/* top selector for simulation group preview channels */}
              <div className="h-11 bg-slate-950/40 border-b-2 border-slate-800 px-6 flex items-center justify-between shrink-0 select-none font-mono">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase">Previewing Live Bidding:</span>
                
                <div className="flex gap-2">
                  {['A', 'B', 'C'].map((gKey) => (
                    <button
                      key={gKey}
                      onClick={() => setSpectatorGroup(gKey)}
                      className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all border ${
                        spectatorGroup === gKey
                          ? 'bg-[#dca51a] border-[#fef08a] text-yellow-950 shadow-[0_0_6px_rgba(234,179,8,0.3)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Group {gKey} Auction
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic simulated Auction Panel view matching player schema */}
              <div className="flex-1 bg-[#1e2024] p-4 flex gap-4 overflow-hidden relative">
                
                {/* 1. LEFT PANEL: SPOTLIGHT (Minecraft styled) */}
                <aside className="w-[25vw] bg-slate-900/40 border-2 border-slate-950 rounded-lg p-4 flex flex-col justify-between shadow-lg relative overflow-y-auto font-sans">
                  <div className="flex justify-between items-center z-10 shrink-0">
                    <span className="bg-amber-950/80 text-yellow-400 border border-yellow-700/50 text-[8.5px] px-2.5 py-0.5 rounded font-black tracking-widest uppercase">
                      🔥 Spotlight Tool
                    </span>
                  </div>

                  <div className="flex flex-col items-center my-2 shrink-0">
                    <div className="w-24 h-24 bg-[#4e5157]/20 border-2 border-slate-800 rounded-lg flex items-center justify-center p-2 relative shadow-inner overflow-hidden">
                      <img 
                        src={activeToolSim.icon} 
                        alt={activeToolSim.name} 
                        className="w-[80%] h-[80%] object-contain select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] animate-pulse" 
                      />
                    </div>
                    <h2 className="text-sm font-black tracking-wide text-slate-100 mt-2 text-center uppercase">{activeToolSim.name}</h2>
                    <span className="text-[8px] bg-slate-800/80 border border-slate-700/50 text-slate-400 px-2 py-0.5 rounded font-extrabold uppercase mt-1">
                      {activeToolSim.type} | Tier {activeToolSim.tier}
                    </span>
                  </div>

                  <div className="bg-slate-950/25 border border-slate-800/50 rounded p-2.5 text-[10px] leading-relaxed text-slate-350 shrink-0">
                    <span className="text-[7.5px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">Impact Description:</span>
                    {activeToolSim.description}
                  </div>

                  {/* Dynamic impact badges */}
                  <div className="grid grid-cols-3 gap-1.5 text-center mt-2.5 font-mono text-[9px] shrink-0">
                    <div className="bg-slate-950/30 border border-slate-800 rounded p-1">
                      <span className="text-slate-500 block text-[6px] uppercase font-bold">Accuracy</span>
                      <span className="text-[#3b82f6] font-black block mt-0.5">
                        {activeToolSim.accuracyImpact > 0 ? `+${activeToolSim.accuracyImpact}` : activeToolSim.accuracyImpact}
                      </span>
                    </div>
                    <div className="bg-slate-950/30 border border-slate-800 rounded p-1">
                      <span className="text-slate-500 block text-[6px] uppercase font-bold">Speed</span>
                      <span className="text-[#ef4444] font-black block mt-0.5">
                        {activeToolSim.speedImpact > 0 ? `+${activeToolSim.speedImpact}` : activeToolSim.speedImpact}
                      </span>
                    </div>
                    <div className="bg-slate-950/30 border border-slate-800 rounded p-1">
                      <span className="text-slate-500 block text-[6px] uppercase font-bold">Stability</span>
                      <span className="text-purple-400 font-black block mt-0.5">
                        {activeToolSim.stabilityImpact > 0 ? `+${activeToolSim.stabilityImpact}` : activeToolSim.stabilityImpact}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] shrink-0 font-mono">
                    <span className="text-slate-400 font-bold uppercase">Opening Bid:</span>
                    <span className="font-extrabold text-emerald-400">💎 {activeAuctionSim.basePrice} EMERALDS</span>
                  </div>
                </aside>

                {/* 2. CENTER PANEL: LIVE TIMER & PRICE (Minecraft styled) */}
                <main className="flex-1 bg-slate-900/40 border-2 border-slate-950 rounded-lg p-6 flex flex-col justify-between shadow-2xl relative font-sans">
                  
                  <div className="absolute top-4 left-4 z-10 font-mono">
                    {activeAuctionSim.leadingPlayer ? (
                      <span className="bg-amber-950/80 text-[#dca51a] border border-[#fef08a]/35 text-[9px] px-3 py-1 rounded-full font-black tracking-widest uppercase">
                        👑 Leading: {activeAuctionSim.leadingPlayer.displayName}
                      </span>
                    ) : (
                      <span className="bg-slate-950/80 text-slate-400 border border-slate-800/50 text-[9px] px-3 py-1 rounded-full font-black tracking-widest uppercase">
                        No bids placed yet
                      </span>
                    )}
                  </div>

                  {/* Timer Clocks widget */}
                  <div className="flex flex-col items-center mt-12 shrink-0">
                    {timeLeftSim !== null ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">Time Remaining</span>
                        <span className={`text-4xl font-black font-mono tracking-tight mt-1 transition-all ${
                          timeLeftSim <= 10 ? 'text-red-500 scale-105 animate-pulse' : 'text-slate-100'
                        }`}>
                          00:{timeLeftSim < 10 ? `0${timeLeftSim}` : timeLeftSim}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-2 animate-pulse font-mono">
                        <span className="text-[9px] text-slate-400 font-extrabold tracking-widest uppercase bg-slate-950/60 border border-slate-800 px-3.5 py-1.5 rounded-md">
                          ⏳ Waiting for first bid...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bid Price Display */}
                  <div className="text-center my-6 flex flex-col items-center shrink-0">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest font-mono block">Current Bid Price</span>
                    <div className="text-5xl font-black font-mono tracking-tight text-[#dca51a] mt-1.5 flex items-center gap-2">
                      <span className="text-2xl text-yellow-600">💎</span>
                      {activeAuctionSim.currentBid}
                    </div>
                  </div>

                  {/* History feed */}
                  <div className="flex-1 mt-4 border-t border-slate-800/80 pt-3 flex flex-col overflow-hidden min-h-[140px]">
                    <span className="text-[8px] text-slate-500 font-extrabold uppercase tracking-wide block mb-1.5 font-mono">Group Bidding History</span>
                    
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-mono text-[9px]">
                      {activeAuctionSim.bids && activeAuctionSim.bids.length > 0 ? (
                        activeAuctionSim.bids.map((bid, i) => (
                          <div 
                            key={i} 
                            className="flex items-center justify-between p-1.5 rounded border bg-slate-950/20 border-slate-850 text-slate-300"
                          >
                            <span className="truncate max-w-[120px] font-bold">{bid.displayName}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-emerald-400">💎 {bid.amount}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-600 italic text-[9px] py-4 text-center">
                          <span>💬 Waiting for bid events history...</span>
                        </div>
                      )}
                    </div>
                  </div>

                </main>

                {/* 3. RIGHT PANEL: ROUNDS QUEUE (Minecraft styled) */}
                <aside className="w-[25vw] bg-slate-900/40 border-2 border-slate-950 rounded-lg p-4 flex flex-col justify-between shadow-lg relative overflow-y-auto font-mono text-[10px]">
                  
                  {/* Round info */}
                  <div className="bg-slate-950/80 border border-slate-800 p-3 rounded text-center shrink-0">
                    <span className="text-[8px] text-emerald-400 font-black uppercase tracking-widest block leading-none">Simulation Room View</span>
                    <div className="text-base font-black text-slate-200 mt-1 tracking-wide uppercase">
                      Group {spectatorGroup} Channels
                    </div>
                  </div>

                  {/* Queue queue details */}
                  <div className="flex-1 my-4 border-t border-slate-800/60 pt-3 flex flex-col overflow-hidden">
                    <span className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-wide block mb-2">Round Tool Queue</span>
                    
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1 text-[8.5px]">
                      {roomsStateSync.queue.map((item, idx) => {
                        const toolDetails = TOOL_CATALOG[item];
                        const isCurrent = item === activeAuctionSim.toolId;

                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                              isCurrent 
                                ? 'bg-yellow-950/30 border-yellow-750 text-yellow-200 font-bold'
                                : 'bg-slate-950/15 border-slate-850 text-slate-500 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 flex items-center justify-center bg-slate-950/40 rounded border border-slate-850/40 p-0.5 shrink-0">
                                <img src={toolDetails?.icon} className="w-full h-full object-contain" />
                              </div>
                              <span className="truncate max-w-[100px] font-bold">{toolDetails?.name || item}</span>
                            </div>

                            <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              isCurrent
                                ? 'bg-yellow-900/40 border border-yellow-800 text-yellow-350'
                                : 'bg-slate-800 border border-slate-700 text-slate-500'
                            }`}>
                              {isCurrent ? '🔨 Active' : '⬜ Queued'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-slate-950/30 border border-slate-800 rounded p-2 text-[8px] space-y-0.5 leading-normal shrink-0 text-left font-sans">
                    <div className="flex justify-between font-bold border-b border-slate-800 pb-1 mb-1 font-mono text-[8.5px]">
                      <span className="text-slate-400 uppercase">Room Details</span>
                      <span className="text-yellow-400 uppercase font-bold">Round {roomsStateSync.activeRound} / 3</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block font-mono">Spectator Focus:</span>
                      <span className="text-slate-200">You are spectating player dashboards inside Group {spectatorGroup}. Actions run will affect this group.</span>
                    </div>
                  </div>
                </aside>

              </div>

            </div>
          )}

          {/* ==========================================
          TAB 3: RESULTS & HASH VERIFICATION
          ========================================== */}
          {activeTab === 'results' && (
            <div className="p-6 max-w-5xl mx-auto space-y-6">
              
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 font-mono">
                <div>
                  <h2 className="text-lg font-black tracking-wider text-yellow-400 uppercase flex items-center gap-2">
                    🏆 Room Results & Verification Logs
                  </h2>
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide mt-0.5">
                    Search and validate player completion hashes using MongoDB
                  </p>
                </div>
                <button
                  onClick={fetchResults}
                  className="px-4 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 rounded font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 transition active:scale-95 text-slate-100"
                >
                  <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                  Refresh Results
                </button>
              </div>

              {/* Grid with Results & Hash Verification searcher */}
              <div className="grid grid-cols-3 gap-6 items-start font-mono text-xs">
                
                {/* 1. Results List (Left 2 cols) */}
                <div className="col-span-2 bg-[#212429] border border-slate-800 rounded-lg p-5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-200 border-b border-slate-850 pb-2">
                    📊 Leaderboard Results ({roomResults.length} registered)
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] leading-relaxed border-collapse select-text">
                      <thead>
                        <tr className="text-slate-500 uppercase font-black border-b border-slate-800 text-[8.5px]">
                          <th className="py-2 pr-2">Rank</th>
                          <th className="py-2 px-2">Nickname</th>
                          <th className="py-2 px-2">Enrollment</th>
                          <th className="py-2 px-2">Grp</th>
                          <th className="py-2 px-2 text-center">Score</th>
                          <th className="py-2 px-2 text-center">Time</th>
                          <th className="py-2 px-2">Verification Code</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {roomResults.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/35 text-slate-300">
                            <td className="py-2 pr-2 font-bold text-yellow-500">{idx + 1}</td>
                            <td className="py-2 px-2 font-bold text-white truncate max-w-[80px]">{p.displayName}</td>
                            <td className="py-2 px-2 font-semibold text-slate-350">{p.enrollmentId}</td>
                            <td className="py-2 px-2"><span className="bg-slate-950/40 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400 text-[8px] font-black">{p.group}</span></td>
                            <td className="py-2 px-2 text-center font-black text-emerald-400">{p.score}</td>
                            <td className="py-2 px-2 text-center font-extrabold text-sky-400">{p.totalTimeSpent}s</td>
                            <td className="py-2 px-2 text-yellow-300 font-bold select-all bg-slate-950/15 font-mono px-2 py-0.5 rounded text-[9px] truncate max-w-[90px]">{p.verificationHash || 'ROUND IN PROGRESS'}</td>
                          </tr>
                        ))}
                        {roomResults.length === 0 && (
                          <tr>
                            <td colSpan="7" className="py-6 text-center text-slate-500 italic uppercase">
                              No players found in this room yet. Enter lobby to start!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Verification lookup searcher (Right 1 col) */}
                <div className="bg-[#212429] border border-slate-800 rounded-lg p-5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-200 border-b border-slate-850 pb-2">
                    🔍 Authenticator Lookup
                  </h3>
                  
                  <form onSubmit={handleVerifyHash} className="space-y-3">
                    <label className="text-[8.5px] text-slate-500 font-black uppercase block tracking-wider">Type Verification Hash</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchHash}
                        onChange={(e) => setSearchHash(e.target.value.toUpperCase())}
                        placeholder="8-DIGIT HEX CODE"
                        maxLength={8}
                        className="flex-1 bg-slate-950 border-2 border-slate-800 focus:border-yellow-500 rounded px-3 py-1.5 text-xs text-white focus:outline-none uppercase font-bold tracking-widest text-center"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 active:scale-95 text-slate-950 font-black rounded uppercase text-[9px] tracking-wider transition-all"
                      >
                        Verify
                      </button>
                    </div>
                  </form>

                  {verifyError && (
                    <div className="p-3 bg-red-950/20 border border-red-900 rounded text-red-400 text-[10px] text-center uppercase font-bold leading-relaxed">
                      🚨 {verifyError}
                    </div>
                  )}

                  {verifiedPlayer && (
                    <div className="p-4 bg-emerald-950/25 border-2 border-emerald-800/80 rounded-lg text-slate-300 space-y-3 relative overflow-hidden shadow-inner text-left font-sans">
                      <div className="absolute top-2 right-2 text-emerald-500 font-black text-[7px] border border-emerald-800 px-1.5 rounded uppercase tracking-wider">
                        ✔ VALID
                      </div>
                      <div className="border-b border-emerald-900 pb-2">
                        <span className="text-[7.5px] text-slate-500 uppercase font-black tracking-wide block">Student Name</span>
                        <span className="text-sm font-bold text-white">{verifiedPlayer.displayName}</span>
                        <span className="text-[8.5px] text-slate-400 block font-semibold">Enrollment: {verifiedPlayer.enrollmentId}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-[9px]">
                        <div className="bg-slate-950/30 p-1.5 rounded border border-slate-850">
                          <span className="text-slate-500 block text-[6.5px] uppercase font-bold font-mono">Flow Score</span>
                          <span className="text-emerald-400 font-black text-[11px] block mt-0.5 font-mono">{verifiedPlayer.score}</span>
                        </div>
                        <div className="bg-slate-950/30 p-1.5 rounded border border-slate-850">
                          <span className="text-slate-500 block text-[6.5px] uppercase font-bold font-mono">Total Time</span>
                          <span className="text-sky-400 font-black text-[11px] block mt-0.5 font-mono">{verifiedPlayer.totalTimeSpent}s</span>
                        </div>
                      </div>
                      <div className="text-[7.5px] text-slate-500 font-semibold border-t border-emerald-900/60 pt-2 font-mono">
                        <span className="block">Room: {verifiedPlayer.roomCode} | Group {verifiedPlayer.group}</span>
                        <span className="block mt-0.5">Verified At: {verifiedPlayer.hashGeneratedAt ? new Date(verifiedPlayer.hashGeneratedAt).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
