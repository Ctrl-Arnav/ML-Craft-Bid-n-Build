import { TOOLS } from '../data/tools';

// Quest objectives mapping to domain identifiers
export const QUEST_DOMAINS = {
  text: { fieldName: 'NLP / Text Sequences', toolId: 'axe_blueprint', emoji: '🪓' },
  visual: { fieldName: 'Computer Vision / Grid Matrices', toolId: 'pickaxe_blueprint', emoji: '⛏️' },
  anomaly: { fieldName: 'Anomaly Detection', toolId: 'sword_blueprint', emoji: '⚔️' },
  timeseries: { fieldName: 'Time-Series Forecasting', toolId: 'shovel_blueprint', emoji: '🪵' }
};

/**
 * Calculates metrics and final 1000-point score for the active grid layout.
 * Matches C-Suite standalone specs.
 */
export function calculateGridScore(activePipeline, problem) {
  let baseAccuracy = 0.05;
  let baseSpeed = 0.50;
  let baseStability = 0.40;

  let accModifiers = 0;
  let speedModifiers = 0;
  let stabilityModifiers = 0;
  let totalCost = 0;

  let firstDataset = null;
  let cleanerPresent = null;
  let activeBlueprint = null;
  let modelPresent = null;
  let hasGpu = false;
  let optimizerPresent = null;
  let evaluatorPresent = null;

  activePipeline.forEach((slot, index) => {
    const tool = TOOLS.find(t => t.id === slot.id);
    if (!tool) return;

    totalCost += tool.cost;

    if (index === 0 && tool.type === 'dataset') {
      firstDataset = tool;
    } else if (tool.type === 'process') {
      cleanerPresent = tool;
    } else if (tool.type === 'domain') {
      activeBlueprint = tool;
    } else if (tool.type === 'model') {
      modelPresent = tool;
    } else if (tool.type === 'hardware') {
      hasGpu = true;
    } else if (tool.type === 'optimize') {
      optimizerPresent = tool;
    } else if (tool.type === 'evaluate') {
      evaluatorPresent = tool;
    }
  });

  if (firstDataset) {
    baseAccuracy = firstDataset.accuracyImpact;
    baseStability = firstDataset.stabilityImpact;
    speedModifiers += firstDataset.speedImpact;
  }

  if (cleanerPresent) {
    if (firstDataset && (firstDataset.id === 'raw_iron_ore' || firstDataset.id === 'raw_gold_ore')) {
      stabilityModifiers += Math.abs(firstDataset.stabilityImpact) + cleanerPresent.stabilityImpact;
    } else {
      stabilityModifiers += cleanerPresent.stabilityImpact;
    }
    speedModifiers += cleanerPresent.speedImpact;
  }

  if (modelPresent) {
    accModifiers += modelPresent.accuracyImpact;
    stabilityModifiers += modelPresent.stabilityImpact;
    speedModifiers += modelPresent.speedImpact;
  }

  if (hasGpu) {
    speedModifiers += 0.60;
    if (firstDataset && firstDataset.speedImpact < 0) speedModifiers += Math.abs(firstDataset.speedImpact);
    if (cleanerPresent && cleanerPresent.speedImpact < 0) speedModifiers += Math.abs(cleanerPresent.speedImpact);
    if (evaluatorPresent && evaluatorPresent.speedImpact < 0) speedModifiers += Math.abs(evaluatorPresent.speedImpact);
  }

  if (optimizerPresent) {
    accModifiers += optimizerPresent.accuracyImpact;
    stabilityModifiers += optimizerPresent.stabilityImpact;
    speedModifiers += optimizerPresent.speedImpact;

    // Explicit optimizer boosts (Anvil & Enchanting Bench)
    if (optimizerPresent.id === 'anvil_restructurer') {
      accModifiers += 0.15;
      speedModifiers += 0.15;
    } else if (optimizerPresent.id === 'enchanting_bench') {
      accModifiers += 0.25;
      speedModifiers += 0.10;
    }
  }

  if (evaluatorPresent) {
    accModifiers += evaluatorPresent.accuracyImpact;
    stabilityModifiers += evaluatorPresent.stabilityImpact;
    speedModifiers += evaluatorPresent.speedImpact;
  }

  let accumulatedAccuracy = baseAccuracy + accModifiers;

  // Spotlight check on blueprint
  if (activeBlueprint && problem && problem.spotlightTools && problem.spotlightTools.includes(activeBlueprint.id)) {
    accModifiers += activeBlueprint.accuracyImpact * (problem.spotlightBonus || 0.20);
  }

  // Domain Blueprint Multiplier logic
  if (activeBlueprint && problem) {
    const isMatched = activeBlueprint.domainLock === problem.domain;
    if (isMatched) {
      accumulatedAccuracy = accumulatedAccuracy * 1.2;
    } else {
      if (activeBlueprint.id === 'axe_blueprint') {
        accumulatedAccuracy -= 0.20;
      } else if (activeBlueprint.id === 'pickaxe_blueprint') {
        speedModifiers -= 0.10;
      } else if (activeBlueprint.id === 'sword_blueprint') {
        accumulatedAccuracy -= 0.15;
      } else if (activeBlueprint.id === 'shovel_blueprint') {
        stabilityModifiers -= 0.15;
      }
    }
  }

  const hasAutoCrafter = activePipeline.some(s => s.id === 'auto_crafter_block');
  const hasRedstoneBlock = activePipeline.some(s => s.id === 'redstone_compute_block');

  const accuracy = Math.min(0.99, Math.max(0.0, accumulatedAccuracy));
  const speed = (hasAutoCrafter && hasRedstoneBlock) ? 1.0 : Math.min(1.0, Math.max(0.0, baseSpeed + speedModifiers));
  const stability = Math.min(1.0, Math.max(0.0, baseStability + stabilityModifiers));
  const costEfficiency = Math.min(1.0, Math.max(0.0, (1000 - totalCost) / 1000));

  const toolCount = activePipeline.length;
  let toolCountScore = 0.0;
  if (toolCount >= 5 && toolCount <= 8) {
    toolCountScore = 1.0;
  } else if (toolCount > 0) {
    toolCountScore = Math.max(0.0, 1.0 - Math.abs(toolCount - 6) / 6.0);
  }

  let weights = { accuracy: 50, speed: 20, stability: 20, toolCount: 10 };
  if (problem) {
    if (problem.priority === 'accuracy') {
      weights = { accuracy: 65, speed: 10, stability: 15, toolCount: 10 };
    } else if (problem.priority === 'speed') {
      weights = { accuracy: 30, speed: 35, stability: 20, toolCount: 15 };
    }
  }

  let totalScoreRaw = ((accuracy * weights.accuracy) + 
                      (speed * weights.speed) + 
                      (stability * weights.stability) + 
                      (toolCountScore * weights.toolCount)) * (100 / (weights.accuracy + weights.speed + weights.stability + weights.toolCount));

  if (problem && problem.priority === 'cost') {
    totalScoreRaw = (accuracy * 35) + (speed * 15) + (stability * 15) + (costEfficiency * 25) + (toolCountScore * 10);
  }

  const totalScore = Math.round(totalScoreRaw * 10);

  const domainMismatches = [];
  activePipeline.forEach(slot => {
    const tool = TOOLS.find(t => t.id === slot.id);
    if (tool && tool.type === 'domain' && problem && tool.domainLock !== problem.domain) {
      domainMismatches.push({
        gridIndex: slot.gridIndex,
        toolId: tool.id,
        toolName: tool.name,
        lockedDomain: tool.domainLock
      });
    }
  });

  return {
    accuracy,
    speed,
    stability,
    costEfficiency,
    toolCountScore,
    totalScore,
    spentBudget: totalCost,
    weights,
    domainMismatches
  };
}

