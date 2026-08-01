'use client';

import React, { useState } from 'react';

interface Suggestion {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentCode?: string;
  suggestedCode?: string;
  gasImpact: string;
}

interface OptimizationPanelProps {
  suggestions: Suggestion[];
}

export function OptimizationPanel({ suggestions }: OptimizationPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-text-secondary border-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'storage_packing':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'batch_operation':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        );
      case 'state_separation':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'mapping_optimization':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        );
      case 'event_optimization':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Excellent Optimization!</h3>
        <p className="text-text-secondary max-w-md">
          Your contract is well-optimized for Monad&apos;s parallel execution.
          No immediate improvements needed.
        </p>
      </div>
    );
  }

  // Sort by priority
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-4 panel-surface/50 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-text-secondary">High Priority:</span>
            <span className="text-white font-bold">
              {suggestions.filter(s => s.priority === 'high').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-text-secondary">Medium:</span>
            <span className="text-white font-bold">
              {suggestions.filter(s => s.priority === 'medium').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-text-secondary">Low:</span>
            <span className="text-white font-bold">
              {suggestions.filter(s => s.priority === 'low').length}
            </span>
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      {sortedSuggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`rounded-lg border overflow-hidden transition-all ${
            expandedIndex === index ? 'border-purple-500/50' : 'border-border-subtle'
          }`}
        >
          {/* Header */}
          <button
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            className="w-full p-4 flex items-center gap-4 panel-surface/50 hover:bg-border-subtle/50 transition-colors"
          >
            {/* Icon */}
            <div className={`p-2 rounded-lg ${getPriorityColor(suggestion.priority)}`}>
              {getTypeIcon(suggestion.type)}
            </div>

            {/* Title and Description */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{suggestion.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(suggestion.priority)}`}>
                  {suggestion.priority.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1 line-clamp-1">{suggestion.description}</p>
            </div>

            {/* Gas Impact */}
            <div className="text-right">
              <div className="text-xs text-text-muted">Gas Impact</div>
              <div className="text-sm text-green-400">{suggestion.gasImpact}</div>
            </div>

            {/* Expand Icon */}
            <svg
              className={`w-5 h-5 text-text-secondary transition-transform ${
                expandedIndex === index ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded Content */}
          {expandedIndex === index && (
            <div className="p-4 panel-sunken/50 border-t border-border-subtle space-y-4">
              <p className="text-sm text-text-primary">{suggestion.description}</p>

              {/* Code Comparison */}
              {suggestion.currentCode && suggestion.suggestedCode && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Current Code */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-red-400">Current Code</span>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <code className="text-sm text-red-300 font-mono">{suggestion.currentCode}</code>
                    </div>
                  </div>

                  {/* Suggested Code */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-green-400">Suggested Code</span>
                      <button
                        onClick={() => copyCode(suggestion.suggestedCode!, index)}
                        className="text-xs text-text-secondary hover:text-white flex items-center gap-1"
                      >
                        {copiedIndex === index ? (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <code className="text-sm text-green-300 font-mono">{suggestion.suggestedCode}</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Type Badge */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted">Type:</span>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                  {suggestion.type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Monad Tips */}
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/30 mt-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-white mb-1">Monad Optimization Tips</h4>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• Use mappings keyed by user address for natural parallelization</li>
              <li>• Avoid shared counters - consider per-user nonces instead</li>
              <li>• Batch operations into single transactions when possible</li>
              <li>• Use events for logging instead of storage arrays</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OptimizationPanel;
