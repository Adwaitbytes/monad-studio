/**
 * @title Somnia Security Analyzer
 * @description Automated security analysis for smart contracts before deployment
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Security risk levels
 */
const RISK_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO'
};

/**
 * Common vulnerability patterns to check
 */
const VULNERABILITY_PATTERNS = [
  {
    name: 'Reentrancy',
    pattern: /\.call\{value:/,
    risk: RISK_LEVELS.HIGH,
    description: 'Potential reentrancy vulnerability detected. Use ReentrancyGuard.',
    recommendation: 'Import and use OpenZeppelin ReentrancyGuard modifier.'
  },
  {
    name: 'Unchecked Transfer',
    pattern: /\.transfer\(/,
    risk: RISK_LEVELS.MEDIUM,
    description: 'Using .transfer() can fail with gas limit changes.',
    recommendation: 'Use .call{value:}() with proper checks instead.'
  },
  {
    name: 'Timestamp Dependency',
    pattern: /block\.timestamp/,
    risk: RISK_LEVELS.LOW,
    description: 'Timestamp dependency detected. Can be manipulated by miners.',
    recommendation: 'Avoid critical logic based solely on block.timestamp.'
  },
  {
    name: 'Unchecked External Call',
    pattern: /\.call\(/,
    risk: RISK_LEVELS.MEDIUM,
    description: 'External call without proper checks detected.',
    recommendation: 'Always check return values of external calls.'
  },
  {
    name: 'Delegatecall',
    pattern: /\.delegatecall\(/,
    risk: RISK_LEVELS.CRITICAL,
    description: 'Delegatecall can be dangerous if not properly secured.',
    recommendation: 'Ensure delegatecall targets are trusted and immutable.'
  },
  {
    name: 'Selfdestruct',
    pattern: /selfdestruct\(/,
    risk: RISK_LEVELS.CRITICAL,
    description: 'Selfdestruct can lead to loss of funds.',
    recommendation: 'Avoid selfdestruct or add strict access control.'
  },
  {
    name: 'Missing Access Control',
    pattern: /function\s+\w+\s*\([^)]*\)\s+public/,
    risk: RISK_LEVELS.MEDIUM,
    description: 'Public functions should have proper access control.',
    recommendation: 'Use onlyOwner or role-based access control for sensitive functions.'
  }
];

/**
 * Best practices to check
 */
const BEST_PRACTICES = [
  {
    name: 'OpenZeppelin Import',
    pattern: /@openzeppelin\/contracts/,
    present: true,
    description: 'Using OpenZeppelin contracts (recommended)'
  },
  {
    name: 'SPDX License',
    pattern: /\/\/\s*SPDX-License-Identifier:/,
    present: true,
    description: 'SPDX license identifier present'
  },
  {
    name: 'NatSpec Comments',
    pattern: /\/\*\*[\s\S]*?@(title|notice|dev|param|return)/,
    present: true,
    description: 'NatSpec documentation present'
  },
  {
    name: 'Events',
    pattern: /event\s+\w+/,
    present: true,
    description: 'Events defined for important state changes'
  }
];

/**
 * Analyze Solidity source code for security issues
 * @param {string} sourceCode - The Solidity source code
 * @returns {Object} Analysis results
 */
function analyzeContract(sourceCode) {
  const results = {
    vulnerabilities: [],
    bestPractices: [],
    gasOptimizations: [],
    overallRisk: RISK_LEVELS.LOW,
    safeToDP: false,
    warnings: []
  };

  // Check for vulnerability patterns
  VULNERABILITY_PATTERNS.forEach(vuln => {
    const matches = sourceCode.match(new RegExp(vuln.pattern, 'g'));
    if (matches) {
      results.vulnerabilities.push({
        name: vuln.name,
        risk: vuln.risk,
        count: matches.length,
        description: vuln.description,
        recommendation: vuln.recommendation
      });
    }
  });

  // Check best practices
  BEST_PRACTICES.forEach(practice => {
    const found = practice.pattern.test(sourceCode);
    results.bestPractices.push({
      name: practice.name,
      passed: found === practice.present,
      description: practice.description
    });
  });

  // Gas optimization suggestions
  if (sourceCode.includes('public')) {
    results.gasOptimizations.push({
      type: 'Visibility',
      suggestion: 'Use external instead of public for functions only called externally',
      impact: 'LOW'
    });
  }

  if (sourceCode.includes('string')) {
    results.gasOptimizations.push({
      type: 'Storage',
      suggestion: 'Consider using bytes32 instead of string for fixed-length data',
      impact: 'MEDIUM'
    });
  }

  // Determine overall risk
  const criticalVulns = results.vulnerabilities.filter(v => v.risk === RISK_LEVELS.CRITICAL);
  const highVulns = results.vulnerabilities.filter(v => v.risk === RISK_LEVELS.HIGH);

  if (criticalVulns.length > 0) {
    results.overallRisk = RISK_LEVELS.CRITICAL;
    results.safeToDeploy = false;
    results.warnings.push('⛔ CRITICAL vulnerabilities found - DO NOT DEPLOY');
  } else if (highVulns.length > 0) {
    results.overallRisk = RISK_LEVELS.HIGH;
    results.safeToDeploy = false;
    results.warnings.push('⚠️ HIGH risk vulnerabilities found - Review carefully');
  } else if (results.vulnerabilities.length > 0) {
    results.overallRisk = RISK_LEVELS.MEDIUM;
    results.safeToDeploy = true;
    results.warnings.push('✅ Medium/Low risks found - Review recommended');
  } else {
    results.overallRisk = RISK_LEVELS.LOW;
    results.safeToDeploy = true;
    results.warnings.push('✅ No major vulnerabilities detected');
  }

  return results;
}

/**
 * Generate human-readable audit report
 * @param {Object} analysis - Analysis results
 * @returns {string} Formatted report
 */
function generateAuditReport(analysis) {
  let report = '=== SOMNIA SECURITY AUDIT REPORT ===\n\n';
  
  report += `Overall Risk Level: ${analysis.overallRisk}\n`;
  report += `Safe to Deploy: ${analysis.safeToDeploy ? '✅ YES' : '❌ NO'}\n\n`;

  if (analysis.warnings.length > 0) {
    report += '⚠️ WARNINGS:\n';
    analysis.warnings.forEach(w => report += `  ${w}\n`);
    report += '\n';
  }

  if (analysis.vulnerabilities.length > 0) {
    report += '🔴 VULNERABILITIES FOUND:\n\n';
    analysis.vulnerabilities.forEach((vuln, i) => {
      report += `${i + 1}. ${vuln.name} [${vuln.risk}]\n`;
      report += `   Description: ${vuln.description}\n`;
      report += `   Recommendation: ${vuln.recommendation}\n`;
      report += `   Occurrences: ${vuln.count}\n\n`;
    });
  } else {
    report += '✅ No vulnerabilities detected\n\n';
  }

  report += '📋 BEST PRACTICES CHECK:\n';
  analysis.bestPractices.forEach(practice => {
    const icon = practice.passed ? '✅' : '❌';
    report += `  ${icon} ${practice.name}: ${practice.description}\n`;
  });
  report += '\n';

  if (analysis.gasOptimizations.length > 0) {
    report += '⚡ GAS OPTIMIZATIONS:\n';
    analysis.gasOptimizations.forEach((opt, i) => {
      report += `  ${i + 1}. [${opt.impact}] ${opt.type}: ${opt.suggestion}\n`;
    });
    report += '\n';
  }

  report += '=== END OF REPORT ===\n';
  return report;
}

module.exports = {
  analyzeContract,
  generateAuditReport,
  RISK_LEVELS
};
