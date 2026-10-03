import fs from "fs";
import path from "path";
import { Lesson, TransferRun } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const LESSONS_FILE = path.join(DATA_DIR, "lessons.json");
const RUNS_FILE = path.join(DATA_DIR, "transfer-runs.json");

const SEED_LESSONS: Lesson[] = [];

const SEED_RUNS: TransferRun[] = [];

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LESSONS_FILE)) {
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(SEED_LESSONS, null, 2), "utf-8");
  }
  if (!fs.existsSync(RUNS_FILE)) {
    fs.writeFileSync(RUNS_FILE, JSON.stringify(SEED_RUNS, null, 2), "utf-8");
  }
}

export function getAllLessons(): Lesson[] {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(LESSONS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return SEED_LESSONS;
  }
}

export function getLessonById(id: string): Lesson | null {
  const lessons = getAllLessons();
  return lessons.find((l) => l.id === id) || null;
}

export function saveLessons(lessons: Lesson[]) {
  ensureDataFiles();
  fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons, null, 2), "utf-8");
}

export function createLesson(data: Partial<Lesson>): Lesson {
  const lessons = getAllLessons();
  const nextNum = data.number || (lessons.length > 0 ? Math.max(...lessons.map((l) => l.number)) + 1 : 1);
  const now = new Date().toISOString();

  const newLesson: Lesson = {
    id: data.id || `lesson-${nextNum}-${Date.now().toString(36)}`,
    number: nextNum,
    title: data.title || `Lesson ${nextNum}`,
    category: data.category || "new_believers",
    series: data.series || "",
    summary: data.summary || "",
    status: data.status || "draft",
    originalDocxUrl: data.originalDocxUrl,
    originalFileName: data.originalFileName || `lesson-${nextNum}.docx`,
    fileSizeBytes: data.fileSizeBytes || 0,
    formattedDocxUrl: data.formattedDocxUrl,
    formatStatus: data.formatStatus || "needs_transfer",
    latestRunId: data.latestRunId,
    createdAt: now,
    updatedAt: now,
  };

  lessons.unshift(newLesson);
  saveLessons(lessons);
  return newLesson;
}

export function updateLesson(id: string, patch: Partial<Lesson>): Lesson | null {
  const lessons = getAllLessons();
  const idx = lessons.findIndex((l) => l.id === id);
  if (idx === -1) return null;

  lessons[idx] = {
    ...lessons[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveLessons(lessons);
  return lessons[idx];
}

export function deleteLesson(id: string): boolean {
  const lessons = getAllLessons();
  const filtered = lessons.filter((l) => l.id !== id);
  if (filtered.length === lessons.length) return false;
  saveLessons(filtered);
  return true;
}

export function getAllRuns(): TransferRun[] {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(RUNS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return SEED_RUNS;
  }
}

export function getRunById(id: string): TransferRun | null {
  const runs = getAllRuns();
  return runs.find((r) => r.id === id) || null;
}

export function saveRuns(runs: TransferRun[]) {
  ensureDataFiles();
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), "utf-8");
}

export function createRun(data: Partial<TransferRun>): TransferRun {
  const runs = getAllRuns();
  const id = data.id || `run-${Date.now().toString(36)}`;
  const newRun: TransferRun = {
    id,
    lessonId: data.lessonId,
    targetFile: data.targetFile || "target.docx",
    referenceTemplateId: data.referenceTemplateId || "reference.docx",
    referenceFileName: data.referenceFileName || "reference.docx",
    classifier: data.classifier || "gemini",
    status: data.status || "complete",
    stats: data.stats || {
      paragraphs: 0,
      rolesTransferred: 0,
      fromReference: 0,
      fromFallback: 0,
      geometryMatched: true,
    },
    warnings: data.warnings || [],
    roleMap: data.roleMap || [],
    durationMs: data.durationMs || 0,
    createdAt: new Date().toISOString(),
  };

  runs.unshift(newRun);
  saveRuns(runs);
  return newRun;
}
