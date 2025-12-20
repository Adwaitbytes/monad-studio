/**
 * Dependency Graph Engine for React Flow Visualization
 *
 * Converts parallel analysis results into React Flow compatible
 * node and edge data structures for interactive visualization.
 */

import type { Node, Edge, MarkerType } from 'reactflow';
import type { ParallelAnalysisResult, FunctionAnalysis, StateConflict } from './parallelAnalyzer';

// Node types for the graph
export type NodeType = 'function' | 'storage' | 'conflict' | 'summary';

// Custom node data structure
export interface GraphNodeData {
  label: string;
  type: NodeType;
  parallelizable: boolean;
  reads?: string[];
  writes?: string[];
  conflictsWith?: string[];
  severity?: 'high' | 'medium' | 'low';
  description?: string;
}

// Color scheme for visualization
export const GRAPH_COLORS = {
  // Node colors
  parallelizable: '#22c55e',     // Green - can run in parallel
  conflict: '#ef4444',           // Red - has conflicts
  warning: '#f59e0b',            // Yellow - medium severity
  storage: '#6366f1',            // Purple - storage slots
  neutral: '#64748b',            // Gray - neutral nodes

  // Edge colors
  read: '#3b82f6',               // Blue - read operations
  write: '#ef4444',              // Red - write operations
  dependency: '#f59e0b',         // Yellow - dependencies

  // Background
  nodeBackground: '#1e293b',
  nodeBorder: '#334155',
};

/**
 * Convert parallel analysis result to React Flow nodes and edges
 */
export function createFlowGraph(analysis: ParallelAnalysisResult): {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];

  // Layout configuration
  const FUNCTION_X = 100;
  const STORAGE_X = 500;
  const NODE_SPACING_Y = 120;
  const CONFLICT_X = 300;

  // Create function nodes
  analysis.functions.forEach((func, index) => {
    const nodeId = `func_${func.name}`;

    nodes.push({
      id: nodeId,
      type: 'custom',
      position: { x: FUNCTION_X, y: 50 + index * NODE_SPACING_Y },
      data: {
        label: `${func.name}()`,
        type: 'function',
        parallelizable: func.canParallelize,
        reads: func.reads,
        writes: func.writes,
        conflictsWith: func.conflictsWith,
      },
      style: {
        background: func.canParallelize ? GRAPH_COLORS.parallelizable : GRAPH_COLORS.conflict,
        color: '#fff',
        border: `2px solid ${func.canParallelize ? '#16a34a' : '#dc2626'}`,
        borderRadius: '8px',
        padding: '10px 15px',
        minWidth: '150px',
        textAlign: 'center' as const,
        fontWeight: 'bold',
        boxShadow: func.canParallelize
          ? '0 0 10px rgba(34, 197, 94, 0.3)'
          : '0 0 10px rgba(239, 68, 68, 0.3)',
      },
    });
  });

  // Create storage nodes
  const storageVars = new Set<string>();
  analysis.functions.forEach(func => {
    func.reads.forEach(v => storageVars.add(v));
    func.writes.forEach(v => storageVars.add(v));
  });

  const storageArray = Array.from(storageVars);
  storageArray.forEach((variable, index) => {
    const nodeId = `storage_${variable}`;

    // Check if this storage has conflicts
    const hasConflict = analysis.conflicts.some(c => c.variable === variable);
    const conflict = analysis.conflicts.find(c => c.variable === variable);

    nodes.push({
      id: nodeId,
      type: 'custom',
      position: { x: STORAGE_X, y: 50 + index * NODE_SPACING_Y },
      data: {
        label: variable,
        type: 'storage',
        parallelizable: !hasConflict,
        severity: conflict?.severity,
        description: conflict?.description,
      },
      style: {
        background: hasConflict
          ? (conflict?.severity === 'high' ? GRAPH_COLORS.conflict : GRAPH_COLORS.warning)
          : GRAPH_COLORS.storage,
        color: '#fff',
        border: `2px solid ${hasConflict ? '#dc2626' : '#4f46e5'}`,
        borderRadius: '50%',
        padding: '15px',
        minWidth: '80px',
        minHeight: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center' as const,
        fontSize: '12px',
        fontWeight: 'bold',
      },
    });
  });

  // Create edges for read/write relationships
  analysis.functions.forEach(func => {
    const funcId = `func_${func.name}`;

    // Read edges (storage -> function)
    func.reads.forEach(variable => {
      const storageId = `storage_${variable}`;
      edges.push({
        id: `read_${func.name}_${variable}`,
        source: storageId,
        target: funcId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: GRAPH_COLORS.read, strokeWidth: 2 },
        label: 'read',
        labelStyle: { fill: GRAPH_COLORS.read, fontSize: 10 },
        labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
        markerEnd: {
          type: 'arrowclosed' as MarkerType,
          color: GRAPH_COLORS.read,
        },
      });
    });

    // Write edges (function -> storage)
    func.writes.forEach(variable => {
      const storageId = `storage_${variable}`;
      edges.push({
        id: `write_${func.name}_${variable}`,
        source: funcId,
        target: storageId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: GRAPH_COLORS.write, strokeWidth: 3 },
        label: 'write',
        labelStyle: { fill: GRAPH_COLORS.write, fontSize: 10, fontWeight: 'bold' },
        labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
        markerEnd: {
          type: 'arrowclosed' as MarkerType,
          color: GRAPH_COLORS.write,
        },
      });
    });
  });

  // Create conflict edges between functions
  analysis.conflicts.forEach((conflict, index) => {
    if (conflict.functions.length >= 2) {
      for (let i = 0; i < conflict.functions.length - 1; i++) {
        for (let j = i + 1; j < conflict.functions.length; j++) {
          const funcA = conflict.functions[i];
          const funcB = conflict.functions[j];

          edges.push({
            id: `conflict_${funcA}_${funcB}_${conflict.variable}`,
            source: `func_${funcA}`,
            target: `func_${funcB}`,
            type: 'straight',
            animated: false,
            style: {
              stroke: conflict.severity === 'high' ? GRAPH_COLORS.conflict : GRAPH_COLORS.warning,
              strokeWidth: 3,
              strokeDasharray: '5,5',
            },
            label: `⚠️ ${conflict.variable}`,
            labelStyle: {
              fill: '#fff',
              fontSize: 10,
              fontWeight: 'bold',
            },
            labelBgStyle: {
              fill: conflict.severity === 'high' ? '#dc2626' : '#f59e0b',
              fillOpacity: 0.9,
            },
          });
        }
      }
    }
  });

  return { nodes, edges };
}

