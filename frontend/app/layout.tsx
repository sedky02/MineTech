import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, Press_Start_2P } from "next/font/google";
import { EVENT_NAME } from "@/lib/config";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixelify",
});

export const metadata: Metadata = {
  title: `${EVENT_NAME} — Ask the speakers`,
  description: "Send your questions to the speakers of the club tech event.",
};

export const viewport: Viewport = {
  themeColor: "#14151b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pressStart.variable} ${pixelify.variable}`}>
      <body>{children}</body>
    </html>
  );
}
