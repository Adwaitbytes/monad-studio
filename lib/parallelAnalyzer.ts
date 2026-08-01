/**
 * Parallel Execution Analyzer for Monad
 *
 * Analyzes Solidity contracts to identify parallel execution potential
 * on Monad's 10,000 TPS parallel EVM.
 *
 * Key Analysis:
 * 1. Storage slot dependency mapping
 * 2. Read/Write conflict detection
 * 3. Parallelization score calculation
 * 4. Optimization suggestions
 */

// Types for analysis results
export interface StorageAccess {
  slot: string;
  variable: string;
  type: 'read' | 'write';
  function: string;
  line: number;
}

export interface StateConflict {
  slot: string;
  variable: string;
  functions: string[];
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface FunctionAnalysis {
  name: string;
  visibility: string;
  reads: string[];
  writes: string[];
  canParallelize: boolean;
  conflictsWith: string[];
}

export interface OptimizationSuggestion {
  type: 'storage_packing' | 'batch_operation' | 'state_separation' | 'mapping_optimization' | 'event_optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentCode?: string;
  suggestedCode?: string;
  gasImpact: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'read_after_write' | 'write_after_read' | 'write_after_write';
  slot: string;
}

export interface ParallelAnalysisResult {
  score: number; // 0-100 parallelization score
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalFunctions: number;
  parallelizableFunctions: number;
  storageSlots: Map<string, StorageAccess[]>;
  conflicts: StateConflict[];
  functions: FunctionAnalysis[];
  suggestions: OptimizationSuggestion[];
  dependencyGraph: {
    nodes: { id: string; type: 'function' | 'storage'; label: string; parallelizable: boolean }[];
    edges: DependencyEdge[];
  };
  summary: string;
}

/**
 * Main analysis function - analyzes Solidity contract for parallel execution potential
 */
export function analyzeParallelPotential(sourceCode: string): ParallelAnalysisResult {
  // Extract contract information
  const functions = extractFunctions(sourceCode);
  const stateVariables = extractStateVariables(sourceCode);

  // Analyze storage access patterns
  const storageAccess = analyzeStorageAccess(sourceCode, functions, stateVariables);

  // Detect conflicts
  const conflicts = detectConflicts(storageAccess, functions);

  // Analyze each function
  const functionAnalysis = analyzeFunctions(functions, storageAccess, conflicts);

  // Calculate parallelization score
  const { score, grade } = calculateScore(functionAnalysis, conflicts);

  // Generate optimization suggestions
  const suggestions = generateSuggestions(sourceCode, conflicts, functionAnalysis, stateVariables);

  // Build dependency graph
  const dependencyGraph = buildDependencyGraph(functionAnalysis, storageAccess);

  // Count parallelizable functions
  const parallelizableFunctions = functionAnalysis.filter(f => f.canParallelize).length;

  // Generate summary
  const summary = generateSummary(score, grade, parallelizableFunctions, functions.length, conflicts.length);

  return {
    score,
    grade,
    totalFunctions: functions.length,
    parallelizableFunctions,
    storageSlots: new Map(Object.entries(storageAccess)),
    conflicts,
    functions: functionAnalysis,
    suggestions,
    dependencyGraph,
    summary
  };
}

/**
 * Extract all function definitions
 */
function extractFunctions(sourceCode: string): { name: string; visibility: string; body: string; line: number }[] {
  const functions: { name: string; visibility: string; body: string; line: number }[] = [];

  // Match function definitions
  const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*(public|external|internal|private)?\s*[^{]*\{/g;
  let match;

  while ((match = functionRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    const visibility = match[2] || 'public';
    const startIndex = match.index;

    // Calculate line number
    const line = sourceCode.substring(0, startIndex).split('\n').length;

    // Extract function body (simplified - matches balanced braces)
    const bodyStart = sourceCode.indexOf('{', startIndex);
    let braceCount = 1;
    let bodyEnd = bodyStart + 1;

    while (braceCount > 0 && bodyEnd < sourceCode.length) {
      if (sourceCode[bodyEnd] === '{') braceCount++;
      if (sourceCode[bodyEnd] === '}') braceCount--;
      bodyEnd++;
    }

    const body = sourceCode.substring(bodyStart, bodyEnd);

    functions.push({ name, visibility, body, line });
  }

  // Also check for constructor
  const constructorMatch = sourceCode.match(/constructor\s*\([^)]*\)\s*[^{]*\{/);
  if (constructorMatch) {
    const startIndex = constructorMatch.index!;
    const line = sourceCode.substring(0, startIndex).split('\n').length;
    const bodyStart = sourceCode.indexOf('{', startIndex);
    let braceCount = 1;
    let bodyEnd = bodyStart + 1;

    while (braceCount > 0 && bodyEnd < sourceCode.length) {
      if (sourceCode[bodyEnd] === '{') braceCount++;
      if (sourceCode[bodyEnd] === '}') braceCount--;
      bodyEnd++;
    }

    functions.push({
      name: 'constructor',
      visibility: 'public',
      body: sourceCode.substring(bodyStart, bodyEnd),
      line
    });
  }

  return functions;
}

/**
 * Extract state variables
 */
function extractStateVariables(sourceCode: string): { name: string; type: string; slot: number }[] {
  const variables: { name: string; type: string; slot: number }[] = [];

  let slotIndex = 0;

  // Find the contract body
  const contractStart = sourceCode.indexOf('{');
  const contractBody = sourceCode.substring(contractStart);

  // Split by lines and look for state variables
  const lines = contractBody.split('\n');

  for (const line of lines) {
    // Skip function definitions
    if (line.includes('function ') || line.includes('constructor')) continue;

    // Match various state variable patterns
    const patterns = [
      /^\s*(uint\d*|int\d*|address|bool|bytes\d*|string)\s+(public|private|internal|constant)?\s*(\w+)/,
      /^\s*mapping\s*\([^)]+\)\s+(public|private|internal)?\s*(\w+)/,
      /^\s*(\w+)\[\]\s+(public|private|internal)?\s*(\w+)/,  // arrays
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const type = match[1];
        const name = match[3] || match[2];
        if (name && !['public', 'private', 'internal', 'constant'].includes(name)) {
          variables.push({ name, type, slot: slotIndex++ });
        }
      }
    }
  }

  return variables;
}

/**
 * Analyze storage access patterns in functions
 */
function analyzeStorageAccess(
  sourceCode: string,
  functions: { name: string; visibility: string; body: string; line: number }[],
  stateVariables: { name: string; type: string; slot: number }[]
): Record<string, StorageAccess[]> {
  const access: Record<string, StorageAccess[]> = {};

  for (const variable of stateVariables) {
    access[variable.name] = [];
  }

  for (const func of functions) {
    for (const variable of stateVariables) {
      // Check for reads (variable used in expressions, not on left of assignment)
      const readPattern = new RegExp(`[^=]\\s*${variable.name}\\s*[^=]|return\\s+${variable.name}|${variable.name}\\[`, 'g');
      if (readPattern.test(func.body)) {
        access[variable.name].push({
          slot: `slot_${variable.slot}`,
          variable: variable.name,
          type: 'read',
          function: func.name,
          line: func.line
        });
      }

      // Check for writes (variable on left of assignment)
      const writePattern = new RegExp(`${variable.name}\\s*=|${variable.name}\\[[^\\]]+\\]\\s*=|${variable.name}\\s*\\+=|${variable.name}\\s*-=`, 'g');
      if (writePattern.test(func.body)) {
        access[variable.name].push({
          slot: `slot_${variable.slot}`,
          variable: variable.name,
          type: 'write',
          function: func.name,
          line: func.line
        });
      }
    }
  }

  return access;
}

/**
 * Detect state conflicts between functions
 */
function detectConflicts(
  storageAccess: Record<string, StorageAccess[]>,
  _functions: { name: string; visibility: string; body: string; line: number }[]
): StateConflict[] {
  const conflicts: StateConflict[] = [];

  for (const [variable, accesses] of Object.entries(storageAccess)) {
    // Find all functions that write to this variable
    const writers = accesses.filter(a => a.type === 'write').map(a => a.function);
    // Find all functions that read from this variable
    const readers = accesses.filter(a => a.type === 'read').map(a => a.function);

    const uniqueWriters = [...new Set(writers)];
    const uniqueReaders = [...new Set(readers)];

    // Conflict: Multiple functions write to same storage
    if (uniqueWriters.length > 1) {
      conflicts.push({
        slot: accesses[0]?.slot || 'unknown',
        variable,
        functions: uniqueWriters,
        severity: 'high',
        description: `Multiple functions (${uniqueWriters.join(', ')}) write to '${variable}'. These cannot execute in parallel.`
      });
    }

    // Conflict: Read-Write dependency
    for (const writer of uniqueWriters) {
      const otherReaders = uniqueReaders.filter(r => r !== writer);
      if (otherReaders.length > 0) {
        conflicts.push({
          slot: accesses[0]?.slot || 'unknown',
          variable,
          functions: [writer, ...otherReaders],
          severity: 'medium',
          description: `Function '${writer}' writes to '${variable}' which is read by ${otherReaders.join(', ')}. Order-dependent execution required.`
        });
      }
    }
  }

  return conflicts;
}

/**
 * Analyze individual functions for parallelization potential
 */
function analyzeFunctions(
  functions: { name: string; visibility: string; body: string; line: number }[],
  storageAccess: Record<string, StorageAccess[]>,
  conflicts: StateConflict[]
): FunctionAnalysis[] {
  return functions.map(func => {
    const reads: string[] = [];
    const writes: string[] = [];

    for (const [variable, accesses] of Object.entries(storageAccess)) {
      const funcAccesses = accesses.filter(a => a.function === func.name);
      if (funcAccesses.some(a => a.type === 'read')) reads.push(variable);
      if (funcAccesses.some(a => a.type === 'write')) writes.push(variable);
    }

    // Find conflicting functions
    const conflictsWith: string[] = [];
    for (const conflict of conflicts) {
      if (conflict.functions.includes(func.name)) {
        for (const f of conflict.functions) {
          if (f !== func.name && !conflictsWith.includes(f)) {
            conflictsWith.push(f);
          }
        }
      }
    }

    // A function can parallelize if it has no high-severity conflicts
    const hasHighConflict = conflicts.some(
      c => c.severity === 'high' && c.functions.includes(func.name)
    );

    return {
      name: func.name,
      visibility: func.visibility,
      reads,
      writes,
      canParallelize: !hasHighConflict && writes.length === 0,
      conflictsWith
    };
  });
}

/**
 * Calculate parallelization score
 */
function calculateScore(
  functions: FunctionAnalysis[],
  conflicts: StateConflict[]
): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' } {
  if (functions.length === 0) {
    return { score: 100, grade: 'A' };
  }

  // Base score starts at 100
  let score = 100;

  // Deduct for conflicts
  const highConflicts = conflicts.filter(c => c.severity === 'high').length;
  const mediumConflicts = conflicts.filter(c => c.severity === 'medium').length;
  const lowConflicts = conflicts.filter(c => c.severity === 'low').length;

  score -= highConflicts * 15;
  score -= mediumConflicts * 8;
  score -= lowConflicts * 3;

  // Bonus for parallelizable functions
  const parallelizableRatio = functions.filter(f => f.canParallelize).length / functions.length;
  score += parallelizableRatio * 20;

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { score, grade };
}

/**
 * Generate optimization suggestions
 */
function generateSuggestions(
  sourceCode: string,
  conflicts: StateConflict[],
  functions: FunctionAnalysis[],
  stateVariables: { name: string; type: string; slot: number }[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Suggestion: Storage packing for small variables
  const smallVars = stateVariables.filter(v =>
    v.type.includes('uint8') || v.type.includes('uint16') ||
    v.type.includes('bool') || v.type.includes('bytes1')
  );
  if (smallVars.length >= 2) {
    suggestions.push({
      type: 'storage_packing',
      priority: 'medium',
      title: 'Pack Storage Variables',
      description: `${smallVars.length} small variables each occupy their own 32 byte slot. Declaring them adjacently lets the compiler pack them into one, which is both cheaper and one conflict point instead of several.`,
      currentCode: smallVars.slice(0, 3).map(v => `${v.type} public ${v.name};   // slot ${v.slot}`).join('\n'),
      suggestedCode:
        `// Declared together, these share a single slot\n` +
        smallVars.slice(0, 3).map(v => `${v.type} public ${v.name};`).join('\n'),
      gasImpact: 'Save ~2,100 gas per storage slot reduced'
    });
  }

  // Suggestion: Batch operations for multiple writes.
  // A suggestion without code is just a complaint, so the before/after is built
  // from the variables actually detected in the function.
  const multiWriteFuncs = functions.filter(f => f.writes.length > 2);
  for (const func of multiWriteFuncs) {
    const written = func.writes.slice(0, 4);
    const structName = `${func.name.charAt(0).toUpperCase()}${func.name.slice(1)}State`;

    suggestions.push({
      type: 'batch_operation',
      priority: 'high',
      title: `Batch Operations in ${func.name}()`,
      description:
        `${func.name} writes ${func.writes.length} separate state variables (${written.join(', ')}). ` +
        `Monad's scheduler tracks conflicts per storage slot, so each independent write is another ` +
        `chance to collide with a concurrent transaction. Grouping them into one struct means one ` +
        `slot range to reserve instead of ${func.writes.length}.`,
      currentCode:
        written.map((name) => `${name} = new${name.charAt(0).toUpperCase()}${name.slice(1)};`).join('\n'),
      suggestedCode:
        `struct ${structName} {\n` +
        written.map((name) => `    uint256 ${name};`).join('\n') +
        `\n}\n\n` +
        `${structName} private _state;\n\n` +
        `// One write reserves one contiguous region instead of ${func.writes.length} slots\n` +
        `_state = ${structName}({\n` +
        written.map((name) => `    ${name}: new${name.charAt(0).toUpperCase()}${name.slice(1)}`).join(',\n') +
        `\n});`,
      gasImpact: `Fewer slot reservations, ${func.writes.length} conflict points reduced to 1`
    });
  }

  // Suggestion: State separation for high conflicts
  for (const conflict of conflicts.filter(c => c.severity === 'high')) {
    suggestions.push({
      type: 'state_separation',
      priority: 'high',
      title: `Separate State for ${conflict.variable}`,
      description: `Multiple functions write to '${conflict.variable}'. Consider using separate state variables or mapping keys per user/operation to enable parallelization.`,
      currentCode: `${conflict.variable} = newValue;`,
      suggestedCode: `userState[msg.sender].${conflict.variable} = newValue;`,
      gasImpact: 'Enable parallel execution of transactions'
    });
  }

  // Suggestion: Use events instead of storage for logs
  const loggingPatterns = sourceCode.match(/\w+History\s*\[/g) || [];
  if (loggingPatterns.length > 0) {
    suggestions.push({
      type: 'event_optimization',
      priority: 'medium',
      title: 'Use Events for Historical Data',
      description: 'Historical data stored in arrays/mappings can be replaced with events to reduce storage writes and improve parallelization.',
      gasImpact: 'Save ~20,000 gas per storage operation'
    });
  }

  // Suggestion: Mapping optimization for better parallelization
  const hasBalances = sourceCode.includes('balances[') || sourceCode.includes('_balances[');
  if (hasBalances) {
    suggestions.push({
      type: 'mapping_optimization',
      priority: 'low',
      title: 'Monad-Optimized Token Transfers',
      description: 'Balance mappings are already parallel-friendly on Monad. Different users\' balances can be updated in parallel.',
      gasImpact: 'Already optimized for Monad\'s parallel EVM'
    });
  }

  return suggestions;
}

/**
 * Build dependency graph for visualization
 */
function buildDependencyGraph(
  functions: FunctionAnalysis[],
  storageAccess: Record<string, StorageAccess[]>
): { nodes: { id: string; type: 'function' | 'storage'; label: string; parallelizable: boolean }[]; edges: DependencyEdge[] } {
  const nodes: { id: string; type: 'function' | 'storage'; label: string; parallelizable: boolean }[] = [];
  const edges: DependencyEdge[] = [];

  // Add function nodes
  for (const func of functions) {
    nodes.push({
      id: `func_${func.name}`,
      type: 'function',
      label: `${func.name}()`,
      parallelizable: func.canParallelize
    });
  }

  // Add storage nodes
  for (const [variable, accesses] of Object.entries(storageAccess)) {
    if (accesses.length > 0) {
      const hasConflict = accesses.filter(a => a.type === 'write').length > 1 ||
        (accesses.some(a => a.type === 'write') && accesses.some(a => a.type === 'read'));

      nodes.push({
        id: `storage_${variable}`,
        type: 'storage',
        label: variable,
        parallelizable: !hasConflict
      });

      // Add edges for read/write relationships
      for (const access of accesses) {
        const edgeId = `func_${access.function}`;
        if (access.type === 'read') {
          edges.push({
            from: `storage_${variable}`,
            to: edgeId,
            type: 'read_after_write',
            slot: access.slot
          });
        } else {
          edges.push({
            from: edgeId,
            to: `storage_${variable}`,
            type: 'write_after_read',
            slot: access.slot
          });
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  score: number,
  grade: string,
  parallelizable: number,
  total: number,
  conflicts: number
): string {
  const percentage = total > 0 ? Math.round((parallelizable / total) * 100) : 100;

  let summary = `**Parallel Execution Score: ${score}/100 (Grade: ${grade})**\n\n`;

  if (score >= 90) {
    summary += `Excellent! This contract is highly optimized for Monad's parallel EVM. `;
    summary += `${parallelizable}/${total} functions (${percentage}%) can execute in parallel.`;
  } else if (score >= 75) {
    summary += `Good parallelization potential. ${parallelizable}/${total} functions can run in parallel. `;
    summary += `${conflicts} state conflicts detected - see suggestions for improvements.`;
  } else if (score >= 60) {
    summary += `Moderate parallelization. ${conflicts} conflicts limit parallel execution. `;
    summary += `Apply the high-priority suggestions to improve Monad performance.`;
  } else {
    summary += `Low parallelization potential. ${conflicts} conflicts prevent parallel execution. `;
    summary += `Consider restructuring state management for better Monad performance.`;
  }

  return summary;
}

/**
 * Quick analysis for real-time feedback
 */
export function quickAnalysis(sourceCode: string): { score: number; grade: string; conflicts: number } {
  const result = analyzeParallelPotential(sourceCode);
  return {
    score: result.score,
    grade: result.grade,
    conflicts: result.conflicts.length
  };
}
