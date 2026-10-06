import { NextResponse } from "next/server";
import { syncLessonsFromStorage } from "@/lib/lessonsStore";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const lessons = await syncLessonsFromStorage();
    return NextResponse.json({ success: true, count: lessons.length, lessons });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
