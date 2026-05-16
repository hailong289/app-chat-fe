"use client";

import { useLayoutEffect } from "react";
import { applyEmbedAccessTokenFromUrl } from "@/libs/embed-token-auth";

/**
 * Layout cho /docs, /flash-card, /todo khi nhúng WebView (RN):
 * `/path?token=<accessJwt>` → auth + ẩn menu trái (client-layout).
 */
export default function EmbedTokenLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useLayoutEffect(() => {
    applyEmbedAccessTokenFromUrl();
  }, []);

  return children;
}
