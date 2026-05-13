import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${GeistSans.className} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