/**
 * Generate summary statistics for the graph legend
 */
export function getGraphStats(analysis: ParallelAnalysisResult) {
  const parallelFunctions = analysis.functions.filter(f => f.canParallelize).length;
  const conflictFunctions = analysis.functions.filter(f => !f.canParallelize).length;
  const highConflicts = analysis.conflicts.filter(c => c.severity === 'high').length;
  const mediumConflicts = analysis.conflicts.filter(c => c.severity === 'medium').length;

  return {
    totalFunctions: analysis.functions.length,
    parallelFunctions,
    conflictFunctions,
    totalStorageVars: new Set([
      ...analysis.functions.flatMap(f => f.reads),
      ...analysis.functions.flatMap(f => f.writes),
    ]).size,
    highConflicts,
    mediumConflicts,
    score: analysis.score,
    grade: analysis.grade,
  };
}

/**
 * Create a simple hierarchical layout
 */
export function applyHierarchicalLayout(
  nodes: Node<GraphNodeData>[],
  edges: Edge[]
): Node<GraphNodeData>[] {
  const functionNodes = nodes.filter(n => n.data.type === 'function');
  const storageNodes = nodes.filter(n => n.data.type === 'storage');

  // Position function nodes on the left
  functionNodes.forEach((node, index) => {
    node.position = {
      x: 50,
      y: 80 + index * 120,
    };
  });

  // Position storage nodes on the right
  storageNodes.forEach((node, index) => {
    node.position = {
      x: 450,
      y: 80 + index * 100,
    };
  });

  return [...functionNodes, ...storageNodes];
}

/**
 * Create mini graph data for preview
 */
export function createMiniGraph(analysis: ParallelAnalysisResult): {
  parallelCount: number;
  conflictCount: number;
  connectionCount: number;
} {
  return {
    parallelCount: analysis.functions.filter(f => f.canParallelize).length,
    conflictCount: analysis.functions.filter(f => !f.canParallelize).length,
    connectionCount: analysis.functions.reduce((acc, f) => acc + f.reads.length + f.writes.length, 0),
  };
}

/**
 * Get optimization priority for sorting
 */
export function getOptimizationPriority(analysis: ParallelAnalysisResult): string[] {
  const priorities: { item: string; score: number }[] = [];

  // Add high-severity conflicts first
  analysis.conflicts
    .filter(c => c.severity === 'high')
    .forEach(c => {
      priorities.push({
        item: `Fix write conflict on '${c.variable}' between ${c.functions.join(', ')}`,
        score: 100,
      });
    });

  // Add functions with many conflicts
  analysis.functions
    .filter(f => f.conflictsWith.length > 1)
    .forEach(f => {
      priorities.push({
        item: `Refactor ${f.name}() - conflicts with ${f.conflictsWith.length} functions`,
        score: 80,
      });
    });

  // Add medium-severity conflicts
  analysis.conflicts
    .filter(c => c.severity === 'medium')
    .forEach(c => {
      priorities.push({
        item: `Review read-write dependency on '${c.variable}'`,
        score: 60,
      });
    });

  return priorities
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(p => p.item);
}

/**
 * Export graph as JSON for sharing/saving
 */
export function exportGraphData(analysis: ParallelAnalysisResult): string {
  const { nodes, edges } = createFlowGraph(analysis);
  const stats = getGraphStats(analysis);

  return JSON.stringify({
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      score: analysis.score,
      grade: analysis.grade,
    },
    stats,
    graph: { nodes, edges },
    conflicts: analysis.conflicts,
    suggestions: analysis.suggestions,
  }, null, 2);
}
