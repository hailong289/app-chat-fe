"use client";

import dynamic from "next/dynamic";

// Import Editor dưới dạng dynamic, tắt SSR với loading state
export const DynamicEditor = dynamic(() => import("./BlockNoteEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-screen-lg mx-auto p-8 space-y-6 animate-pulse select-none">
      {/* Toolbar Skeleton */}
      <div className="w-full h-10 bg-default-100 rounded-lg opacity-50" />

      {/* Title Area */}
      <div className="space-y-2 pt-4">
        <div className="w-3/4 h-10 bg-default-200 rounded-md" />
        <div className="w-1/3 h-4 bg-default-100 rounded-md" />
      </div>

      {/* Content Area */}
      <div className="space-y-3 pt-4">
        <div className="w-full h-4 bg-default-100 rounded" />
        <div className="w-[95%] h-4 bg-default-100 rounded" />
        <div className="w-[90%] h-4 bg-default-100 rounded" />
        <div className="w-[98%] h-4 bg-default-100 rounded" />
      </div>

      {/* Block/Card Skeleton */}
      <div className="w-full h-32 bg-default-50 rounded-xl border border-default-100 mt-4" />
    </div>
  ),
});
