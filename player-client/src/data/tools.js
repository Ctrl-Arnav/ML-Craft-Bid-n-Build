// Single source of truth for all tools in AI Pipeline Arena (17-Tool Edition)
export const TYPE_COLORS = {
  dataset: '#CD7F32',       // Peach-bronze for datasets
  process: '#9CA3AF',       // Stone grey for cleaners
  domain: '#06B6D4',        // Cyan for domain tools
  model: '#78350F',         // Plank brown for models
  optimize: '#8B5CF6',      // Purple for optimizers
  hardware: '#EF4444',      // Iron red for redstone hardware
  evaluate: '#F97316'       // Orange for evaluators
};

export const getToolColor = (tool) => {
  return TYPE_COLORS[tool.type] || '#9CA3AF';
};

export const TOOLS = [
  // ==========================================
  // SLOT 1: DATA INPUTS (Datasets)
  // ==========================================
  {
    id: 'cobblestone_sample',
    name: 'Cobblestone',
    type: 'dataset',
    tier: 'Basic',
    cost: 0,
    accuracyImpact: 0.15,
    speedImpact: 0.00,
    stabilityImpact: 0.40,
    shortDesc: 'Small Structured Dataset: Clean, tabular sample.',
    description: 'Clean, tabular sample. Maximizes Stability upfront with 0% impurity, but heavily limits your final Accuracy ceiling due to its tiny size.',
    icon: 'https://i.ibb.co/Ng0XtyR6/Cobblestone.webp',
    prereq: 'None',
    imageSize: 160
  },
  {
    id: 'raw_iron_ore',
    name: 'Raw Iron Ore',
    type: 'dataset',
    tier: 'C',
    cost: 200,
    accuracyImpact: 0.25,
    speedImpact: 0.00,
    stabilityImpact: -0.25,
    shortDesc: 'Small Unstructured Dataset: Noisy, raw data.',
    description: 'Noisy, raw data. Unlocks higher Accuracy potential than Cobblestone, but heavily drains baseline Stability unless routed through a cleaning block.',
    icon: 'https://i.ibb.co/v4z6VRBz/Raw-Iron.webp',
    prereq: 'None',
    imageSize: 160
  },
  {
    id: 'raw_gold_ore',
    name: 'Raw Gold Ore',
    type: 'dataset',
    tier: 'B',
    cost: 350,
    accuracyImpact: 0.45,
    speedImpact: -0.10,
    stabilityImpact: -0.45,
    shortDesc: 'Large Unstructured Dataset: Massive raw files.',
    description: 'Massive raw files. Drastically raises your maximum Accuracy cap, but severely crashes pipeline Stability and slightly lowers Time Efficiency.',
    icon: 'https://i.ibb.co/nJk8ktS/Raw-Gold.webp',
    prereq: 'None',
    imageSize: 256
  },
  {
    id: 'diamond_matrix_ore',
    name: 'Diamond Ore',
    type: 'dataset',
    tier: 'A',
    cost: 700,
    accuracyImpact: 0.70,
    speedImpact: -0.30,
    stabilityImpact: 0.35,
    shortDesc: 'Massive Structured Dataset: Organized feature matrix.',
    description: 'High-dimensional, organized feature matrix. Skyrockets Accuracy and preserves Stability, but its sheer volume inflicts a massive hit to Time Efficiency.',
    icon: 'https://i.ibb.co/PZdV5y1Z/Diamond-Ore.webp',
    prereq: 'None',
    imageSize: 256
  },

  // ==========================================
  // SLOT 2: CLEANERS
  // ==========================================
  {
    id: 'standard_furnace',
    name: 'Furnace',
    type: 'process',
    tier: 'C',
    cost: 100,
    accuracyImpact: 0.00,
    speedImpact: -0.10,
    stabilityImpact: 0.30,
    shortDesc: 'Basic Data Cleaner: Purges noise and outliers.',
    description: 'Purges noise, missing values, and outliers. Restores lost Stability points from raw input ores, but introduces a minor processing delay to Time Efficiency.',
    icon: 'https://i.ibb.co/pjcMwnNQ/Furnace.webp',
    prereq: 'Raw Iron or Raw Gold',
    imageSize: 160
  },
  {
    id: 'high_speed_blast_furnace',
    name: 'Fast Blast Furnace',
    type: 'process',
    tier: 'B',
    cost: 300,
    accuracyImpact: 0.00,
    speedImpact: 0.20,
    stabilityImpact: 0.45,
    shortDesc: 'Advanced Data Purger: strips anomalies, normalizes.',
    description: 'Pre-processes, strips anomalies, and normalizes features. Maximizes Stability gains and provides a massive, high-speed boost to Time Efficiency.',
    icon: 'https://i.ibb.co/hRCvy83H/Blast-Furnace.webp',
    prereq: 'Raw Iron or Raw Gold',
    imageSize: 256
  },

  // ==========================================
  // SLOT 3: DOMAIN BLUEPRINTS
  // ==========================================
  {
    id: 'axe_blueprint',
    name: 'Axe Blueprint',
    type: 'domain',
    tier: 'Basic',
    cost: 150,
    accuracyImpact: 0.00,
    speedImpact: 0.00,
    stabilityImpact: 0.00,
    shortDesc: 'Natural Language Processing (NLP): designed for text.',
    description: 'Designed to parse text sequences. Triggers a massive multiplier on Accuracy if matched with a Text problem; otherwise, it degrades your score.',
    icon: 'https://i.ibb.co/MxQ0RB2x/axe.webp',
    prereq: 'Any Ore',
    domainLock: 'text',
    imageSize: 160
  },
  {
    id: 'pickaxe_blueprint',
    name: 'Pickaxe Blueprint',
    type: 'domain',
    tier: 'Basic',
    cost: 150,
    accuracyImpact: 0.00,
    speedImpact: -0.05,
    stabilityImpact: 0.00,
    shortDesc: 'Computer Vision (CV): breaks down multi-dimensional grids.',
    description: 'Built to break down multi-dimensional grids. Yields an explosive Accuracy surge for Image tasks, but slightly penalizes your pipeline\'s Time Efficiency.',
    icon: 'https://i.ibb.co/hjG83Fs/pickaxe.webp',
    prereq: 'Any Ore',
    domainLock: 'visual',
    imageSize: 160
  },
  {
    id: 'sword_blueprint',
    name: 'Sword Blueprint',
    type: 'domain',
    tier: 'Basic',
    cost: 150,
    accuracyImpact: 0.00,
    speedImpact: 0.15,
    stabilityImpact: 0.00,
    shortDesc: 'Anomaly Detector: designed to spot sharp deviations.',
    description: 'Designed to spot sharp deviations. Maximizes Accuracy on Fraud/Irregularity problems while maintaining high baseline Time Efficiency.',
    icon: 'https://i.ibb.co/PsnJBLRm/sword.webp',
    prereq: 'Any Ore',
    domainLock: 'anomaly',
    imageSize: 160
  },
  {
    id: 'shovel_blueprint',
    name: 'Shovel Blueprint',
    type: 'domain',
    tier: 'Basic',
    cost: 150,
    accuracyImpact: 0.00,
    speedImpact: 0.00,
    stabilityImpact: 0.00,
    shortDesc: 'Time-Series Forecaster: tracks continuous data trends.',
    description: 'Tracks continuous data trends over chronological paths. Guarantees a significant Accuracy bonus on forecasting tasks with zero penalty to Stability.',
    icon: 'https://i.ibb.co/m5PzJw1G/shovel.webp',
    prereq: 'Any Ore',
    domainLock: 'timeseries',
    imageSize: 160
  },

  // ==========================================
  // SLOT 4: MODEL ENGINE ARCHITECTURES
  // ==========================================
  {
    id: 'standard_crafting_table',
    name: 'Crafting Table',
    type: 'model',
    tier: 'Basic',
    cost: 200,
    accuracyImpact: 0.15,
    speedImpact: 0.00,
    stabilityImpact: 0.20,
    shortDesc: 'Random Forest Ensemble: robust baseline framework.',
    description: 'Combines components into a robust tool framework. Offers highly reliable, safe baseline gains to both Accuracy and Stability across all domains.',
    icon: 'https://i.ibb.co/mC5s4qCh/Crafting-Table.webp',
    prereq: 'Any Blueprint',
    imageSize: 160
  },
  {
    id: 'auto_crafter_block',
    name: 'Auto-Crafter',
    type: 'model',
    tier: 'B',
    cost: 450,
    accuracyImpact: 0.30,
    speedImpact: 0.00,
    stabilityImpact: 0.35,
    shortDesc: 'Automated ML (AutoML) Ensemble: optimizes internally.',
    description: 'Automatically optimizes weights internally. Greatly increases both Accuracy and Stability, though it asks a higher trade-off in Cost Efficiency.',
    icon: 'https://i.ibb.co/Ld9mXmPX/Auto-Crafter.webp',
    prereq: 'Any Blueprint',
    imageSize: 256
  },
  {
    id: 'redstone_compute_block',
    name: 'Redstone Block',
    type: 'hardware',
    tier: 'A',
    cost: 500,
    accuracyImpact: 0.00,
    speedImpact: 0.40,
    stabilityImpact: 0.00,
    shortDesc: 'Hardware GPU Accelerator: erases all speed delays.',
    description: 'Acts as an external plugin for the model. Put it beside Auto-Crafter to skyrocket Efficiency to maximum levels.',
    icon: 'https://i.ibb.co/tTbqYb0d/Redstone.webp',
    prereq: 'Auto-Crafter',
    imageSize: 256
  },

  // ==========================================
  // SLOT 5: OPTIONAL OPTIMIZERS
  // ==========================================
  {
    id: 'anvil_restructurer',
    name: 'Anvil',
    type: 'optimize',
    tier: 'C',
    cost: 120,
    accuracyImpact: 0.00,
    speedImpact: 0.00,
    stabilityImpact: 0.35,
    shortDesc: 'Model Regularizer: hammers out structural flaws.',
    description: 'Hammers out structural flaws. Provides a vital protective shield to pipeline Stability, keeping high-risk, volatile models from collapsing.',
    icon: 'https://i.ibb.co/7xHb05bF/Anvil-Upd.webp',
    prereq: 'Crafting Table or Auto-Crafter',
    imageSize: 160
  },
  {
    id: 'enchanting_bench',
    name: 'Enchanting Bench',
    type: 'optimize',
    tier: 'B',
    cost: 250,
    accuracyImpact: 0.30,
    speedImpact: 0.00,
    stabilityImpact: 0.00,
    shortDesc: 'Hyperparameter Tuner: applies massive Accuracy spikes.',
    description: 'Applies stat multipliers to the model. Severely drains your remaining Cost Efficiency, but yields unpredictable, massive spikes to Accuracy.',
    icon: 'https://i.ibb.co/0yTnnRFv/Enchanting-Table.webp',
    prereq: 'Crafting Table or Auto-Crafter',
    imageSize: 256
  },

  // ==========================================
  // SLOT 6: MODEL EVALUATORS (Chests)
  // ==========================================
  {
    id: 'wooden_chest',
    name: 'Wooden Chest',
    type: 'evaluate',
    tier: 'Basic',
    cost: 50,
    accuracyImpact: -0.15,
    speedImpact: 0.10,
    stabilityImpact: 0.00,
    shortDesc: 'Small Test Set: tiny validation partition.',
    description: 'A tiny validation partition. Grants top-tier Time Efficiency and preserves Cost Efficiency, but caps your potential Accuracy metrics due to high variance.',
    icon: 'https://i.ibb.co/nqZ00QQY/Wooden-Chest.webp',
    prereq: 'Crafting Table or Auto-Crafter',
    imageSize: 160
  },
  {
    id: 'ender_chest',
    name: 'Ender Chest',
    type: 'evaluate',
    tier: 'A',
    cost: 400,
    accuracyImpact: 0.35,
    speedImpact: -0.10,
    stabilityImpact: 0.25,
    shortDesc: 'Large Test Set: cross-validation partition.',
    description: 'A massive validation partition. Demands a slight penalty to Time Efficiency, but completely maximizes your true Accuracy and pipeline Stability parameters.',
    icon: 'https://i.ibb.co/x81srCt4/Ender-Chest.webp',
    prereq: 'Crafting Table or Auto-Crafter',
    imageSize: 256
  }
];
