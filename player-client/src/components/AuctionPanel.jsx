import React, { useState, useEffect, useMemo } from 'react';

// Tool catalog to parse details client-side
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

export default function AuctionPanel({ socket, playerProfile, activeQuest, onOutbid, onAuctionClosed }) {
  // --- STATE ---
  const [currentToolId, setCurrentToolId] = useState('raw_iron_ore'); // active auction item
  const [basePrice, setBasePrice] = useState(200);
  const [currentBid, setCurrentBid] = useState(200);
  const [leadingPlayer, setLeadingPlayer] = useState(null); // { playerId, displayName }
  const [endsAt, setEndsAt] = useState(null); // Timestamp endsAt
  const [timeLeft, setTimeLeft] = useState(null); // Local countdown calculated in ms
  const [bidAmountInput, setBidAmountInput] = useState('');
  const [bidHistory, setBidHistory] = useState([]); // group-scoped bids list
  const [auctionQueue, setAuctionQueue] = useState([]); // Tools list for this round
  const [wonToolsThisRound, setWonToolsThisRound] = useState([]); // Items won
  const [outbidToast, setOutbidToast] = useState(null); // Outbid alert msg
  const [showCelebration, setShowCelebration] = useState(false); // Celebratory overlay
  const [soldMessage, setSoldMessage] = useState(null); // Announcement panel

  const activeTool = useMemo(() => TOOL_CATALOG[currentToolId] || TOOL_CATALOG.raw_iron_ore, [currentToolId]);
  const isPlayerLeading = leadingPlayer?.playerId === playerProfile.playerId;

  // --- TIMER EFFECT (500ms Local Ticks) ---
  useEffect(() => {
    if (!endsAt) {
      setTimeLeft(null);
      return;
    }

    const timer = setInterval(() => {
      const remaining = endsAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(timer);
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
      }
    }, 200);

    return () => clearInterval(timer);
  }, [endsAt]);

  // --- WEBSOCKET REAL-TIME SOCKET HANDLERS ---
  useEffect(() => {
    if (!socket) return;

    // A. Sync initial auction status
    socket.on('auction:sync', (state) => {
      setCurrentToolId(state.toolId);
      setBasePrice(state.basePrice);
      setCurrentBid(state.currentBid);
      setLeadingPlayer(state.leadingPlayer);
      setEndsAt(state.endsAt);
      setBidHistory(state.bids || []);
      setAuctionQueue(state.queue || []);
      setSoldMessage(null);
      setShowCelebration(false);
    });

    // B. Live Bid updates
    socket.on('auction:bidUpdate', (data) => {
      setCurrentBid(data.currentBid);
      setLeadingPlayer(data.leadingPlayer);
      setEndsAt(data.endsAt);
      setBidHistory(data.bids || []);
      setSoldMessage(null);

      // Reset outbid warnings if player takes lead
      if (data.leadingPlayer?.playerId === playerProfile.playerId) {
        setOutbidToast(null);
      }
    });

    // C. Outbid notification trigger
    socket.on('auction:outbid', (data) => {
      // Show outbid warning toast
      setOutbidToast(data.message);
      // Trigger outbid alert sound/UX callback
      if (onOutbid) onOutbid(data.message);
      // Auto-fill bid input to min raise
      setBidAmountInput(data.currentBid + 100);

      // Clear toast after 3s
      setTimeout(() => setOutbidToast(null), 3000);
    });

    // D. Item Sold closure
    socket.on('auction:sold', (data) => {
      setEndsAt(null);
      setTimeLeft(null);
      
      const isWinner = data.winner === playerProfile.displayName;
      if (isWinner) {
        setShowCelebration(true);
        setWonToolsThisRound(prev => [...prev, data.toolId]);
      } else {
        setSoldMessage(`Sold to ${data.winner} for 💎${data.price}`);
      }

      // Sync player balance locally
      playerProfile.emeraldBalance = data.emeraldBalance;

      // Close notification and prep next tool after 3s
      setTimeout(() => {
        setShowCelebration(false);
        setSoldMessage(null);
      }, 3000);
    });

    // E. Unsold item closure
    socket.on('auction:unsold', (data) => {
      setEndsAt(null);
      setTimeLeft(null);
      setSoldMessage(`Tool '${TOOL_CATALOG[data.toolId]?.name}' went unsold.`);
      
      setTimeout(() => {
        setSoldMessage(null);
      }, 3000);
    });

    return () => {
      socket.off('auction:sync');
      socket.off('auction:bidUpdate');
      socket.off('auction:outbid');
      socket.off('auction:sold');
      socket.off('auction:unsold');
    };
  }, [socket, playerProfile, onOutbid]);

  // --- SUBMIT BID PROCESS ---
  const handlePlaceBid = (e) => {
    if (e) e.preventDefault();
    const bidAmount = parseInt(bidAmountInput, 10);

    // UX validation safeguards
    if (isNaN(bidAmount)) return;
    if (bidAmount < basePrice) return alert(`Bid must be at least the base price of 💎${basePrice}`);
    if (leadingPlayer && bidAmount < currentBid + 100) return alert(`Min raise increment is 100 Emeralds! Minimum bid: 💎${currentBid + 100}`);
    if (bidAmount > playerProfile.emeraldBalance) return alert(`Insufficient Emerald budget balance!`);

    socket.emit('auction:bid', { amount: bidAmount });
    setBidAmountInput('');
  };

  // --- QUICK BID VALUES SHORTCUTS ---
  const handleQuickBid = (modifier) => {
    let nextBid = leadingPlayer ? currentBid + 100 : basePrice;
    if (modifier === '+100') nextBid = currentBid + 100;
    else if (modifier === '+300') nextBid = currentBid + 300;
    else if (modifier === 'half') nextBid = Math.floor(playerProfile.emeraldBalance / 2);
    else if (modifier === 'all') nextBid = playerProfile.emeraldBalance;

    // Bound check
    if (nextBid > playerProfile.emeraldBalance) nextBid = playerProfile.emeraldBalance;
    if (nextBid < basePrice) nextBid = basePrice;

    setBidAmountInput(nextBid);
  };

  return (
    <div className="h-full w-full flex bg-[#1e2024] font-sans relative overflow-hidden select-none text-slate-100 p-4 gap-4">
      
      {/* ==========================================
      LEFT PANEL — TOOL SPOTLIGHT (25vw)
      ========================================== */}
      <aside className="w-[25vw] bg-slate-900/40 border-2 border-slate-950 rounded-lg p-4 flex flex-col justify-between shadow-lg relative overflow-y-auto">
        
        {/* Spotlight & Domain Lock Badge indicators */}
        <div className="flex justify-between items-center z-10">
          {activeQuest.spotlightTools?.includes(currentToolId) && (
            <span className="bg-amber-950/80 text-yellow-400 border border-yellow-700/50 text-[8.5px] px-2.5 py-0.5 rounded font-black tracking-widest uppercase">
              🔥 Spotlight Tool
            </span>
          )}
          {activeTool.domainLock && activeTool.domainLock !== activeQuest.domain && (
            <span className="bg-red-950/80 text-red-400 border border-red-800/50 text-[8px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
              ⚠ Mismatch Warning
            </span>
          )}
        </div>

        {/* Large Tool Icon Base Card */}
        <div className="flex flex-col items-center my-4">
          <div className="w-32 h-32 bg-[#4e5157]/20 border-2 border-slate-800 rounded-lg flex items-center justify-center p-3 relative shadow-inner overflow-hidden">
            <img 
              src={activeTool.icon} 
              alt={activeTool.name} 
              className="w-[80%] h-[80%] object-contain select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" 
            />
          </div>
          <h2 className="text-lg font-black tracking-wide text-slate-100 mt-3 text-center uppercase">{activeTool.name}</h2>
          <span className="text-[9px] bg-slate-800/80 border border-slate-700/50 text-slate-400 px-2 py-0.5 rounded font-extrabold uppercase mt-1">
            {activeTool.type} | Tier {activeTool.tier}
          </span>
        </div>

        {/* Description Section */}
        <div className="bg-slate-950/25 border border-slate-800/50 rounded-lg p-3 text-xs leading-relaxed text-slate-300">
          <span className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-wide block mb-1">Impact Description:</span>
          {activeTool.description}
        </div>

        {/* Dynamic Metric impacts card slots */}
        <div className="grid grid-cols-3 gap-1.5 text-center mt-3 font-mono text-[9px]">
          <div className="bg-slate-950/30 border border-slate-800 rounded p-1.5">
            <span className="text-slate-500 block text-[6.5px] uppercase font-bold">Accuracy</span>
            <span className="text-[#3b82f6] font-black block mt-0.5">
              {activeTool.accuracyImpact > 0 ? `+${activeTool.accuracyImpact}` : activeTool.accuracyImpact}
            </span>
          </div>
          <div className="bg-slate-950/30 border border-slate-800 rounded p-1.5">
            <span className="text-slate-500 block text-[6.5px] uppercase font-bold">Speed</span>
            <span className="text-[#ef4444] font-black block mt-0.5">
              {activeTool.speedImpact > 0 ? `+${activeTool.speedImpact}` : activeTool.speedImpact}
            </span>
          </div>
          <div className="bg-slate-950/30 border border-slate-800 rounded p-1.5">
            <span className="text-slate-500 block text-[6.5px] uppercase font-bold">Stability</span>
            <span className="text-purple-400 font-black block mt-0.5">
              {activeTool.stabilityImpact > 0 ? `+${activeTool.stabilityImpact}` : activeTool.stabilityImpact}
            </span>
          </div>
        </div>

        {/* Tool price floor */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs shrink-0 font-mono">
          <span className="text-slate-400 font-bold uppercase">Opening Bid:</span>
          <span className="font-extrabold text-emerald-400">💎 {basePrice} EMERALDS</span>
        </div>
      </aside>

      {/* ==========================================
      CENTER PANEL — BIDDING ARENA (50vw)
      ========================================== */}
      <main className="flex-1 bg-slate-900/40 border-2 border-slate-950 rounded-lg p-6 flex flex-col justify-between shadow-2xl relative">
        
        {/* Leading State indicators */}
        <div className="absolute top-4 left-4 z-10">
          {isPlayerLeading ? (
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[9px] px-3 py-1 rounded-full font-black tracking-widest uppercase flex items-center gap-1.5 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              You are leading
            </span>
          ) : leadingPlayer ? (
            <span className="bg-red-950/80 text-red-400 border border-red-800/50 text-[9px] px-3 py-1 rounded-full font-black tracking-widest uppercase flex items-center gap-1.5">
              Outbid! {leadingPlayer.displayName} is leading
            </span>
          ) : (
            <span className="bg-slate-950/80 text-slate-400 border border-slate-800/50 text-[9px] px-3 py-1 rounded-full font-black tracking-widest uppercase">
              No bids placed yet
            </span>
          )}
        </div>

        {/* Live Timer Clock widget */}
        <div className="flex flex-col items-center mt-12 shrink-0">
          {timeLeft !== null ? (
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">Time Remaining</span>
              <span className={`text-5xl font-black font-mono tracking-tight mt-1 transition-all ${
                timeLeft <= 10 ? 'text-red-500 scale-105 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse' : 'text-slate-100'
              }`}>
                00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center animate-pulse py-2">
              <span className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase font-mono bg-slate-950/60 border border-slate-800 px-4 py-1.5 rounded-md">
                ⏳ Waiting for first bid to start timer
              </span>
            </div>
          )}
        </div>

        {/* Live Bidding Amount Box */}
        <div className="text-center my-6 flex flex-col items-center shrink-0">
          <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest font-mono block">Current Bid Price</span>
          <div className="text-6xl font-black font-mono tracking-tight text-[#dca51a] drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] mt-1.5 flex items-center gap-2">
            <span className="text-3xl text-yellow-600">💎</span>
            {currentBid}
          </div>
        </div>

        {/* Outbid Warning alert banner toast */}
        {outbidToast && (
          <div className="absolute top-4 right-4 bg-red-950/90 text-red-200 border-2 border-red-800 rounded-md p-3 max-w-[280px] shadow-2xl z-30 flex items-start gap-2.5 animate-bounce font-mono text-[10px]">
            <span>🚨</span>
            <div>
              <span className="font-extrabold block uppercase">Outbid Notice!</span>
              {outbidToast}
            </div>
          </div>
        )}

        {/* Sold Celebratory HUD Overlay */}
        {showCelebration && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center z-40 text-center font-mono animate-fade-in p-6">
            <span className="text-6xl animate-bounce">🏆</span>
            <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-widest mt-4">CONGRATULATIONS!</h2>
            <p className="text-xs text-emerald-200 mt-2 max-w-sm">
              You won the bid for **{activeTool.name}** for **💎{currentBid} Emeralds**! The item has been unlocked in your Builder shelf.
            </p>
          </div>
        )}

        {/* Sold to other player announcement panel */}
        {soldMessage && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center z-40 text-center font-mono p-6">
            <span className="text-5xl">🔨</span>
            <h2 className="text-xl font-black text-yellow-400 uppercase tracking-wide mt-4">AUCTION CLOSED</h2>
            <p className="text-sm text-slate-300 mt-1 font-bold">{soldMessage}</p>
          </div>
        )}

        {/* Action input panel */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-4 flex flex-col gap-3 shrink-0">
          <form onSubmit={handlePlaceBid} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs font-mono">💎</span>
              <input 
                type="number"
                value={bidAmountInput}
                onChange={(e) => setBidAmountInput(e.target.value)}
                placeholder={leadingPlayer ? `Enter min: ${currentBid + 100}` : `Enter min: ${basePrice}`}
                disabled={playerProfile.emeraldBalance < (leadingPlayer ? currentBid + 100 : basePrice)}
                className="w-full bg-slate-900 border-2 border-slate-800 focus:border-yellow-600 rounded px-8 py-2.5 text-xs text-white font-mono font-bold focus:outline-none transition-colors disabled:opacity-30 disabled:pointer-events-none"
              />
            </div>
            <button 
              type="submit"
              disabled={isPlayerLeading || playerProfile.emeraldBalance < (leadingPlayer ? currentBid + 100 : basePrice)}
              className="px-6 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-extrabold text-xs uppercase rounded transition-all shadow-[0_2px_8px_rgba(234,179,8,0.2)] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              Raise Bid
            </button>
          </form>

          {/* Quick Raise buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            <button 
              onClick={() => handleQuickBid('+100')} 
              disabled={playerProfile.emeraldBalance < (currentBid + 100)}
              className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-bold font-mono text-[9px] uppercase tracking-wider transition-all"
            >
              + 100
            </button>
            <button 
              onClick={() => handleQuickBid('+300')} 
              disabled={playerProfile.emeraldBalance < (currentBid + 300)}
              className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-bold font-mono text-[9px] uppercase tracking-wider transition-all"
            >
              + 300
            </button>
            <button 
              onClick={() => handleQuickBid('half')}
              disabled={playerProfile.emeraldBalance < Math.floor(playerProfile.emeraldBalance / 2)}
              className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-bold font-mono text-[9px] uppercase tracking-wider transition-all"
            >
              1/2 Budget
            </button>
            <button 
              onClick={() => handleQuickBid('all')}
              className="py-1.5 bg-red-950/30 hover:bg-red-950/60 border border-red-900/60 hover:border-red-900 text-red-400 rounded font-black font-mono text-[9px] uppercase tracking-widest transition-all"
            >
              All In!
            </button>
          </div>
        </div>

        {/* ==========================================
        BID HISTORY FEED (Section 7)
        ========================================== */}
        <div className="flex-1 mt-4 border-t border-slate-800/80 pt-3 flex flex-col overflow-hidden min-h-[140px]">
          <span className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-wide block mb-2 font-mono">Bidding Activity History</span>
          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 font-mono text-[9.5px]">
            {bidHistory.length > 0 ? (
              bidHistory.map((bid, i) => (
                <div 
                  key={i} 
                  className={`flex items-center justify-between p-2 rounded border transition-colors ${
                    bid.displayName === playerProfile.displayName 
                      ? 'bg-yellow-950/20 border-yellow-800/40 text-yellow-300 font-bold' 
                      : 'bg-slate-950/25 border-slate-800/40 text-slate-300'
                  }`}
                >
                  <span className="truncate max-w-[150px]">{bid.displayName === playerProfile.displayName ? '▶ You' : bid.displayName}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold">💎 {bid.amount}</span>
                    <span className="text-[7.5px] text-slate-500 font-normal shrink-0">{bid.timeAgo || 'just now'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-[10px] py-4">
                <span>💬 No active bids in this room. Place a raise above floor to begin.</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ==========================================
      RIGHT PANEL — YOUR STATUS (25vw)
      ========================================== */}
      <aside className="w-[25vw] bg-slate-900/40 border-2 border-slate-950 rounded-lg p-4 flex flex-col justify-between shadow-lg relative overflow-y-auto font-mono text-[10px]">
        
        {/* Dynamic Emerald Balance box */}
        <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-lg text-center shadow-inner relative overflow-hidden shrink-0">
          <img src="https://i.ibb.co/k2GP6hYZ/Emerald.webp" class="w-24 h-24 absolute -right-6 -bottom-6 opacity-5 pointer-events-none" />
          <span className="text-[8px] text-emerald-400 font-black uppercase tracking-widest block leading-none">Your Remaining Budget</span>
          <div className="text-2xl font-black text-emerald-300 mt-1.5 tracking-wide flex items-center justify-center gap-1.5">
            💎 {playerProfile.emeraldBalance}
          </div>
        </div>

        {/* Current round queue status */}
        <div className="flex-1 my-4 border-t border-slate-800/60 pt-3 flex flex-col overflow-hidden">
          <span className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-wide block mb-2">Round Queue ({auctionQueue.length} Tools)</span>
          <div className="flex-1 overflow-y-auto pr-1 space-y-1">
            {auctionQueue.map((item, idx) => {
              const toolDetails = TOOL_CATALOG[item];
              const isCurrent = item === currentToolId;
              const isWon = wonToolsThisRound.includes(item);

              return (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between p-2 rounded border transition-all text-[8.5px] ${
                    isCurrent 
                      ? 'bg-yellow-950/30 border-yellow-700/60 text-yellow-200 font-bold scale-[1.01] shadow-[inset_0_0_6px_rgba(234,179,8,0.15)] pulsing-glow'
                      : isWon
                        ? 'bg-emerald-950/25 border-emerald-800/50 text-emerald-300'
                        : 'bg-slate-950/15 border-slate-800/40 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 flex items-center justify-center bg-slate-950/40 rounded border border-slate-800/40 p-0.5">
                      <img src={toolDetails?.icon} className="w-full h-full object-contain" />
                    </div>
                    <span className="truncate max-w-[120px] font-bold">{toolDetails?.name || item}</span>
                  </div>

                  <span className={`text-[7.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    isCurrent
                      ? 'bg-yellow-900/40 border border-yellow-800 text-yellow-300'
                      : isWon
                        ? 'bg-emerald-900/30 border border-emerald-800 text-emerald-400'
                        : 'bg-slate-800 border border-slate-700 text-slate-500'
                  }`}>
                    {isCurrent ? '🔨 Active' : isWon ? '✅ Won' : '⬜ Upcoming'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Won tools overview */}
        <div className="h-[25%] border-t border-slate-800/60 pt-3 flex flex-col overflow-hidden shrink-0 mb-3">
          <span className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-wide block mb-1.5">Acquired items round</span>
          <div className="flex-1 overflow-y-auto pr-1 flex flex-wrap gap-1.5 items-start content-start">
            {wonToolsThisRound.length > 0 ? (
              wonToolsThisRound.map((toolId, i) => (
                <div key={i} className="flex items-center gap-1 bg-emerald-950/20 border border-emerald-800/40 px-2 py-1 rounded text-[8px] text-emerald-300 font-bold hover:brightness-115 transition" title={TOOL_CATALOG[toolId]?.name}>
                  <img src={TOOL_CATALOG[toolId]?.icon} className="w-3.5 h-3.5 object-contain" />
                  <span>{TOOL_CATALOG[toolId]?.name}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-[8.5px] py-2 w-full text-center">
                <span>No tools won this round yet.</span>
              </div>
            )}
          </div>
        </div>

        {/* Active round & Quest information details */}
        <div className="bg-slate-950/30 border border-slate-800/80 rounded-lg p-2.5 shrink-0 text-[8px] space-y-1 leading-normal font-sans">
          <div className="flex justify-between font-bold border-b border-slate-800/50 pb-1 mb-1 font-mono text-[8.5px]">
            <span className="text-slate-400 uppercase">Match Info</span>
            <span className="text-yellow-400 uppercase">Round {playerProfile.activeRound || 1} of 3</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block">Quest Objective:</span>
            <span className="text-slate-200 font-bold">{activeQuest.name}</span>
          </div>
          <div className="pt-0.5">
            <span className="text-slate-400 font-bold block">Spotlight Tools ({activeQuest.spotlightTools?.length || 0}):</span>
            <span className="text-yellow-400 font-semibold">{activeQuest.spotlightTools?.map(id => TOOL_CATALOG[id]?.name).join(', ')}</span>
          </div>
        </div>
      </aside>

    </div>
  );
}
