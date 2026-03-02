"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Loader2, Bell, AlertCircle, Info, ArrowRight, RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiSmartNotificationsProps {
  workspaceId: string;
}

const tierConfig = {
  urgent: { icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Urgent" },
  important: { icon: Bell, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "Important" },
  fyi: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "FYI" },
};

export function AiSmartNotifications({ workspaceId }: AiSmartNotificationsProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.ai.rankNotifications.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(err.message),
  });

  const handleAnalyze = () => {
    mutation.mutate({ workspaceId });
  };

  const grouped = result?.ranked?.reduce((acc: any, item: any) => {
    const tier = item.tier || "fyi";
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(item);
    return acc;
  }, {} as Record<string, any[]>) || {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleAnalyze}>
          <Sparkles className="h-4 w-4" />
          <Bell className="h-4 w-4" />
          Smart Digest
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            AI Smart Notifications
          </DialogTitle>
        </DialogHeader>

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyzing your notifications...</span>
          </div>
        )}

        {result && (
          <div>
            <div className="space-y-4 pr-4">
              {/* Daily Digest */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium mb-1">Daily Digest</p>
                <p className="text-sm text-muted-foreground">{result.dailyDigest}</p>
              </div>

              {/* Tiered Notifications */}
              {(["urgent", "important", "fyi"] as const).map((tier) => {
                const items = grouped[tier];
                if (!items?.length) return null;
                const config = tierConfig[tier];
                const Icon = config.icon;

                return (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                      <Badge variant="outline" className="text-xs">{items.length}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item: any, i: number) => (
                        <div key={i} className={`p-3 rounded-lg border ${config.bg}`}>
                          <p className="text-sm">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {Object.keys(grouped).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications to analyze</p>
                </div>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAnalyze}>
              <RefreshCw className="h-3.5 w-3.5" />
              Re-analyze
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
