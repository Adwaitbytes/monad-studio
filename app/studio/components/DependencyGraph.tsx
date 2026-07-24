'use client';

import React, { useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { GraphNodeData } from '@/lib/dependencyGraph';

interface GraphStats {
  totalFunctions: number;
  parallelFunctions: number;
  conflictFunctions: number;
  totalStorageVars: number;
  highConflicts: number;
  mediumConflicts: number;
}

interface DependencyGraphProps {
  nodes: Node[];
  edges: Edge[];
  stats: GraphStats;
}

// Custom node component for functions
const FunctionNode = ({ data }: { data: GraphNodeData }) => {
  const bgColor = data.parallelizable ? 'bg-green-600' : 'bg-red-600';
  const borderColor = data.parallelizable ? 'border-green-400' : 'border-red-400';
  const shadowColor = data.parallelizable
    ? 'shadow-green-500/30'
    : 'shadow-red-500/30';

  return (
    <div
      className={`px-4 py-2 rounded-lg ${bgColor} ${borderColor} border-2 shadow-lg ${shadowColor} min-w-[120px] text-center`}
    >
      <div className="text-white font-bold text-sm">{data.label}</div>
      {data.reads && data.reads.length > 0 && (
        <div className="text-xs text-blue-200 mt-1">
          Reads: {data.reads.join(', ')}
        </div>
      )}
      {data.writes && data.writes.length > 0 && (
        <div className="text-xs text-red-200 mt-1">
          Writes: {data.writes.join(', ')}
        </div>
      )}
    </div>
  );
};

// Custom node component for storage
const StorageNode = ({ data }: { data: GraphNodeData }) => {
  const bgColor = data.parallelizable ? 'bg-purple-600' : 'bg-orange-600';
  const borderColor = data.parallelizable ? 'border-purple-400' : 'border-orange-400';

  return (
    <div
      className={`w-20 h-20 rounded-full ${bgColor} ${borderColor} border-2 flex items-center justify-center shadow-lg`}
    >
      <div className="text-white font-bold text-xs text-center px-1">
        {data.label}
      </div>
    </div>
  );
};

const nodeTypes = {
  function: FunctionNode,
  storage: StorageNode,
  custom: FunctionNode, // fallback
};

export function DependencyGraph({ nodes: initialNodes, edges: initialEdges, stats }: DependencyGraphProps) {
  // Process nodes to add custom types
  const processedNodes = useMemo(() => {
    return initialNodes.map((node) => {
      const isFunction = node.data.type === 'function';
      const baseY = 100;
      const spacing = 150;

      // Simple layout: functions on left, storage on right
      const functionNodes = initialNodes.filter(n => n.data.type === 'function');
      const storageNodes = initialNodes.filter(n => n.data.type === 'storage');

      let x, y;
      if (isFunction) {
        const funcIndex = functionNodes.findIndex(n => n.id === node.id);
        x = 100;
        y = baseY + funcIndex * spacing;
      } else {
        const storageIndex = storageNodes.findIndex(n => n.id === node.id);
        x = 500;
        y = baseY + storageIndex * (spacing - 30);
      }

      return {
        ...node,
        type: isFunction ? 'function' : 'storage',
        position: { x, y },
      };
    });
  }, [initialNodes]);

  // Process edges to add styling
  const processedEdges = useMemo(() => {
    return initialEdges.map((edge) => ({
      ...edge,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.style?.stroke || '#888',
      },
    }));
  }, [initialEdges]);

  const [nodes, , onNodesChange] = useNodesState(processedNodes);
  const [edges, , onEdgesChange] = useEdgesState(processedEdges);

  return (
    <div className="w-full h-full bg-[#0a0f16] rounded-lg overflow-hidden border border-gray-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          animated: true,
        }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls className="bg-gray-900 border-gray-700" />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.parallelizable) return '#22c55e';
            return '#ef4444';
          }}
          className="bg-gray-900 border border-gray-700"
        />

        {/* Legend Panel */}
        <Panel position="top-right" className="bg-gray-900/90 p-3 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-400 space-y-2">
            <div className="font-semibold text-white mb-2">Legend</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>Parallelizable ({stats.parallelFunctions})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>Has Conflicts ({stats.conflictFunctions})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>Storage ({stats.totalStorageVars})</span>
            </div>
            <div className="border-t border-gray-700 mt-2 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-blue-500"></div>
                <span>Read</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500"></div>
                <span>Write</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-yellow-500 border-dashed border-b-2 border-yellow-500"></div>
                <span>Conflict</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Stats Panel */}
        <Panel position="bottom-right" className="bg-gray-900/90 p-3 rounded-lg border border-gray-700">
          <div className="text-xs space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">High Conflicts:</span>
              <span className="text-red-400 font-bold">{stats.highConflicts}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Medium Conflicts:</span>
              <span className="text-yellow-400 font-bold">{stats.mediumConflicts}</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default DependencyGraph;
