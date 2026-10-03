import { NextRequest, NextResponse } from "next/server";
import { getAllLessons, createLesson } from "@/lib/lessonsStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase();

    let lessons = getAllLessons();

    if (category && category !== "all") {
      const catCodeMap: Record<string, string> = {
        nb: "new_believers",
        mt: "mentoring",
        ld: "leadership",
        new_believers: "new_believers",
        mentoring: "mentoring",
        leadership: "leadership",
      };
      const mapped = catCodeMap[category] || category;
      lessons = lessons.filter((l) => l.category === mapped);
    }

    if (status && status !== "all") {
      lessons = lessons.filter((l) => l.formatStatus === status || l.status === status);
    }

    if (search) {
      lessons = lessons.filter(
        (l) =>
          l.title.toLowerCase().includes(search) ||
          l.number.toString().includes(search) ||
          (l.series && l.series.toLowerCase().includes(search))
      );
    }

    return NextResponse.json(lessons);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const number = formData.get("number") ? Number(formData.get("number")) : undefined;
      const title = formData.get("title")?.toString() || "Untitled Lesson";
      const category = (formData.get("category")?.toString() || "new_believers") as any;
      const series = formData.get("series")?.toString() || "";
      const summary = formData.get("summary")?.toString() || "";
      const status = (formData.get("status")?.toString() || "draft") as any;

      const file = formData.get("file") as File | null;
      let originalFileName = file?.name || "lesson.docx";
      let fileSizeBytes = file?.size || 18000;

      const newLesson = createLesson({
        number,
        title,
        category,
        series,
        summary,
        status,
        originalFileName,
        fileSizeBytes,
        originalDocxUrl: `/uploads/${originalFileName}`,
        formatStatus: "needs_transfer",
      });

      return NextResponse.json(newLesson, { status: 201 });
    }

    const body = await request.json();
    const newLesson = createLesson(body);
    return NextResponse.json(newLesson, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
