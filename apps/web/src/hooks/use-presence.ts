"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Viewer {
  userId: string;
  userName: string;
  avatarUrl: string | null;
}

export function usePresence(page: string | undefined) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!page) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;

    const socket = io(API_URL, {
      path: "/api/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("presence:viewing", {
        page,
        userName: user?.name || "User",
        avatarUrl: user?.avatarUrl || null,
      });
    });

    socket.on("presence:viewers", (data: { page: string; userId: string; userName?: string; avatarUrl?: string | null; action: "join" | "leave" }) => {
      if (data.page !== page) return;
      if (data.userId === user?.id) return; // Skip self

      setViewers((prev) => {
        if (data.action === "leave") {
          return prev.filter((v) => v.userId !== data.userId);
        }
        // join
        if (prev.find((v) => v.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, userName: data.userName || "User", avatarUrl: data.avatarUrl || null }];
      });
    });

    return () => {
      socket.emit("presence:leave", { page });
      socket.disconnect();
      socketRef.current = null;
      setViewers([]);
    };
  }, [page, user?.id, user?.name, user?.avatarUrl]);

  return viewers;
}
