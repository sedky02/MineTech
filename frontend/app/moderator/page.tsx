import type { Metadata } from "next";
import { Dashboard } from "@/components/moderator/Dashboard";

export const metadata: Metadata = { title: "Moderator", robots: { index: false } };

export default function ModeratorPage() {
  return <Dashboard />;
}
