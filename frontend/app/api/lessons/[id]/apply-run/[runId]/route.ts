import { NextRequest, NextResponse } from "next/server";
import { getLessonById, updateLesson, getRunById } from "@/lib/lessonsStore";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { id, runId } = await props.params;
    const lesson = getLessonById(id);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const run = getRunById(runId);
    const updated = updateLesson(id, {
      formatStatus: "formatted",
      latestRunId: runId,
      formattedDocxUrl: `/api/jobs/${runId}/download`,
    });

    return NextResponse.json({
      lesson: updated,
      run,
      message: `Lesson ${lesson.number} saved with format transfer`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
