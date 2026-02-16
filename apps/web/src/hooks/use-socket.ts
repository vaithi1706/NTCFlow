"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/api/trpc";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useSocket(projectId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;

    const socket = io(API_URL, {
      path: "/api/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (projectId) {
        socket.emit("join:project", projectId);
      }
    });

    const invalidateBoard = () => {
      if (projectId) {
        utils.board.getColumns.invalidate({ projectId });
      }
    };

    socket.on("task_created", invalidateBoard);
    socket.on("task_updated", invalidateBoard);
    socket.on("task_moved", invalidateBoard);
    socket.on("task_deleted", invalidateBoard);
    socket.on("comment_created", (data: any) => {
      invalidateBoard();
      if (data?.taskId) {
        utils.task.getById.invalidate({ id: data.taskId });
      }
    });

    return () => {
      if (projectId) {
        socket.emit("leave:project", projectId);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, utils]);

  return socketRef;
}
