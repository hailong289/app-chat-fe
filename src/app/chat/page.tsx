"use client";

import { Suspense } from "react";
import { Skeleton } from "@heroui/react";
import { ChatPageContent } from "@/components/chat/ChatPageContent";

export default function ChatPage() {
  const Fallback = (
    <div className="h-screen w-full flex items-center justify-center bg-light dark:bg-slate-900">
      <div className="w-full max-w-3xl px-6 space-y-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <div className="flex-1 space-y-3 max-w-md">
              <Skeleton className="h-3 w-1/4 rounded-md ml-auto" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-5/6 rounded-lg" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );

  return (
    <Suspense fallback={Fallback}>
      <ChatPageContent />
    </Suspense>
  );
}