/**
 * Validates the 6-slot sequential pipeline layout constraints.
 */
export function validateGridPipeline(activePipeline) {
  const errors = [];
  const toolCount = activePipeline.length;

  if (toolCount === 0) {
    errors.push('No blocks placed. Drag items onto the grass grid to begin.');
    return errors;
  }

  const resolveTool = (id) => TOOLS.find(t => t.id === id);

  const datasets = activePipeline.filter(s => resolveTool(s.id)?.type === 'dataset');
  const cleaners = activePipeline.filter(s => resolveTool(s.id)?.type === 'process');
  const blueprints = activePipeline.filter(s => resolveTool(s.id)?.type === 'domain');
  const models = activePipeline.filter(s => resolveTool(s.id)?.type === 'model');
  const hardwares = activePipeline.filter(s => resolveTool(s.id)?.type === 'hardware');
  const optimizers = activePipeline.filter(s => resolveTool(s.id)?.type === 'optimize');
  const evaluators = activePipeline.filter(s => resolveTool(s.id)?.type === 'evaluate');

  // Rule 1: Slot 1 Dataset
  const firstSlot = activePipeline[0];
  const firstTool = resolveTool(firstSlot.id);
  if (!firstTool || firstTool.type !== 'dataset') {
    errors.push('Slot 1 Violation: The pipeline must start with a Dataset block (Cobblestone, Raw Iron, Raw Gold, or Diamond).');
  }

  // Rule 2: Cleaner block condition
  if (firstTool && firstTool.type === 'dataset') {
    const isNoisy = firstTool.id === 'raw_iron_ore' || firstTool.id === 'raw_gold_ore';
    const isClean = firstTool.id === 'cobblestone_sample' || firstTool.id === 'diamond_matrix_ore';

    if (isNoisy) {
      const secondSlot = activePipeline[1];
      const secondTool = secondSlot ? resolveTool(secondSlot.id) : null;
      if (!secondTool || secondTool.type !== 'process') {
        errors.push(`Slot 2 Violation: '${firstTool.name}' is a noisy unstructured dataset and strictly requires a Cleaner (Standard Furnace or Blast Furnace) directly in the next slot to restore Stability.`);
      }
      if (cleaners.length > 1) {
        errors.push('Duplicate Cleaners: Only one Cleaner block is allowed in a pipeline.');
      }
    }

    if (isClean) {
      if (cleaners.length > 0) {
        errors.push(`Invalid Cleaner: '${firstTool.name}' is already clean. A Furnace Cleaner is not required and cannot be placed here.`);
      }
    }
  }

  // Rule 3: Domain Blueprint block
  if (blueprints.length === 0) {
    errors.push('Slot 3 Violation: Missing required block: Domain Blueprint (Axe, Pickaxe, Sword, or Shovel).');
  } else if (blueprints.length > 1) {
    errors.push('Duplicate Blueprints: You can only have one active Domain Blueprint in a pipeline.');
  } else {
    const hasCleaner = firstTool && (firstTool.id === 'raw_iron_ore' || firstTool.id === 'raw_gold_ore');
    const expectedBlueprintIndex = hasCleaner ? 2 : 1;
    const actualBlueprintIndex = activePipeline.findIndex(s => resolveTool(s.id)?.type === 'domain');
    
    if (actualBlueprintIndex !== expectedBlueprintIndex) {
      errors.push(`Sequence Violation: Domain Blueprint must be placed exactly in Slot ${expectedBlueprintIndex + 1} (after the ${hasCleaner ? 'Cleaner' : 'Dataset'}).`);
    }
  }

  // Rule 4: Model Architecture block
  if (models.length === 0) {
    errors.push('Slot 4 Violation: Missing required block: Model Architecture (Standard Crafting Table or Auto-Crafter).');
  } else if (models.length > 1) {
    errors.push('Duplicate Models: Only one active Model Architecture block is allowed.');
  } else {
    const hasCleaner = firstTool && (firstTool.id === 'raw_iron_ore' || firstTool.id === 'raw_gold_ore');
    const expectedModelIndex = hasCleaner ? 3 : 2;
    const actualModelIndex = activePipeline.findIndex(s => resolveTool(s.id)?.type === 'model');

    if (actualModelIndex !== expectedModelIndex) {
      errors.push(`Sequence Violation: Model Engine must be placed exactly in Slot ${expectedModelIndex + 1} (after the Domain Blueprint).`);
    }
  }

  // Rule 5: Redstone Hardware Plugin requirements
  if (hardwares.length > 0) {
    const hasAutoCrafter = models.some(s => s.id === 'auto_crafter_block');
    if (!hasAutoCrafter) {
      errors.push('Hardware Plugin Violation: Redstone Compute Block requires an Auto-Crafter Block! It cannot be attached to a Standard Crafting Table.');
    }
    if (hardwares.length > 1) {
      errors.push('Duplicate Hardware: Only one Redstone Compute Block is allowed in the pipeline.');
    }
  }

  // Rule 6: Optional Optimizer block
  if (optimizers.length > 1) {
    errors.push('Duplicate Optimizers: Only one active Optimizer block is allowed (Anvil or Enchanting Table).');
  }

  // Rule 7: Model Evaluator block
  if (evaluators.length === 0) {
    errors.push('Slot 6 Violation: Missing required block: Model Evaluator (Wooden Chest or Ender Chest).');
  } else if (evaluators.length > 1) {
    errors.push('Duplicate Evaluators: Only one active Evaluator Chest is allowed.');
  } else {
    const lastSlot = activePipeline[toolCount - 1];
    const lastTool = resolveTool(lastSlot.id);
    
    if (lastTool && lastTool.type === 'hardware') {
      const secondLastSlot = activePipeline[toolCount - 2];
      const secondLastTool = secondLastSlot ? resolveTool(secondLastSlot.id) : null;
      if (!secondLastTool || secondLastTool.type !== 'evaluate') {
        errors.push('Slot 6 Violation: The pipeline must end with a Model Evaluator Chest (Wooden Chest or Ender Chest).');
      }
    } else {
      if (!lastTool || lastTool.type !== 'evaluate') {
        errors.push('Slot 6 Violation: The pipeline must end with a Model Evaluator Chest (Wooden Chest or Ender Chest).');
      }
    }
  }

  // General block count
  if (toolCount < 4) {
    errors.push('Too few elements: A valid data flow pipeline must contain at least 4 active blocks.');
  } else if (toolCount > 8) {
    errors.push(`Too many elements: Pipeline contains ${toolCount} blocks, exceeding the 17-tool layout maximum of 8 blocks.`);
  }

  return errors;
}
