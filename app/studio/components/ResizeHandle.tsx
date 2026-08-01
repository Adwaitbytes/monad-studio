"use client";

import React from "react";
import type { ResizeEdge } from "@/lib/useResizable";

interface Props {
  edge: ResizeEdge;
  isDragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Double-click restores the default size. */
  onReset?: () => void;
  label: string;
}

/**
 * The grab strip between two panes.
 *
 * The hit area is deliberately wider than the visible line: a 1px target is
 * painful to grab, so the strip is 5px and only paints on hover or while
 * dragging. It stays keyboard-reachable and exposes a separator role.
 */
export function ResizeHandle({ edge, isDragging, onPointerDown, onReset, label }: Props) {
  const vertical = edge !== "top";

  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      className={`
        group relative flex-shrink-0 z-20 touch-none
        ${vertical ? "w-[5px] cursor-col-resize" : "h-[5px] cursor-row-resize"}
        focus:outline-none
      `}
      title={`${label} (double-click to reset)`}
    >
      <div
        className={`
          absolute transition-colors duration-150
          ${vertical ? "inset-y-0 left-1/2 -translate-x-1/2 w-[2px]" : "inset-x-0 top-1/2 -translate-y-1/2 h-[2px]"}
          ${isDragging ? "bg-purple-500" : "bg-transparent group-hover:bg-purple-500/50 group-focus:bg-purple-500/50"}
        `}
      />
    </div>
  );
}
