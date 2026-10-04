import { createServiceClient } from "./supabase/server";
import { Lesson, TransferRun } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a snake_case DB row → camelCase Lesson */
function rowToLesson(row: Record<string, any>): Lesson {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    category: row.category,
    series: row.series ?? "",
    summary: row.summary ?? "",
    status: row.status,
    originalDocxUrl: row.original_docx_url ?? undefined,
    originalFileName: row.original_file_name ?? undefined,
    fileSizeBytes: row.file_size_bytes ?? 0,
    formattedDocxUrl: row.formatted_docx_url ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    formatStatus: row.format_status,
    latestRunId: row.latest_run_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a camelCase Lesson patch → snake_case DB columns */
function lessonPatchToRow(patch: Partial<Lesson>): Record<string, any> {
  const row: Record<string, any> = {};
  if (patch.number !== undefined) row.number = patch.number;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.series !== undefined) row.series = patch.series;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.originalDocxUrl !== undefined) row.original_docx_url = patch.originalDocxUrl;
  if (patch.originalFileName !== undefined) row.original_file_name = patch.originalFileName;
  if (patch.fileSizeBytes !== undefined) row.file_size_bytes = patch.fileSizeBytes;
  if (patch.formattedDocxUrl !== undefined) row.formatted_docx_url = patch.formattedDocxUrl;
  if ("pdfUrl" in patch) row.pdf_url = (patch as any).pdfUrl;
  if (patch.formatStatus !== undefined) row.format_status = patch.formatStatus;
  if (patch.latestRunId !== undefined) row.latest_run_id = patch.latestRunId;
  return row;
}

/** Map a snake_case DB row → camelCase TransferRun */
function rowToRun(row: Record<string, any>): TransferRun {
  return {
    id: row.id,
    lessonId: row.lesson_id ?? undefined,
    targetFile: row.target_file,
    referenceTemplateId: row.reference_template_id,
    referenceFileName: row.reference_file_name ?? undefined,
    classifier: row.classifier,
    status: row.status,
    stats: row.stats ?? {
      paragraphs: 0,
      rolesTransferred: 0,
      fromReference: 0,
      fromFallback: 0,
      geometryMatched: true,
    },
    warnings: row.warnings ?? [],
    roleMap: row.role_map ?? [],
    durationMs: row.duration_ms ?? 0,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function getAllLessons(): Promise<Lesson[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("lessons")
    .select("*")
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToLesson);
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("lessons")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToLesson(data) : null;
}

export async function createLesson(input: Partial<Lesson>): Promise<Lesson> {
  const db = createServiceClient();

  // Derive next number if not provided
  let nextNum = input.number;
  if (!nextNum) {
    const { data } = await db
      .from("lessons")
      .select("number")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    nextNum = data ? (data.number as number) + 1 : 1;
  }

  const now = new Date().toISOString();
  const id = input.id || `lesson-${nextNum}-${Date.now().toString(36)}`;

  const row: Record<string, any> = {
    id,
    number: nextNum,
    title: input.title || `Lesson ${nextNum}`,
    category: input.category || "new_believers",
    series: input.series || "",
    summary: input.summary || "",
    status: input.status || "draft",
    original_docx_url: input.originalDocxUrl ?? null,
    original_file_name: input.originalFileName || `lesson-${nextNum}.docx`,
    file_size_bytes: input.fileSizeBytes || 0,
    formatted_docx_url: input.formattedDocxUrl ?? null,
    pdf_url: (input as any).pdfUrl ?? null,
    format_status: input.formatStatus || "needs_transfer",
    latest_run_id: input.latestRunId ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db
    .from("lessons")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToLesson(data);
}

export async function updateLesson(
  id: string,
  patch: Partial<Lesson>
): Promise<Lesson | null> {
  const db = createServiceClient();
  const row = lessonPatchToRow(patch);
  row.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from("lessons")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToLesson(data) : null;
}

export async function deleteLesson(id: string): Promise<boolean> {
  const db = createServiceClient();
  const { error, count } = await db
    .from("lessons")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** No-op — kept for API compatibility */
export async function saveLessons(_lessons: Lesson[]): Promise<void> {}

// ---------------------------------------------------------------------------
// Transfer Runs
// ---------------------------------------------------------------------------

export async function getAllRuns(): Promise<TransferRun[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("transfer_runs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRun);
}

export async function getRunById(id: string): Promise<TransferRun | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("transfer_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRun(data) : null;
}

export async function createRun(input: Partial<TransferRun>): Promise<TransferRun> {
  const db = createServiceClient();
  const id = input.id || `run-${Date.now().toString(36)}`;

  const row: Record<string, any> = {
    id,
    lesson_id: input.lessonId ?? null,
    target_file: input.targetFile || "target.docx",
    reference_template_id: input.referenceTemplateId || "reference.docx",
    reference_file_name: input.referenceFileName || "reference.docx",
    classifier: input.classifier || "gemini",
    status: input.status || "complete",
    stats: input.stats ?? {
      paragraphs: 0,
      rolesTransferred: 0,
      fromReference: 0,
      fromFallback: 0,
      geometryMatched: true,
    },
    warnings: input.warnings ?? [],
    role_map: input.roleMap ?? [],
    duration_ms: input.durationMs || 0,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("transfer_runs")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToRun(data);
}

/** No-op — kept for API compatibility */
export async function saveRuns(_runs: TransferRun[]): Promise<void> {}
