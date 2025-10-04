// app/page.tsx – Rewrite of the provided static HTML using Next.js App Router + HeroUI
// Assumes you already set up Tailwind v4 and wrapped the app with <HeroUIProvider /> in app/providers.tsx
"use client";
import { useCounterStore } from "@/store/useCounterStore";
import { Button } from "@heroui/button";
import Image from "next/image";

export default function Page() {

  return (
    <div className="w-full h-screen flex items-center justify-center bg-light">
      <div className="text-center max-w-2xl px-8">
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Chat Icon" width={100} height={100} />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Chào mừng đến với Chat App
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Ứng dụng chat hiện đại giúp bạn kết nối và trò chuyện với bạn bè, 
            đồng nghiệp một cách dễ dàng và tiện lợi.
          </p>
        </div>
      </div>
    </div>
  );
}
