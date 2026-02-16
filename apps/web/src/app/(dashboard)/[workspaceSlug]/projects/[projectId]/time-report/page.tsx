"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { trpc } from "@/lib/api/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, Users, ListTodo, Calendar, Loader2, BarChart3, Timer,
} from "lucide-react";
import { PdfExportButton } from "@/components/shared/pdf-export-button";
import { format } from "date-fns";

export default function TimeReportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [groupBy, setGroupBy] = useState<"user" | "task" | "date">("user");

  const { data: project } = trpc.project.getById.useQuery({ id: projectId });

  const { data: report, isLoading } = trpc.timeTracking.getTimeReport.useQuery({
    projectId,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate).toISOString() : undefined,
    groupBy,
  });

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  const breadcrumbs = [
    { label: "DKFlow", href: "/home" },
    { label: project?.name || "Project" },
    { label: "Time Report" },
  ];

  const maxUserHours = useMemo(() => {
    if (!report?.byUser?.length) return 1;
    return Math.max(...report.byUser.map((u: any) => u.hours));
  }, [report]);

  return (
    <>
      <TopBar
        breadcrumbs={breadcrumbs}
        showViewSwitcher
        currentView="time-report"
        onViewChange={handleViewChange}
      />

      <div className="flex-1 overflow-auto p-6" id="time-report-content">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Time Report</h1>
            <p className="text-sm text-muted-foreground mt-1">Track logged time across tasks and team members</p>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 w-36" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 w-36" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="self-end">
              <PdfExportButton targetId="time-report-content" filename="time-report" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{(report?.totalLogged || 0).toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">Total Logged</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{(report?.totalEstimate || 0).toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">Total Estimated</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {report?.totalEstimate
                          ? `${Math.round((report.totalLogged / report.totalEstimate) * 100)}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Estimate Used</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Estimate vs Actual bar */}
            {report && report.totalEstimate > 0 && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-3">Estimate vs Actual</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Estimated</span>
                        <span>{report.totalEstimate.toFixed(1)}h</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: "100%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Logged</span>
                        <span>{report.totalLogged.toFixed(1)}h</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${report.totalLogged > report.totalEstimate ? "bg-red-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min((report.totalLogged / report.totalEstimate) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grouped data */}
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <TabsList>
                <TabsTrigger value="user"><Users className="h-3.5 w-3.5 mr-1.5" />By User</TabsTrigger>
                <TabsTrigger value="task"><ListTodo className="h-3.5 w-3.5 mr-1.5" />By Task</TabsTrigger>
                <TabsTrigger value="date"><Calendar className="h-3.5 w-3.5 mr-1.5" />By Date</TabsTrigger>
              </TabsList>

              <TabsContent value="user" className="mt-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {report?.byUser?.map((item: any) => (
                      <div key={item.user.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {item.user.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium w-32 truncate">{item.user.name}</span>
                        <div className="flex-1">
                          <div className="h-5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${(item.hours / maxUserHours) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-mono font-medium w-16 text-right">{item.hours.toFixed(1)}h</span>
                      </div>
                    ))}
                    {!report?.byUser?.length && (
                      <p className="text-sm text-muted-foreground text-center py-6">No time entries found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="task" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left p-3 font-medium">Task</th>
                          <th className="text-right p-3 font-medium">Estimate</th>
                          <th className="text-right p-3 font-medium">Logged</th>
                          <th className="text-right p-3 font-medium">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report?.byTask?.map((item: any) => {
                          const est = item.task.estimateHours || 0;
                          const remaining = Math.max(est - item.hours, 0);
                          return (
                            <tr key={item.task.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground font-mono">DK-{item.task.taskNumber}</span>
                                  <span className="text-sm truncate">{item.task.title}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right text-sm font-mono">{est ? `${est.toFixed(1)}h` : "—"}</td>
                              <td className="p-3 text-right text-sm font-mono font-medium">{item.hours.toFixed(1)}h</td>
                              <td className="p-3 text-right text-sm font-mono">
                                {est ? (
                                  <span className={remaining === 0 && item.hours > est ? "text-red-400" : ""}>
                                    {remaining.toFixed(1)}h
                                  </span>
                                ) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!report?.byTask?.length && (
                      <p className="text-sm text-muted-foreground text-center py-6">No time entries found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="date" className="mt-4">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    {report?.byDate?.map((item: any) => (
                      <div key={item.date} className="flex items-center gap-3">
                        <span className="text-sm w-28 text-muted-foreground">{format(new Date(item.date), "MMM d, yyyy")}</span>
                        <div className="flex-1">
                          <div className="h-5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min((item.hours / 8) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-mono font-medium w-16 text-right">{item.hours.toFixed(1)}h</span>
                      </div>
                    ))}
                    {!report?.byDate?.length && (
                      <p className="text-sm text-muted-foreground text-center py-6">No time entries found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Detailed entries table */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">All Time Entries</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">Task</th>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-right p-3 font-medium">Hours</th>
                      <th className="text-left p-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.entries?.map((entry: any) => (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <span className="text-xs text-muted-foreground font-mono mr-1">DK-{entry.task?.taskNumber}</span>
                          <span className="text-sm">{entry.task?.title}</span>
                        </td>
                        <td className="p-3 text-sm">{entry.user?.name || "Unknown"}</td>
                        <td className="p-3 text-sm text-muted-foreground">{format(new Date(entry.date), "MMM d, yyyy")}</td>
                        <td className="p-3 text-sm text-right font-mono font-medium">{entry.hours.toFixed(1)}h</td>
                        <td className="p-3 text-sm text-muted-foreground truncate max-w-[200px]">{entry.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!report?.entries?.length && (
                  <p className="text-sm text-muted-foreground text-center py-6">No time entries found for this period</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
