import { NextRequest, NextResponse } from "next/server";
import { getAllRuns, createRun, getLessonById, updateLesson, createLesson } from "@/lib/lessonsStore";
import { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

const BACKEND_URL = (
  process.env.BACKEND_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export async function GET() {
  try {
    const runs = await getAllRuns();
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
    let category: Category = "new_believers";
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
      const cat = formData.get("category")?.toString();
      if (cat) {
        category = cat;
      }
      const c = formData.get("classifier")?.toString();
      if (c === "heuristic" || c === "gemini") classifier = c;
      apiKey = formData.get("api_key")?.toString();
    } else {
      const json = await request.json().catch(() => ({}));
      if (json.targetFileName) targetFileName = json.targetFileName;
      if (json.referenceFileName) referenceFileName = json.referenceFileName;
      if (json.lessonId) lessonId = json.lessonId;
      if (json.category) {
        category = json.category;
      }
      if (json.classifier) classifier = json.classifier;
      if (json.apiKey) apiKey = json.apiKey;
    }

    if (lessonId) {
      const lesson = await getLessonById(lessonId);
      if (lesson && lesson.originalFileName) {
        targetFileName = lesson.originalFileName;
      }
    } else {
      // Auto-create lesson record for standalone uploaded document
      let number: number | undefined;
      const numMatch = targetFileName.match(/(?:lesson\s*|nb-|mt-|ld-)?(\d+)/i);
      if (numMatch) {
        number = parseInt(numMatch[1], 10);
      }

      let title = targetFileName
        .replace(/\.docx$/i, "")
        .replace(/^(?:lesson\s*\d+|nb-\d+|mt-\d+|ld-\d+)[_\s-]*/i, "")
        .replace(/[_-]+/g, " ")
        .trim();

      if (!title) {
        title = number ? `Lesson ${number}` : "Untitled Lesson";
      }

      const catPrefix = category === "mentoring" ? "mt" : category === "leadership" ? "ld" : "nb";
      const customId = number ? `${catPrefix}-${number}` : undefined;

      const existingLesson = customId ? await getLessonById(customId) : null;
      if (existingLesson) {
        lessonId = existingLesson.id;
      } else {
        const seriesName =
          category === "mentoring"
            ? "Mentoring"
            : category === "leadership"
            ? "Leadership"
            : "New Believers";

        const newLesson = await createLesson({
          id: customId,
          number,
          category,
          title,
          series: seriesName,
          originalFileName: targetFileName,
          status: "draft",
          formatStatus: "needs_transfer",
        });
        lessonId = newLesson.id;
      }
    }

    // Try calling backend FastAPI /api/convert if files are present
    let backendJobId: string | null = null;
    if (formData && formData.has("target") && formData.has("reference")) {
      try {
        if (lessonId) formData.set("lesson_id", lessonId);
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
    const initialStatus = backendJobId ? "running" : "complete";
    const newRun = await createRun({
      id: runId,
      lessonId,
      targetFile: targetFileName,
      referenceTemplateId: referenceFileName,
      referenceFileName,
      classifier,
      status: initialStatus,
      durationMs: 0,
    });

    if (lessonId) {
      await updateLesson(lessonId, {
        latestRunId: newRun.id,
      });
    }

    return NextResponse.json({
      runId: newRun.id,
      run: newRun,
      lessonId,
      status: initialStatus,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
