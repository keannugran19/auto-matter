import { NextRequest, NextResponse } from "next/server";
import { getLessonById, updateLesson } from "@/lib/lessonsStore";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const lesson = getLessonById(id);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name || `lesson-${lesson.number}.docx`;
    const updated = updateLesson(id, {
      originalFileName: filename,
      fileSizeBytes: file.size,
      originalDocxUrl: `/uploads/${filename}`,
      formatStatus: "needs_transfer",
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
