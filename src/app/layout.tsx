// app/layout.tsx
import type { Metadata } from "next";

// globals.css includes @tailwind directives
// adjust the path if necessary
import "@/styles/globals.css";
import {Providers} from "./providers";

export const metadata: Metadata = {
  title: "ChatApp",
  description: "Ứng dụng chat hiện đại",
};

export default function RootLayout({children}: { readonly children: React.ReactNode }) {
  return (
    <html lang="en" >
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}