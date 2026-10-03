export type Category = 'new_believers' | 'mentoring' | 'leadership';

export interface Lesson {
  id: string;
  number: number;
  title: string;
  category: Category;
  series?: string;
  summary?: string;
  status: 'draft' | 'published';
  originalDocxUrl?: string;
  originalFileName?: string;
  fileSizeBytes?: number;
  formattedDocxUrl?: string;
  formatStatus: 'formatted' | 'needs_transfer';
  latestRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferRunRole {
  role: string;
  label: string;
  paragraphs: number;
  font: string;
  sizePt: number;
  bold?: boolean;
  italic?: boolean;
  alignment: string;
  spacing: string;
  source: 'reference' | 'fallback';
}

export interface TransferRunStats {
  paragraphs: number;
  rolesTransferred: number;
  fromReference: number;
  fromFallback: number;
  geometryMatched: boolean;
}

export interface TransferRun {
  id: string;
  lessonId?: string;
  targetFile: string;
  referenceTemplateId: string;
  referenceFileName?: string;
  classifier: 'heuristic' | 'gemini';
  status: 'running' | 'complete' | 'failed';
  stats: TransferRunStats;
  warnings: string[];
  roleMap: TransferRunRole[];
  durationMs: number;
  createdAt: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  new_believers: 'New Believers',
  mentoring: 'Mentoring',
  leadership: 'Leadership',
};

export const CATEGORY_CODES: Record<string, Category> = {
  nb: 'new_believers',
  mt: 'mentoring',
  ld: 'leadership',
};

export const CATEGORY_FROM_CODE: Record<Category, string> = {
  new_believers: 'nb',
  mentoring: 'mt',
  leadership: 'ld',
};
