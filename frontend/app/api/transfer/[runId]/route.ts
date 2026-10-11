import { NextRequest, NextResponse } from "next/server";
import { getRunById, updateRun } from "@/lib/lessonsStore";
import { TransferRun, TransferRunRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const BACKEND_URL = (
  process.env.BACKEND_URL || "http://localhost:8000"
).replace(/\/+$/, "");

function formatRoleLabel(role: string): string {
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSpacing(spec: any): string {
  if (!spec) return "Normal";
  const parts: string[] = [];
  if (spec.space_before != null && spec.space_before > 0) {
    parts.push(`Before ${Math.round(spec.space_before / 20)} pt`);
  }
  if (spec.space_after != null && spec.space_after > 0) {
    parts.push(`After ${Math.round(spec.space_after / 20)} pt`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Normal";
}

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await props.params;

    // Check DB first for baseline metadata (file names, lessonId, etc.)
    const dbRun = await getRunById(runId).catch(() => null);

    // Try fetching live job from FastAPI backend
    let backendJob: any = null;
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/jobs/${runId}`, {
        cache: "no-store",
      });
      if (backendRes.ok) {
        backendJob = await backendRes.json();
      }
    } catch {
      // Backend not running or unreachable
    }

    if (backendJob) {
      if (backendJob.status === "queued" || backendJob.status === "running") {
        return NextResponse.json({
          ...(dbRun || {
            id: runId,
            targetFile: "document.docx",
            referenceTemplateId: "reference.docx",
            classifier: "gemini",
            createdAt: new Date().toISOString(),
          }),
          status: "running",
          roleMap: [],
          stats: {
            paragraphs: 0,
            rolesTransferred: 0,
            fromReference: 0,
            fromFallback: 0,
            geometryMatched: true,
          },
          warnings: [],
        });
      }

      if (backendJob.status === "error") {
        const errorRun: TransferRun = {
          ...(dbRun || {
            id: runId,
            targetFile: "document.docx",
            referenceTemplateId: "reference.docx",
            classifier: "gemini",
            createdAt: new Date().toISOString(),
          }),
          status: "failed",
          error:
            backendJob.error ||
            "Format transfer processing failed in OOXML engine",
          stats: {
            paragraphs: 0,
            rolesTransferred: 0,
            fromReference: 0,
            fromFallback: 0,
            geometryMatched: true,
          },
          warnings: [],
          roleMap: [],
          durationMs: dbRun?.durationMs || 0,
        };
        await updateRun(runId, { status: "failed" }).catch(() => null);
        return NextResponse.json(errorRun);
      }

      if (backendJob.status === "done") {
        const report = backendJob.report || {};
        const rawRoles: any[] = report.roles || [];
        const roleMap: TransferRunRole[] = rawRoles.map((r: any) => ({
          role: r.role || "unknown",
          label: formatRoleLabel(r.role || "unknown"),
          paragraphs: r.paragraphCount || 0,
          font: r.specApplied?.font || "Normal",
          sizePt: r.specApplied?.size_pt || 11,
          bold: Boolean(r.specApplied?.bold),
          italic: Boolean(r.specApplied?.italic),
          alignment: r.specApplied?.alignment || "Left",
          spacing: formatSpacing(r.specApplied),
          source: r.source === "reference" ? "reference" : "fallback",
        }));

        const warnings: string[] = (report.warnings || []).map((w: any) =>
          typeof w === "string" ? w : w.message || JSON.stringify(w)
        );

        const paragraphsCount = roleMap.reduce(
          (acc, r) => acc + (r.paragraphs || 0),
          0
        );
        const fromReference = roleMap.filter((r) => r.source === "reference")
          .length;
        const fromFallback = roleMap.filter((r) => r.source === "fallback")
          .length;

        const sectionChanges = report.sectionChanges || {};
        const geometryMatched =
          !sectionChanges.pageSize && !sectionChanges.margins;

        const normalizedRun: TransferRun = {
          id: runId,
          lessonId: dbRun?.lessonId,
          targetFile: dbRun?.targetFile || "document.docx",
          referenceTemplateId: dbRun?.referenceTemplateId || "reference.docx",
          referenceFileName: dbRun?.referenceFileName || "reference.docx",
          classifier: report.classifier === "llm" ? "gemini" : "heuristic",
          status: "complete",
          stats: {
            paragraphs: paragraphsCount,
            rolesTransferred: roleMap.length,
            fromReference,
            fromFallback,
            geometryMatched,
          },
          warnings,
          roleMap,
          durationMs: dbRun?.durationMs || 1200,
          createdAt: dbRun?.createdAt || new Date().toISOString(),
          downloadUrl: backendJob.downloadUrl || `/api/jobs/${runId}/download`,
          sectionChanges,
        };

        // Sync back to DB if run existed
        if (dbRun) {
          await updateRun(runId, {
            status: "complete",
            stats: normalizedRun.stats,
            warnings: normalizedRun.warnings,
            roleMap: normalizedRun.roleMap,
            classifier: normalizedRun.classifier,
          }).catch(() => null);
        }

        return NextResponse.json(normalizedRun);
      }
    }

    // Fall back to Supabase DB record
    if (dbRun) {
      return NextResponse.json(dbRun);
    }

    return NextResponse.json(
      { error: "Transfer run not found" },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
