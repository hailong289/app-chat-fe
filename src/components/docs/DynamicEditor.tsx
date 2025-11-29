// src/components/DynamicEditor.tsx
"use client";

import dynamic from "next/dynamic";

// Import Editor dưới dạng dynamic, tắt SSR
export const DynamicEditor = dynamic(() => import("./Editor"), {
  ssr: false,
});
