"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Meridian masthead theme toggle — 34px circular bordered button, ◐ glyph.
 * Renders a stable placeholder until mounted to avoid a hydration mismatch
 * (next-themes only knows the real theme client-side).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const label = mounted
    ? theme === "dark"
      ? "Switch to light mode"
      : "Switch to dark mode"
    : "Toggle theme";

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={label}
      aria-label={label}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border text-[15px] text-muted-foreground"
    >
      ◐
    </button>
  );
}
