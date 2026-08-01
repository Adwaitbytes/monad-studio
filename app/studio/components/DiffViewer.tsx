'use client';

import React, { useState, useMemo } from 'react';
import { Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';

interface CodeChange {
  type: 'pragma' | 'import' | 'security' | 'pattern' | 'optimization' | 'license';
  line: number;
  original: string;
  replacement: string;
  reason: string;
  autoFixed: boolean;
}

interface DiffViewerProps {
  original: string;
  modified: string;
  changes: CodeChange[];
  onApplyChange?: (index: number) => void;
  onApplyAll?: () => void;
  isDark?: boolean;
}

export function DiffViewer({
  original,
  modified,
  changes,
  onApplyChange,
  onApplyAll,
  isDark = true,
}: DiffViewerProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set());

  // Toggle change expansion
  const toggleChange = (index: number) => {
    setExpandedChanges((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Copy code to clipboard
  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get change type color
  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'security':
        return 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30';
      case 'pragma':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'license':
        return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'pattern':
        return 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'optimization':
        return 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30';
      default:
        return 'text-text-secondary bg-gray-500/10 border-gray-500/30';
    }
  };

  // Simple line-by-line diff display
  const { originalLines, modifiedLines } = useMemo(() => {
    return {
      originalLines: original.split('\n'),
      modifiedLines: modified.split('\n'),
    };
  }, [original, modified]);

  // Group changes by whether they're auto-fixed
  const { autoFixedChanges, manualChanges } = useMemo(() => {
    const autoFixed = changes.filter((c) => c.autoFixed);
    const manual = changes.filter((c) => !c.autoFixed);
    return { autoFixedChanges: autoFixed, manualChanges: manual };
  }, [changes]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header Summary */}
      <div
        className={`p-3 border-b flex items-center justify-between ${
          isDark ? 'border-white/10 panel-surface/50' : 'border-border-subtle bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className={`text-xs ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
              Auto-fixed: {autoFixedChanges.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className={`text-xs ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
              Manual review: {manualChanges.length}
            </span>
          </div>
        </div>
        {onApplyAll && changes.length > 0 && (
          <button
            onClick={onApplyAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            Apply All Changes
          </button>
        )}
      </div>

      {/* Changes List */}
      <div className={`flex-1 overflow-auto ${isDark ? 'panel-sunken' : 'bg-white'}`}>
        {changes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-text-primary' : 'text-gray-900'}`}>
                No Changes Needed!
              </h3>
              <p className={`text-sm ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
                This contract is already compatible with Monad.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {changes.map((change, index) => (
              <div
                key={index}
                className={`rounded-lg border overflow-hidden ${
                  isDark ? 'border-white/10 panel-surface/50' : 'border-border-subtle bg-gray-50'
                }`}
              >
                {/* Change Header */}
                <button
                  onClick={() => toggleChange(index)}
                  className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                  }`}
                >
                  {expandedChanges.has(index) ? (
                    <ChevronDown size={16} className="text-text-secondary" />
                  ) : (
                    <ChevronRight size={16} className="text-text-secondary" />
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${getChangeTypeColor(
                          change.type
                        )}`}
                      >
                        {change.type.toUpperCase()}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-text-muted' : 'text-text-secondary'}`}>
                        Line {change.line}
                      </span>
                      {change.autoFixed && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30">
                          AUTO-FIXED
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${isDark ? 'text-text-primary' : 'text-text-primary'}`}>
                      {change.reason}
                    </p>
                  </div>

                  {onApplyChange && !change.autoFixed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onApplyChange(index);
                      }}
                      className="px-2 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 text-text-primary"
                    >
                      Apply
                    </button>
                  )}
                </button>

                {/* Expanded Details */}
                {expandedChanges.has(index) && (
                  <div className={`p-3 border-t ${isDark ? 'border-white/5' : 'border-border-subtle'}`}>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Original */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-red-600 dark:text-red-400">Original</span>
                        </div>
                        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                          <code className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                            {change.original || '(empty)'}
                          </code>
                        </div>
                      </div>

                      {/* Replacement */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">Replacement</span>
                          <button
                            onClick={() => copyCode(change.replacement, index)}
                            className={`text-xs flex items-center gap-1 transition-colors ${
                              isDark
                                ? 'text-text-secondary hover:text-text-primary'
                                : 'text-text-muted hover:text-gray-900'
                            }`}
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check size={12} />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                          <code className="text-xs text-green-700 dark:text-green-300 font-mono whitespace-pre-wrap break-all">
                            {change.replacement}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side-by-Side Code Preview */}
      {changes.length > 0 && (
        <div className={`border-t ${isDark ? 'border-white/10' : 'border-border-subtle'}`}>
          <div
            className={`p-2 text-xs font-medium ${
              isDark ? 'text-text-secondary panel-surface/50' : 'text-text-secondary bg-gray-50'
            }`}
          >
            Full Code Preview
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-800 max-h-64 overflow-auto">
            {/* Original Code */}
            <div className={`p-2 ${isDark ? 'bg-red-950/20' : 'bg-red-50'}`}>
              <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-2">Original</div>
              <pre
                className={`text-xs font-mono overflow-auto ${
                  isDark ? 'text-text-primary' : 'text-text-primary'
                }`}
              >
                {originalLines.slice(0, 30).map((line, i) => (
                  <div key={i} className="flex">
                    <span
                      className={`w-8 text-right pr-2 select-none ${
                        isDark ? 'text-text-secondary' : 'text-text-secondary'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
                {originalLines.length > 30 && (
                  <div className="text-text-muted italic">
                    ... {originalLines.length - 30} more lines
                  </div>
                )}
              </pre>
            </div>

            {/* Modified Code */}
            <div className={`p-2 ${isDark ? 'bg-green-950/20' : 'bg-green-50'}`}>
              <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">Monad Optimized</div>
              <pre
                className={`text-xs font-mono overflow-auto ${
                  isDark ? 'text-text-primary' : 'text-text-primary'
                }`}
              >
                {modifiedLines.slice(0, 30).map((line, i) => (
                  <div key={i} className="flex">
                    <span
                      className={`w-8 text-right pr-2 select-none ${
                        isDark ? 'text-text-secondary' : 'text-text-secondary'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
                {modifiedLines.length > 30 && (
                  <div className="text-text-muted italic">
                    ... {modifiedLines.length - 30} more lines
                  </div>
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiffViewer;
