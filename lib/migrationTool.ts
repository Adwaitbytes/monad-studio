/**
 * Contract Migration Tool for Monad
 *
 * Enables developers to import existing Ethereum contracts,
 * analyze them for Monad compatibility, and optimize them for
 * Monad's parallel EVM execution.
 */

import { analyzeParallelPotential, ParallelAnalysisResult } from './parallelAnalyzer';

// ============= TYPE DEFINITIONS =============

export type NetworkType = 'mainnet' | 'sepolia';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CompatibilityIssue {
  severity: IssueSeverity;
  type: string;
  title: string;
  description: string;
  line?: number;
  column?: number;
  code?: string;
  fix?: {
    description: string;
    replacement?: string;
    autoFixable: boolean;
  };
}

export interface CodeChange {
  type: 'pragma' | 'import' | 'security' | 'pattern' | 'optimization' | 'license';
  line: number;
  original: string;
  replacement: string;
  reason: string;
  autoFixed: boolean;
}

export interface FetchedContract {
  name: string;
  address: string;
  network: NetworkType;
  sourceCode: string;
  compiler: string;
  optimizationUsed: boolean;
  runs: number;
  constructorArguments: string;
  isVerified: boolean;
  isProxy: boolean;
  implementationAddress?: string;
}

export interface TransformResult {
  originalCode: string;
  migratedCode: string;
  changes: CodeChange[];
  autoFixedCount: number;
  manualFixCount: number;
}

export interface MigrationResult {
  contract: {
    name: string;
    address?: string;
    network?: NetworkType;
    sourceCode: string;
    compiler: string;
    isVerified: boolean;
  };
  analysis: {
    compatibilityScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    issues: CompatibilityIssue[];
    parallelScore: number;
    parallelGrade: string;
  };
  migration: TransformResult;
  metadata: {
    analysisTimeMs: number;
    timestamp: string;
  };
}

// ============= NETWORK CONFIGURATION =============

const EXPLORER_APIS: Record<NetworkType, { api: string; name: string }> = {
  mainnet: {
    api: 'https://api.etherscan.io/api',
    name: 'Ethereum Mainnet',
  },
  sepolia: {
    api: 'https://api-sepolia.etherscan.io/api',
    name: 'Sepolia Testnet',
  },
};

// ============= COMPATIBILITY PATTERNS =============

interface CompatibilityPattern {
  pattern: RegExp;
  severity: IssueSeverity;
  type: string;
  title: string;
  description: string;
  fix?: {
    description: string;
    replacement?: string | ((match: string) => string);
    autoFixable: boolean;
  };
}

