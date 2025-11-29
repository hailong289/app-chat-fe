"use client";

import { Switch } from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <Switch
      size="sm"
      isSelected={isDark}
      onValueChange={(checked) => setTheme(checked ? "dark" : "light")}
      color="primary"
      thumbIcon={({ isSelected, className }) =>
        isSelected ? (
          <span className={className}>🌙</span>
        ) : (
          <span className={className}>☀️</span>
        )
      }
    >
      {/* {isDark ? "Dark" : "Light"} */}
    </Switch>
  );
}
