"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True once the client has taken over from the server-rendered markup.
 *
 * Persisted zustand stores (theme, wallet) read from localStorage, which the
 * server cannot see, so components that depend on them must not paint until
 * hydration completes. useSyncExternalStore expresses that directly instead of
 * flipping state inside an effect, which React 19 flags as a cascading render.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
