import { NextResponse } from "next/server";
import { analyzeParallelPotential, quickAnalysis } from "@/lib/parallelAnalyzer";
import { createFlowGraph, getGraphStats, getOptimizationPriority } from "@/lib/dependencyGraph";

/**
 * Parallel Execution Analyzer API
 *
 * Analyzes Solidity contracts for Monad parallel execution potential.
 * Returns parallelization score, conflicts, and optimization suggestions.
 */

export async function POST(req: Request) {
  try {
    const { code, mode = 'full' } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Contract code is required" },
        { status: 400 }
      );
    }

    // Quick mode for real-time feedback while typing
    if (mode === 'quick') {
      const result = quickAnalysis(code);
      return NextResponse.json({
        success: true,
        mode: 'quick',
        analysis: result,
      });
    }

    // Full analysis mode
    const startTime = Date.now();
    const analysis = analyzeParallelPotential(code);
    const analysisTime = Date.now() - startTime;

    // Generate graph data for visualization
    const graphData = createFlowGraph(analysis);
    const stats = getGraphStats(analysis);
    const priorities = getOptimizationPriority(analysis);

    // Convert Map to serializable format
    const storageSlots: Record<string, unknown[]> = {};
    analysis.storageSlots.forEach((value, key) => {
      storageSlots[key] = value;
    });

    return NextResponse.json({
      success: true,
      mode: 'full',
      analysis: {
        score: analysis.score,
        grade: analysis.grade,
        totalFunctions: analysis.totalFunctions,
        parallelizableFunctions: analysis.parallelizableFunctions,
        summary: analysis.summary,

        // Detailed analysis
        functions: analysis.functions,
        conflicts: analysis.conflicts,
        suggestions: analysis.suggestions,
        storageSlots,

        // Graph visualization data
        graph: graphData,
        stats,

        // Prioritized actions
        priorities,

        // Performance metrics
        metadata: {
          analysisTimeMs: analysisTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      },
    });

  } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected server error";
    console.error('Parallel analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message || 'Analysis failed',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for API health check and documentation
 */
export async function GET() {
  return NextResponse.json({
    name: "Monad Parallel Execution Analyzer",
    version: "1.0.0",
    description: "Analyzes Solidity contracts for parallel execution potential on Monad's 10,000 TPS EVM",
    endpoints: {
      POST: {
        description: "Analyze a Solidity contract",
        body: {
          code: "string (required) - Solidity source code",
          mode: "string (optional) - 'quick' for fast analysis, 'full' for detailed analysis (default: 'full')",
        },
        response: {
          score: "number (0-100) - Parallelization score",
          grade: "string (A-F) - Letter grade",
          functions: "array - Function-by-function analysis",
          conflicts: "array - Detected state conflicts",
          suggestions: "array - Optimization suggestions",
          graph: "object - React Flow compatible visualization data",
        },
      },
    },
    scoring: {
      "90-100": "Grade A - Excellent parallelization",
      "75-89": "Grade B - Good parallelization",
      "60-74": "Grade C - Moderate parallelization",
      "40-59": "Grade D - Limited parallelization",
      "0-39": "Grade F - Poor parallelization",
    },
    monadInfo: {
      parallelExecution: "Monad executes independent transactions in parallel",
      tps: "10,000+ transactions per second",
      blockTime: "400ms blocks",
      optimization: "Contracts with separated state can fully utilize parallel execution",
    },
  });
}
