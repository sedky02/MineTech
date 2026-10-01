import type { Metadata } from "next";
import { HostView } from "@/components/host/HostView";

export const metadata: Metadata = { title: "Host", robots: { index: false } };

export default function HostPage() {
  return <HostView />;
}
