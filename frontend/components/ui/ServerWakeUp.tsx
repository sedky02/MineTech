"use client";

import { useEffect } from "react";
import { wakeServer } from "@/lib/api/wake";

/** Mounted once in the root layout: pings the backend in the background on first load. */
export function ServerWakeUp() {
  useEffect(() => {
    void wakeServer();
  }, []);
  return null;
}
