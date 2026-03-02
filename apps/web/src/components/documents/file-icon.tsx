"use client";

import {
  FileText,
  FileSpreadsheet,
  Image,
  Archive,
  File,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, { icon: typeof File; color: string }> = {
  pdf: { icon: FileText, color: "text-red-400" },
  word: { icon: FileText, color: "text-blue-400" },
  spreadsheet: { icon: FileSpreadsheet, color: "text-green-400" },
  image: { icon: Image, color: "text-purple-400" },
  archive: { icon: Archive, color: "text-yellow-400" },
  presentation: { icon: Presentation, color: "text-orange-400" },
  other: { icon: File, color: "text-slate-400" },
};

interface FileIconProps {
  fileType: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-8 w-8" };

export function FileIcon({ fileType, size = "md", className }: FileIconProps) {
  const { icon: Icon, color } = iconMap[fileType] || iconMap.other;
  return <Icon className={cn(sizeMap[size], color, className)} />;
}
