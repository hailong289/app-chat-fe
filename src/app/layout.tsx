// app/layout.tsx
import type { Metadata } from "next";

// globals.css includes @tailwind directives
// adjust the path if necessary
import "@/styles/globals.css";
import { Providers } from "./providers";
import "@/styles/main.scss";
import { ClientLayout } from "./client-layout";
import { FirebaseProvider } from "@/components/providers/firebase.provider";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { SocketEventGlobal } from "@/components/socketEventGlobal";
import SocketStatusIndicator from "@/components/socket/SocketStatusIndicator";
import NotificationPermission from "@/components/notifications/NotificationPermission";
import { InitApp } from "@/components/providers/initApp.provider";
import { RouteGuard } from "@/components/RouteGuard";

export const metadata: Metadata = {
  title: "ChatApp",
  description: "Ứng dụng chat hiện đại",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <RouteGuard>
            <FirebaseProvider>
              <SocketProvider>
                <SocketEventGlobal />
                <SocketStatusIndicator />
                <NotificationPermission />
                <InitApp />
                <ClientLayout>{children}</ClientLayout>
              </SocketProvider>
            </FirebaseProvider>
          </RouteGuard>
        </Providers>
      </body>
    </html>
  );
}
