"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * `/settings` previously rendered a mock profile page (hard-coded
 * "Lea" / "moline acres" placeholder data left over from the UI kit).
 * The real profile editor lives at `/settings/account`, so this route
 * just redirects there — landing on `/settings` from the sidebar
 * Tooltip / left-side menu now opens the actual account settings
 * directly.
 */
export default function SettingsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings/account");
  }, [router]);
  return null;
}
