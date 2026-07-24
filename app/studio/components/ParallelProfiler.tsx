'use client';

import React, { useState, useCallback } from 'react';
import type { Edge, Node } from 'reactflow';
import type { GraphNodeData } from '@/lib/dependencyGraph';
import { DependencyGraph } from './DependencyGraph';
import { OptimizationPanel } from './OptimizationPanel';

interface ParallelAnalysis {
  score: number;
  grade: string;
  totalFunctions: number;
  parallelizableFunctions: number;
  summary: string;
  functions: Array<{
    name: string;
    visibility: string;
    reads: string[];
    writes: string[];
    canParallelize: boolean;
    conflictsWith: string[];
  }>;
  conflicts: Array<{
    slot: string;
    variable: string;
    functions: string[];
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
  suggestions: Array<{
    type: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    currentCode?: string;
    suggestedCode?: string;
    gasImpact: string;
  }>;
  graph: {
    nodes: Node<GraphNodeData>[];
    edges: Edge[];
  };
  stats: {
    totalFunctions: number;
    parallelFunctions: number;
    conflictFunctions: number;
    totalStorageVars: number;
    highConflicts: number;
    mediumConflicts: number;
  };
  priorities: string[];
  metadata: {
    analysisTimeMs: number;
    timestamp: string;
  };
}

interface ParallelProfilerProps {
  code: string;
  onClose?: () => void;
}

export function ParallelProfiler({ code, onClose }: ParallelProfilerProps) {
  const [analysis, setAnalysis] = useState<ParallelAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'functions' | 'optimize'>('overview');

  const analyzeCode = useCallback(async () => {
    if (!code.trim()) {
      setError('No code to analyze');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/parallel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, mode: 'full' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze contract');
    } finally {
      setLoading(false);
    }
  }, [code]);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-orange-400';
      case 'F': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };


  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="font-semibold">Parallel Execution Profiler</span>
          </div>
          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
            Monad Optimized
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={analyzeCode}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Analyze
              </>
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Main Content */}
      {!analysis && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Parallel Execution Analysis</h3>
            <p className="text-gray-400 mb-6">
              Analyze your Solidity contract to identify parallel execution potential on Monad&apos;s 10,000 TPS EVM.
            </p>
            <button
              onClick={analyzeCode}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-medium transition-all"
            >
              Start Analysis
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
            </div>
            <p className="text-gray-400">Analyzing parallel execution potential...</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !loading && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Score Overview */}
          <div className="px-4 py-4 border-b border-gray-800">
            <div className="flex items-center gap-6">
              {/* Score Circle */}
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-800"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="url(#scoreGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(analysis.score / 100) * 251.2} 251.2`}
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={analysis.score >= 60 ? '#22c55e' : '#ef4444'} />
                      <stop offset="100%" stopColor={analysis.score >= 60 ? '#3b82f6' : '#f59e0b'} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold ${getGradeColor(analysis.grade)}`}>
                    {analysis.score}
                  </span>
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getGradeColor(analysis.grade)}`}>
                    {analysis.grade}
                  </div>
                  <div className="text-xs text-gray-500">Grade</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {analysis.parallelizableFunctions}
                  </div>
                  <div className="text-xs text-gray-500">Parallel</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-400">
                    {analysis.conflicts.filter(c => c.severity === 'high').length}
                  </div>
                  <div className="text-xs text-gray-500">Conflicts</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {analysis.totalFunctions}
                  </div>
                  <div className="text-xs text-gray-500">Functions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {(['overview', 'graph', 'functions', 'optimize'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                  <h4 className="font-medium mb-2">Analysis Summary</h4>
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">
                    {analysis.summary}
                  </div>
                </div>

                {/* Priority Actions */}
                {analysis.priorities.length > 0 && (
                  <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Priority Actions
                    </h4>
                    <ul className="space-y-2">
                      {analysis.priorities.map((priority, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-yellow-400">•</span>
                          <span className="text-gray-300">{priority}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Conflicts */}
                {analysis.conflicts.length > 0 && (
                  <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      State Conflicts ({analysis.conflicts.length})
                    </h4>
                    <div className="space-y-2">
                      {analysis.conflicts.map((conflict, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            conflict.severity === 'high'
                              ? 'bg-red-500/10 border-red-500/30'
                              : conflict.severity === 'medium'
                              ? 'bg-yellow-500/10 border-yellow-500/30'
                              : 'bg-gray-500/10 border-gray-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              conflict.severity === 'high'
                                ? 'bg-red-500/20 text-red-400'
                                : conflict.severity === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {conflict.severity.toUpperCase()}
                            </span>
                            <span className="font-mono text-sm">{conflict.variable}</span>
                          </div>
                          <p className="text-sm text-gray-400">{conflict.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-gray-500 flex items-center gap-4">
                  <span>Analysis time: {analysis.metadata.analysisTimeMs}ms</span>
                  <span>•</span>
                  <span>{new Date(analysis.metadata.timestamp).toLocaleString()}</span>
                </div>
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="h-[500px]">
                <DependencyGraph
                  nodes={analysis.graph.nodes}
                  edges={analysis.graph.edges}
                  stats={analysis.stats}
                />
              </div>
            )}

            {activeTab === 'functions' && (
              <div className="space-y-3">
                {analysis.functions.map((func, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      func.canParallelize
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          func.canParallelize ? 'bg-green-400' : 'bg-red-400'
                        }`}></span>
                        <span className="font-mono font-medium">{func.name}()</span>
                        <span className="text-xs text-gray-500">{func.visibility}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        func.canParallelize
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {func.canParallelize ? 'Parallelizable' : 'Sequential'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Reads:</span>
                        <span className="ml-2 text-blue-400">
                          {func.reads.length > 0 ? func.reads.join(', ') : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Writes:</span>
                        <span className="ml-2 text-red-400">
                          {func.writes.length > 0 ? func.writes.join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                    {func.conflictsWith.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-500">Conflicts with:</span>
                        <span className="ml-2 text-yellow-400">
                          {func.conflictsWith.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'optimize' && (
              <OptimizationPanel suggestions={analysis.suggestions} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ParallelProfiler;
