"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileCog, ArrowRight, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TransferRun } from "@/lib/types";

export default function ReportsPage() {
  const router = useRouter();
  const [runs, setRuns] = React.useState<TransferRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    fetch("/api/transfer")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setRuns(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredRuns = runs.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.targetFile.toLowerCase().includes(q) ||
      r.referenceTemplateId.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            Transfer Reports
          </h1>
          <p className="text-[13.5px] text-muted-foreground mt-0.5">
            History of OOXML format transfer runs across all lessons.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5 h-9">
          <Link href="/workstation">
            <FileCog className="size-4" />
            <span>New format transfer</span>
          </Link>
        </Button>
      </div>

      <Card className="shadow-sm border border-border overflow-hidden">
        <div className="p-3.5 border-b border-border bg-card flex items-center justify-between">
          <div className="w-72">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports by filename or ID…"
              className="h-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filteredRuns.length} total run(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] border-collapse">
            <thead>
              <tr className="border-b border-border text-[12.5px] text-muted-foreground h-10 bg-muted/20">
                <th className="px-4 py-2 font-medium">Run ID</th>
                <th className="px-4 py-2 font-medium">Target Document</th>
                <th className="px-4 py-2 font-medium">Reference Template</th>
                <th className="px-4 py-2 font-medium">Classifier</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Roles</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="w-24 px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="h-12">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-8 w-16 rounded-md ml-auto" /></td>
                  </tr>
                ))
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                    No transfer reports found.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {r.id.slice(0, 14)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {r.targetFile}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-[13px]">
                      {r.referenceTemplateId}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.classifier === "gemini" ? "Gemini AI" : "Heuristic"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="ok" className="gap-1 text-[11px] font-medium">
                        <Check className="size-3" />
                        <span>Complete</span>
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground font-mono">
                      {r.stats?.rolesTransferred || 10} roles
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/lessons/${r.lessonId || "general"}/report/${r.id}`
                          )
                        }
                        className="h-8 text-xs gap-1 cursor-pointer"
                      >
                        <span>View</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
