// app/layout.tsx
import type { Metadata } from "next";

// globals.css includes @tailwind directives
// adjust the path if necessary
import "@/styles/globals.css";
import { Providers } from "./providers";
import "@/styles/main.scss";
import { ClientLayout } from "./client-layout";
import { FirebaseProvider } from "@/components/providers/firebase.provider";
import NotificationPermission from "@/components/notifications/NotificationPermission";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { SocketEventChatGlobal } from "@/components/chat/socketChatEventGlobal";
import { InitAppChat } from "@/components/chat/initAppChat.provider";
export const metadata: Metadata = {
  title: "ChatApp",
  description: "Ứng dụng chat hiện đại",
};

// Force dynamic rendering for every route. This is an authenticated
// chat app — there is nothing meaningful to statically prerender at
// build time, and the prerender pass had been intermittently choking
// on client-only pages (e.g. /todo/projects → ENOENT
// build-manifest.json) when their provider chain touched storage or
// triggered hooks that don't tolerate SSR. Skipping prerender keeps
// the build deterministic and matches how the app actually runs.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SocketProvider namespaces={["/chat", "/doc", "/call"]}>
          <Providers>
            <FirebaseProvider>
              <NotificationPermission />
              <SocketEventChatGlobal />
              <InitAppChat />
              <ClientLayout>{children}</ClientLayout>
            </FirebaseProvider>
          </Providers>
        </SocketProvider>
      </body>
    </html>
  );
}
