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

const TITLE_MAP: Record<number, string> = {
  1: "Sin",
  2: "Salvation",
  3: "Repentance",
  4: "Sanctification",
  5: "Consecration",
  6: "Faith",
  7: "Lordship of Jesus Christ",
  8: "Who Jesus Christ Is",
  9: "Who is the Holy Spirit (Part 1)",
  10: "Who is the Holy Spirit (Part 2)",
  11: "Doctrine of the Trinity",
  12: "Attributes of God",
  13: "The Nature and Names of God",
  14: "Fellowship",
  15: "How to Hear from God",
  16: "The Church",
  17: "The Kingdom of God",
  18: "The Civil Government",
  19: "Submission",
  20: "Giving",
  21: "Moderation",
  22: "Overcoming Fear",
  23: "The Christian Home",
  24: "The Christian Marriage",
  25: "Soul Winning",
  26: "Divine Healing (Part 1)",
  27: "Divine Healing (Part 2)",
  28: "Divine Healing (Part 3)",
  29: "Divine Healing (Part 4)",
  30: "The Word of God",
  31: "Authority of the Bible",
  32: "The Bible",
  33: "LDS: Hope",
  34: "LDS: Second Coming",
  35: "LDS: The Rapture of the Church",
  36: "Bema Seat of Christ",
  37: "Resurrection of the Body",
  38: "Judgement of Believers",
  39: "White Throne Judgment",
  40: "Tribulation",
  41: "The Antichrist",
  42: "The Resurrection",
};

export async function syncLessonsFromStorage(): Promise<Lesson[]> {
  const db = createServiceClient();
  const { data: files, error: listError } = await db.storage
    .from("pdfs")
    .list("Lessons/New Believers", { limit: 100 });

  if (listError) throw new Error(listError.message);
  if (!files || files.length === 0) return [];

  const rows: Record<string, any>[] = [];
  for (const f of files) {
    const match = f.name.match(/^lesson(\d+)/i);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    const title =
      TITLE_MAP[num] ||
      f.name
        .replace(/^lesson\d+/i, "")
        .replace(/\.pdf$/i, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() ||
      `Lesson ${num}`;

    const {
      data: { publicUrl },
    } = db.storage
      .from("pdfs")
      .getPublicUrl(`Lessons/New Believers/${f.name}`);

    rows.push({
      id: `nb-${num}`,
      number: num,
      title,
      category: "new_believers",
      series: "New Believers",
      summary: `Foundational study on ${title} for new believers.`,
      status: "published",
      original_file_name: f.name,
      file_size_bytes: f.metadata?.size || 0,
      pdf_url: publicUrl,
      format_status: "formatted",
      created_at: f.created_at || new Date().toISOString(),
      updated_at: f.updated_at || new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await db
      .from("lessons")
      .upsert(rows, { onConflict: "id" });
    if (upsertErr) throw new Error(upsertErr.message);
  }

  return getAllLessons();
}

export async function getAllLessons(): Promise<Lesson[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("lessons")
    .select("*")
    .order("number", { ascending: true });
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
