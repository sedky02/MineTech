import type { Metadata } from "next";
import { PresentationScreen } from "@/components/presentation/PresentationScreen";

export const metadata: Metadata = { title: "Presentation", robots: { index: false } };

export default function PresentationPage() {
  return <PresentationScreen />;
}