const COMPATIBILITY_PATTERNS: CompatibilityPattern[] = [
  // CRITICAL - May not work on Monad
  {
    pattern: /selfdestruct\s*\(/g,
    severity: 'critical',
    type: 'deprecated_opcode',
    title: 'SELFDESTRUCT Usage Detected',
    description: 'selfdestruct is deprecated in EIP-6049 and may not work as expected on Monad. The contract balance transfer behavior is changing.',
    fix: {
      description: 'Remove selfdestruct and implement a withdrawal pattern instead. Consider using a pausable + withdrawal mechanism.',
      autoFixable: false,
    },
  },
  {
    pattern: /suicide\s*\(/g,
    severity: 'critical',
    type: 'deprecated_opcode',
    title: 'SUICIDE Opcode (Deprecated)',
    description: 'suicide() is the old name for selfdestruct() and is deprecated.',
    fix: {
      description: 'Remove this pattern and implement proper withdrawal mechanics.',
      autoFixable: false,
    },
  },

  // HIGH - Security concerns
  {
    pattern: /tx\.origin/g,
    severity: 'high',
    type: 'security',
    title: 'tx.origin Usage for Authorization',
    description: 'Using tx.origin for authorization is vulnerable to phishing attacks. An attacker can trick a user into calling their malicious contract which then calls your contract.',
    fix: {
      description: 'Replace tx.origin with msg.sender for authorization checks',
      replacement: 'msg.sender',
      autoFixable: true,
    },
  },
  {
    pattern: /\.call\{[^}]*\}\s*\([^)]*\)\s*;/g,
    severity: 'high',
    type: 'security',
    title: 'Unchecked External Call',
    description: 'External call return value is not checked. This can lead to silent failures.',
    fix: {
      description: 'Always check the return value of external calls: (bool success, ) = target.call{...}(...); require(success);',
      autoFixable: false,
    },
  },

  // MEDIUM - Behavioral differences
  {
    pattern: /block\.difficulty/g,
    severity: 'medium',
    type: 'randomness',
    title: 'block.difficulty Usage',
    description: 'block.difficulty was replaced by block.prevrandao after The Merge. Monad may have different randomness characteristics.',
    fix: {
      description: 'Use block.prevrandao for post-Merge compatibility, or Chainlink VRF for secure randomness.',
      replacement: 'block.prevrandao',
      autoFixable: true,
    },
  },
  {
    pattern: /block\.prevrandao/g,
    severity: 'medium',
    type: 'randomness',
    title: 'block.prevrandao Usage',
    description: 'block.prevrandao is pseudo-random and can be influenced by validators. For Monad, consider the consensus mechanism differences.',
    fix: {
      description: 'For production randomness, consider using Chainlink VRF or similar oracle solutions.',
      autoFixable: false,
    },
  },
  {
    pattern: /block\.timestamp\s*[<>=]/g,
    severity: 'medium',
    type: 'timing',
    title: 'Timestamp Dependency',
    description: 'Contract logic depends on block.timestamp. Monad has ~400ms block times vs Ethereum\'s 12s, which may affect time-sensitive logic.',
    fix: {
      description: 'Review time-sensitive logic for faster block times. Adjust any time windows accordingly.',
      autoFixable: false,
    },
  },

  // LOW - Best practices
  {
    pattern: /pragma\s+solidity\s+(\^?\s*)0\.[0-7]\.\d+/g,
    severity: 'low',
    type: 'compiler_version',
    title: 'Old Solidity Version',
    description: 'Solidity versions before 0.8.0 lack built-in overflow/underflow protection. Upgrade for better security and gas efficiency.',
    fix: {
      description: 'Update pragma to ^0.8.24 for latest features and built-in overflow protection',
      replacement: 'pragma solidity ^0.8.24',
      autoFixable: true,
    },
  },
  {
    pattern: /pragma\s+solidity\s+(\^?\s*)0\.8\.([0-9]|1[0-9]|2[0-3])\s*;/g,
    severity: 'info',
    type: 'compiler_version',
    title: 'Older 0.8.x Version',
    description: 'Consider upgrading to Solidity 0.8.24 for latest optimizations and features.',
    fix: {
      description: 'Update to pragma solidity ^0.8.24',
      replacement: 'pragma solidity ^0.8.24;',
      autoFixable: true,
    },
  },

  // INFO - Informational
  {
    pattern: /assembly\s*\{/g,
    severity: 'info',
    type: 'inline_assembly',
    title: 'Inline Assembly Detected',
    description: 'Contract uses inline assembly. Verify assembly opcodes are compatible with Monad\'s EVM implementation.',
    fix: {
      description: 'Review assembly code for opcode compatibility. Most standard opcodes work identically.',
      autoFixable: false,
    },
  },
  {
    pattern: /delegatecall/g,
    severity: 'info',
    type: 'delegatecall',
    title: 'Delegatecall Usage',
    description: 'Contract uses delegatecall. Ensure the target contract is also compatible with Monad.',
    fix: {
      description: 'Verify all contracts in the delegatecall chain are Monad-compatible.',
      autoFixable: false,
    },
  },
];

// ============= MAIN FUNCTIONS =============

/**
 * Fetch contract source code from Etherscan
 */
export async function fetchContractSource(
  address: string,
  network: NetworkType,
  apiKey?: string
): Promise<FetchedContract> {
  const explorer = EXPLORER_APIS[network];
  const key = apiKey || process.env.ETHERSCAN_API_KEY || '';

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid Ethereum address format');
  }

  // Fetch contract source
  const url = `${explorer.api}?module=contract&action=getsourcecode&address=${address}&apikey=${key}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== '1' || !data.result || data.result.length === 0) {
    throw new Error(data.message || 'Failed to fetch contract source');
  }

  const result = data.result[0];

  if (!result.SourceCode || result.SourceCode === '') {
    throw new Error('Contract source code is not verified on Etherscan');
  }

  // Parse source code (handle JSON format for multi-file contracts)
  let sourceCode = result.SourceCode;

  // Etherscan returns double-encoded JSON for multi-file contracts
  if (sourceCode.startsWith('{{')) {
    try {
      // Remove outer braces and parse
      const jsonStr = sourceCode.slice(1, -1);
      const parsed = JSON.parse(jsonStr);

      // Extract main contract source
      if (parsed.sources) {
        const sources = Object.entries(parsed.sources);
        // Find the main contract file
        const mainFile = sources.find(([path]) =>
          path.includes(result.ContractName) ||
          !path.includes('/')
        );

        if (mainFile) {
          sourceCode = (mainFile[1] as any).content;
        } else {
          // Concatenate all sources
          sourceCode = sources
            .map(([path, content]: [string, any]) => `// File: ${path}\n${content.content}`)
            .join('\n\n');
        }
      }
    } catch {
      // If parsing fails, use as-is
    }
  }

  // Check if it's a proxy contract
  const isProxy = result.Proxy === '1' ||
    sourceCode.includes('delegatecall') && sourceCode.includes('implementation');

  return {
    name: result.ContractName || 'Unknown',
    address,
    network,
    sourceCode,
    compiler: result.CompilerVersion || 'Unknown',
    optimizationUsed: result.OptimizationUsed === '1',
    runs: parseInt(result.Runs) || 200,
    constructorArguments: result.ConstructorArguments || '',
    isVerified: true,
    isProxy,
    implementationAddress: result.Implementation || undefined,
  };
}

