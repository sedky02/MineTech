import { io, type Socket } from "socket.io-client";
import { WS_URL } from "@/lib/config";

/**
 * Moderator and host sockets authenticate with the HTTP-only auth cookie
 * (withCredentials); the server picks their room from their role. The
 * presentation screen asks for the public "presentation" room.
 */
export function createSocket(kind: "internal" | "presentation"): Socket {
  return io(WS_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: kind === "presentation" ? { room: "presentation" } : {},
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
