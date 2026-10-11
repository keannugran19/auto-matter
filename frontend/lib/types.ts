export type Category = string;

export interface CategoryItem {
    id: string;
    name: string;
    slug: string;
    color: string;
    count?: number;
    createdAt?: string;
    updatedAt?: string;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
    {
        id: "new_believers",
        name: "New Believers",
        slug: "new_believers",
        color: "#10b981",
    },
    {
        id: "mentoring",
        name: "Mentoring",
        slug: "mentoring",
        color: "#f59e0b",
    },
    {
        id: "leadership",
        name: "Leadership",
        slug: "leadership",
        color: "#8b5cf6",
    },
];

export interface Lesson {
    id: string;
    number: number;
    title: string;
    category: Category;
    series?: string;
    summary?: string;
    status: "draft" | "published";
    originalDocxUrl?: string;
    originalFileName?: string;
    fileSizeBytes?: number;
    formattedDocxUrl?: string;
    pdfUrl?: string;
    formatStatus: "formatted" | "needs_transfer";
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
    source: "reference" | "fallback";
    targetFont?: string;
    targetSizePt?: number;
    targetBold?: boolean;
    targetItalic?: boolean;
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
    classifier: "heuristic" | "gemini";
    status: "running" | "complete" | "failed";
    stats: TransferRunStats;
    warnings: string[];
    roleMap: TransferRunRole[];
    durationMs: number;
    createdAt: string;
    previews?: {
        before: string[];
        after: string[];
    };
    downloadUrl?: string;
    error?: string;
    sectionChanges?: {
        pageSize?: boolean;
        margins?: boolean;
        headerFooterRemoved?: boolean;
    };
}

export const CATEGORY_LABELS: Record<string, string> = {
    new_believers: "New Believers",
    mentoring: "Mentoring",
    leadership: "Leadership",
};

export const CATEGORY_CODES: Record<string, string> = {
    nb: "new_believers",
    mt: "mentoring",
    ld: "leadership",
};

export const CATEGORY_FROM_CODE: Record<string, string> = {
    new_believers: "nb",
    mentoring: "mt",
    leadership: "ld",
};
