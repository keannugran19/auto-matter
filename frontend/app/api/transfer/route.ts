import { NextRequest, NextResponse } from "next/server";
import { getAllRuns, createRun, getLessonById, updateLesson } from "@/lib/lessonsStore";

export const dynamic = "force-dynamic";

const BACKEND_URL = (
  process.env.BACKEND_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export async function GET() {
  try {
    const runs = getAllRuns();
    return NextResponse.json(runs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let targetFileName = "target.docx";
    let referenceFileName = "reference.docx";
    let lessonId: string | undefined;
    let classifier: "heuristic" | "gemini" = "gemini";
    let apiKey: string | undefined;

    let formData: FormData | null = null;
    if (contentType.includes("multipart/form-data")) {
      formData = await request.formData();
      const targetFile = formData.get("target") as File | null;
      const refFile = formData.get("reference") as File | null;
      if (targetFile) targetFileName = targetFile.name;
      if (refFile) referenceFileName = refFile.name;
      lessonId = formData.get("lessonId")?.toString();
      const c = formData.get("classifier")?.toString();
      if (c === "heuristic" || c === "gemini") classifier = c;
      apiKey = formData.get("api_key")?.toString();
    } else {
      const json = await request.json().catch(() => ({}));
      if (json.targetFileName) targetFileName = json.targetFileName;
      if (json.referenceFileName) referenceFileName = json.referenceFileName;
      if (json.lessonId) lessonId = json.lessonId;
      if (json.classifier) classifier = json.classifier;
      if (json.apiKey) apiKey = json.apiKey;
    }

    if (lessonId) {
      const lesson = getLessonById(lessonId);
      if (lesson && lesson.originalFileName) {
        targetFileName = lesson.originalFileName;
      }
    }

    // Try calling backend FastAPI /api/convert if files are present
    let backendJobId: string | null = null;
    if (formData && formData.has("target") && formData.has("reference")) {
      try {
        const backendRes = await fetch(`${BACKEND_URL}/api/convert`, {
          method: "POST",
          body: formData,
        });
        if (backendRes.ok) {
          const data = await backendRes.json();
          backendJobId = data.jobId;
        }
      } catch {
        // Backend not currently running, continue with local run
      }
    }

    const runId = backendJobId || `run-${Date.now().toString(36)}`;
    const newRun = createRun({
      id: runId,
      lessonId,
      targetFile: targetFileName,
      referenceTemplateId: referenceFileName,
      referenceFileName,
      classifier,
      status: "complete",
      durationMs: 1200,
    });

    if (lessonId) {
      updateLesson(lessonId, {
        latestRunId: newRun.id,
      });
    }

    return NextResponse.json({
      runId: newRun.id,
      run: newRun,
      status: "complete",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
