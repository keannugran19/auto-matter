import { NextRequest, NextResponse } from "next/server";
import { getRunById } from "@/lib/lessonsStore";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await props.params;
    const run = getRunById(runId);
    if (!run) {
      return NextResponse.json({ error: "Transfer run not found" }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