/**
 * Check contract for Monad compatibility issues
 */
export function checkMonadCompatibility(sourceCode: string): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const lines = sourceCode.split('\n');

  for (const pattern of COMPATIBILITY_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

    while ((match = regex.exec(sourceCode)) !== null) {
      // Calculate line number
      const beforeMatch = sourceCode.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      // Get the matched code context
      const lineContent = lines[lineNumber - 1]?.trim() || match[0];

      issues.push({
        severity: pattern.severity,
        type: pattern.type,
        title: pattern.title,
        description: pattern.description,
        line: lineNumber,
        code: lineContent,
        fix: pattern.fix ? {
          description: pattern.fix.description,
          replacement: typeof pattern.fix.replacement === 'function'
            ? pattern.fix.replacement(match[0])
            : pattern.fix.replacement,
          autoFixable: pattern.fix.autoFixable,
        } : undefined,
      });
    }
  }

  // Check for missing SPDX license
  if (!sourceCode.includes('SPDX-License-Identifier')) {
    issues.push({
      severity: 'info',
      type: 'license',
      title: 'Missing SPDX License Identifier',
      description: 'Add an SPDX license identifier for better compatibility and to avoid compiler warnings.',
      line: 1,
      fix: {
        description: 'Add SPDX license identifier at the top of the file',
        replacement: '// SPDX-License-Identifier: MIT',
        autoFixable: true,
      },
    });
  }

  // Sort by severity (critical first)
  const severityOrder: Record<IssueSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Transform code for Monad compatibility with auto-fixes
 */
