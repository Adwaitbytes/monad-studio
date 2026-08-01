"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHydrated } from "./useHydrated";

export type ResizeEdge = "left" | "right" | "top";

interface Options {
  initial: number;
  min: number;
  max: number;
  /** Which edge the handle sits on, i.e. which way dragging grows the panel. */
  edge: ResizeEdge;
  /** localStorage key. Omit to keep the size for the session only. */
  storageKey?: string;
}

/**
 * Drag-to-resize for docked panels.
 *
 * Pointer events are captured on the handle so a fast drag that outruns the
 * cursor does not drop the gesture, and the value is clamped on every move so
 * a panel can never be dragged to zero or past the viewport.
 *
 * The persisted size is read during render once hydrated rather than pushed in
 * from an effect: the server cannot see localStorage, so writing it back in an
 * effect would render the default first and then immediately re-render.
 */
export function useResizable({ initial, min, max, edge, storageKey }: Options) {
  const hydrated = useHydrated();
  const [dragged, setDragged] = useState<number | null>(null);
  const [isDragging, setDragging] = useState(false);
  const frame = useRef<number | null>(null);

  const stored = useMemo(() => {
    if (!hydrated || !storageKey) return null;
    const value = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  }, [hydrated, storageKey, min, max]);

  const size = dragged ?? stored ?? initial;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const handle = event.currentTarget;
      // Capture keeps the gesture alive when a fast drag outruns the cursor.
      // Not every environment supplies a capturable pointer id, and losing
      // capture is far better than losing the drag.
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        /* proceed without capture */
      }
      setDragging(true);

      const startPos = edge === "top" ? event.clientY : event.clientX;
      const startSize = size;
      let latest = startSize;

      const move = (e: PointerEvent) => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const pos = edge === "top" ? e.clientY : e.clientX;
          // A handle on the left of a right-docked panel grows it as the
          // pointer moves left, hence the inverted delta.
          const delta = edge === "right" ? pos - startPos : startPos - pos;
          latest = Math.min(max, Math.max(min, startSize + delta));
          setDragged(latest);
        });
      };

      const up = (e: PointerEvent) => {
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch {
          /* capture was never taken */
        }
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        setDragging(false);
        if (storageKey) window.localStorage.setItem(storageKey, String(latest));
      };

      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    },
    [edge, max, min, size, storageKey]
  );

  const reset = useCallback(() => {
    setDragged(initial);
    if (storageKey) window.localStorage.setItem(storageKey, String(initial));
  }, [initial, storageKey]);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return { size, isDragging, onPointerDown, reset };
}
