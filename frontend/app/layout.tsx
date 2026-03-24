import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import StoreProvider from "@/lib/store/StoreProvider";
import { Analytics } from "@vercel/analytics/next";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trackly | Track LLM Costs & Usage",
  description: "Track your LLM costs and usage in real-time",
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full dark",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-mono",
        jetbrainsMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <Auth0Provider>
          <StoreProvider>
            <TooltipProvider>
              {children}
              <Analytics />
              <Toaster position="bottom-right" theme="dark" />
            </TooltipProvider>
          </StoreProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