export function transformForMonad(
  sourceCode: string,
  autoFix: boolean = true
): TransformResult {
  let migratedCode = sourceCode;
  const changes: CodeChange[] = [];
  let autoFixedCount = 0;
  let manualFixCount = 0;

  const lines = sourceCode.split('\n');

  // Auto-fix: Add SPDX license if missing
  if (autoFix && !sourceCode.includes('SPDX-License-Identifier')) {
    migratedCode = '// SPDX-License-Identifier: MIT\n' + migratedCode;
    changes.push({
      type: 'license',
      line: 1,
      original: '',
      replacement: '// SPDX-License-Identifier: MIT',
      reason: 'Added SPDX license identifier',
      autoFixed: true,
    });
    autoFixedCount++;
  }

  // Auto-fix: Update old pragma versions
  if (autoFix) {
    const oldPragmaMatch = migratedCode.match(/pragma\s+solidity\s+(\^?\s*)0\.[0-7]\.\d+\s*;/);
    if (oldPragmaMatch) {
      const lineNum = migratedCode.substring(0, migratedCode.indexOf(oldPragmaMatch[0])).split('\n').length;
      migratedCode = migratedCode.replace(oldPragmaMatch[0], 'pragma solidity ^0.8.24;');
      changes.push({
        type: 'pragma',
        line: lineNum,
        original: oldPragmaMatch[0],
        replacement: 'pragma solidity ^0.8.24;',
        reason: 'Updated to Solidity 0.8.24 for built-in overflow protection',
        autoFixed: true,
      });
      autoFixedCount++;
    }
  }

  // Auto-fix: Replace tx.origin with msg.sender
  if (autoFix) {
    const txOriginRegex = /tx\.origin/g;
    let match;
    while ((match = txOriginRegex.exec(sourceCode)) !== null) {
      const lineNum = sourceCode.substring(0, match.index).split('\n').length;
      changes.push({
        type: 'security',
        line: lineNum,
        original: 'tx.origin',
        replacement: 'msg.sender',
        reason: 'Replaced tx.origin with msg.sender for security',
        autoFixed: true,
      });
      autoFixedCount++;
    }
    migratedCode = migratedCode.replace(/tx\.origin/g, 'msg.sender');
  }

  // Auto-fix: Replace block.difficulty with block.prevrandao
  if (autoFix) {
    const difficultyRegex = /block\.difficulty/g;
    let match;
    while ((match = difficultyRegex.exec(sourceCode)) !== null) {
      const lineNum = sourceCode.substring(0, match.index).split('\n').length;
      changes.push({
        type: 'pattern',
        line: lineNum,
        original: 'block.difficulty',
        replacement: 'block.prevrandao',
        reason: 'Updated for post-Merge compatibility',
        autoFixed: true,
      });
      autoFixedCount++;
    }
    migratedCode = migratedCode.replace(/block\.difficulty/g, 'block.prevrandao');
  }

  // Count manual fixes needed
  const issues = checkMonadCompatibility(sourceCode);
  manualFixCount = issues.filter(i => !i.fix?.autoFixable).length;

  return {
    originalCode: sourceCode,
    migratedCode,
    changes,
    autoFixedCount,
    manualFixCount,
  };
}

/**
 * Calculate compatibility score based on issues
 */
function calculateCompatibilityScore(issues: CompatibilityIssue[]): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' } {
  let score = 100;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        score -= 25;
        break;
      case 'high':
        score -= 15;
        break;
      case 'medium':
        score -= 8;
        break;
      case 'low':
        score -= 3;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { score, grade };
}

/**
 * Full migration analysis - combines all analysis steps
 */
export function analyzeForMigration(
  sourceCode: string,
  contractInfo?: Partial<FetchedContract>,
  autoFix: boolean = true
): MigrationResult {
  const startTime = Date.now();

  // Check compatibility issues
  const issues = checkMonadCompatibility(sourceCode);

  // Calculate compatibility score
  const { score: compatibilityScore, grade } = calculateCompatibilityScore(issues);

  // Transform code with auto-fixes
  const migration = transformForMonad(sourceCode, autoFix);

  // Get parallel execution analysis
  let parallelScore = 0;
  let parallelGrade = 'F';

  try {
    const parallelAnalysis = analyzeParallelPotential(migration.migratedCode);
    parallelScore = parallelAnalysis.score;
    parallelGrade = parallelAnalysis.grade;
  } catch {
    // If parallel analysis fails, default to 50
    parallelScore = 50;
    parallelGrade = 'C';
  }

  const analysisTimeMs = Date.now() - startTime;

  return {
    contract: {
      name: contractInfo?.name || extractContractName(sourceCode),
      address: contractInfo?.address,
      network: contractInfo?.network,
      sourceCode,
      compiler: contractInfo?.compiler || 'Unknown',
      isVerified: contractInfo?.isVerified ?? false,
    },
    analysis: {
      compatibilityScore,
      grade,
      issues,
      parallelScore,
      parallelGrade,
    },
    migration,
    metadata: {
      analysisTimeMs,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Extract contract name from source code
 */
function extractContractName(sourceCode: string): string {
  const match = sourceCode.match(/contract\s+(\w+)/);
  return match ? match[1] : 'Unknown';
}

/**
 * Quick compatibility check for real-time feedback
 */
export function quickCompatibilityCheck(sourceCode: string): {
  score: number;
  grade: string;
  criticalIssues: number;
  totalIssues: number;
} {
  const issues = checkMonadCompatibility(sourceCode);
  const { score, grade } = calculateCompatibilityScore(issues);
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;

  return {
    score,
    grade,
    criticalIssues,
    totalIssues: issues.length,
  };
}
