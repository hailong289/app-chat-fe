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
          <FirebaseProvider>
            <NotificationPermission />

            <ClientLayout>{children}</ClientLayout>
          </FirebaseProvider>
        </Providers>
      </body>
    </html>
  );
}
