"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";

interface SlaComplianceWidgetProps {
  projectId: string;
}

export function SlaComplianceWidget({ projectId }: SlaComplianceWidgetProps) {
  const { workspaceId } = useAuthStore();
  const { data } = trpc.sla.getDashboard.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  if (!data || data.total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          SLA Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{data.compliancePercent}%</div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="text-green-500">{data.met} met</span>
          <span className="text-yellow-500">{data.atRisk} at risk</span>
          <span className="text-red-500">{data.breached} breached</span>
        </div>
      </CardContent>
    </Card>
  );
}
