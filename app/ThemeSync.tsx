"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/store";

/**
 * Mirrors the theme store onto <html data-theme>, which is what the CSS tokens
 * in globals.css key off. Keeping the source of truth in one store and the
 * application in one place stops panels from drifting out of sync with the
 * rest of the interface.
 */
export function ThemeSync() {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return null;
}
