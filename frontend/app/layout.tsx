import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Sarpanch } from "next/font/google";
import { MinecraftSky } from "@/components/ui/MinecraftSky";
import { ServerWakeUp } from "@/components/ui/ServerWakeUp";
import { EVENT_NAME } from "@/lib/config";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const sarpanch = Sarpanch({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-sarpanch",
});

export const metadata: Metadata = {
  title: `${EVENT_NAME}`,
  description: `A live Q&A for ${EVENT_NAME}. Ask questions and see them on screen!`,
};

export const viewport: Viewport = {
  themeColor: "#14151b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pressStart.variable} ${sarpanch.variable}`}>
      <body>
        <ServerWakeUp />
        <MinecraftSky />
        {children}
      </body>
    </html>
  );
}
