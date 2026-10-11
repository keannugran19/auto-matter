"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Check,
    CheckCircle2,
    TriangleAlert,
    RotateCcw,
    Download,
    Save,
    AlertCircle,
    Search,
    MoveRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DocumentViewer } from "@/components/preview/document-viewer";
import {
    TransferRun,
    Lesson,
    CATEGORY_LABELS,
    TransferRunRole,
} from "@/lib/types";

interface FormatTransferReportProps {
    lessonId: string;
    runId: string;
}

export function FormatTransferReport({
    lessonId,
    runId,
}: FormatTransferReportProps) {
    const router = useRouter();

    const [lesson, setLesson] = React.useState<Lesson | null>(null);
    const [run, setRun] = React.useState<TransferRun | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // Workbench preview mode controls
    const [previewMode, setPreviewMode] = React.useState<
        "original" | "restyled"
    >("restyled");

    // Inspector controls
    const [roleFilter, setRoleFilter] = React.useState<"all" | "fallback">(
        "all",
    );
    const [roleSearch, setRoleSearch] = React.useState("");

    // Fetch report data
    React.useEffect(() => {
        let isMounted = true;
        let pollTimeout: NodeJS.Timeout | null = null;

        async function fetchRun() {
            try {
                const res = await fetch(`/api/transfer/${runId}`);
                if (res.ok && isMounted) {
                    const rData: TransferRun = await res.json();
                    setRun(rData);
                    if (rData.status === "running") {
                        pollTimeout = setTimeout(fetchRun, 2000);
                    } else {
                        setLoading(false);
                    }
                } else if (isMounted) {
                    setFetchError("Transfer run record could not be loaded");
                    setLoading(false);
                }
            } catch (err: any) {
                if (isMounted) {
                    setFetchError(
                        err.message || "Network error loading transfer run",
                    );
                    setLoading(false);
                }
            }
        }

        async function loadInitial() {
            try {
                setLoading(true);
                setFetchError(null);
                if (lessonId && lessonId !== "general") {
                    const lessonRes = await fetch(`/api/lessons/${lessonId}`);
                    if (lessonRes.ok && isMounted) {
                        const lData = await lessonRes.json();
                        setLesson(lData);
                    }
                }
                await fetchRun();
            } catch (err: any) {
                if (isMounted) {
                    setFetchError(err.message || "Failed to load report data");
                    setLoading(false);
                }
            }
        }

        loadInitial();

        return () => {
            isMounted = false;
            if (pollTimeout) clearTimeout(pollTimeout);
        };
    }, [lessonId, runId]);

    // Save action
    const handleSaveToLesson = React.useCallback(async () => {
        setIsSaving(true);
        try {
            const res = await fetch(
                `/api/lessons/${lessonId}/apply-run/${runId}`,
                {
                    method: "POST",
                },
            );

            if (!res.ok) throw new Error("Failed to save formatted lesson");

            const categoryName = lesson
                ? CATEGORY_LABELS[lesson.category] || lesson.category
                : "library";

            toast.success(
                lesson?.number
                    ? `Lesson ${lesson.number} saved to ${categoryName}`
                    : `Document saved to ${categoryName}`,
            );

            router.push("/lessons");
        } catch (err: any) {
            toast.error(err.message || "Failed to save lesson");
        } finally {
            setIsSaving(false);
        }
    }, [lessonId, runId, lesson, router]);

    // Keyboard shortcut for Cmd+S / Ctrl+S
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                const active = document.activeElement;
                if (
                    active instanceof HTMLInputElement ||
                    active instanceof HTMLTextAreaElement
                ) {
                    return;
                }
                e.preventDefault();
                if (!isSaving) {
                    handleSaveToLesson();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSaveToLesson, isSaving]);

    const handleDownloadDocx = () => {
        const url = run?.downloadUrl || `/api/jobs/${runId}/download`;
        const fileName =
            lesson?.originalFileName || run?.targetFile || "document.docx";
        const cleanName = fileName.startsWith("restyled-")
            ? fileName
            : `restyled-${fileName}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = cleanName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success(`Download started for ${cleanName}`);
    };

    const targetName =
        run?.targetFile || lesson?.originalFileName || "document.docx";
    const referenceName = run?.referenceFileName || "reference.docx";
    const durationSec =
        run?.durationMs != null ? (run.durationMs / 1000).toFixed(1) : "0.0";

    const restyledUrl =
        run?.downloadUrl ||
        lesson?.formattedDocxUrl ||
        `/api/jobs/${runId}/download`;
    const isPdf = Boolean(
        (lesson?.pdfUrl && !run?.downloadUrl) ||
        restyledUrl.toLowerCase().includes(".pdf"),
    );
    const restyledFileType = isPdf ? "pdf" : "docx";
    const restyledFileName = targetName.startsWith("restyled-")
        ? targetName
        : `restyled-${targetName}`;

    const originalUrl =
        lesson?.originalDocxUrl ||
        lesson?.pdfUrl ||
        `/api/jobs/${runId}/original`;
    const isOriginalPdf = Boolean(
        (lesson?.pdfUrl && !lesson?.originalDocxUrl) ||
        originalUrl.toLowerCase().includes(".pdf"),
    );
    const originalFileType = isOriginalPdf ? "pdf" : "docx";
    const originalFileName = targetName;

    const paragraphsCount =
        run?.stats?.paragraphs ??
        run?.roleMap?.reduce((acc, r) => acc + (r.paragraphs ?? 0), 0) ??
        0;
    const rolesTransferredCount =
        run?.stats?.rolesTransferred ?? run?.roleMap?.length ?? 0;
    const fromRefCount =
        run?.stats?.fromReference ??
        run?.roleMap?.filter((r) => r.source === "reference").length ??
        0;
    const fromFbCount =
        run?.stats?.fromFallback ??
        run?.roleMap?.filter((r) => r.source === "fallback").length ??
        0;
    const warnings = run?.warnings ?? [];
    const warningsCount = warnings.length;
    const roleList: TransferRunRole[] = run?.roleMap ?? [];

    const filteredRoles = React.useMemo(() => {
        return roleList.filter((item) => {
            if (roleFilter === "fallback" && item.source !== "fallback") {
                return false;
            }
            if (roleSearch.trim()) {
                const q = roleSearch.toLowerCase();
                const roleMatch =
                    item.role?.toLowerCase()?.includes(q) ?? false;
                const labelMatch =
                    item.label?.toLowerCase()?.includes(q) ?? false;
                const fontMatch =
                    item.font?.toLowerCase()?.includes(q) ?? false;
                return roleMatch || labelMatch || fontMatch;
            }
            return true;
        });
    }, [roleList, roleFilter, roleSearch]);

    // Loading State
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-8 w-72" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-32" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <Skeleton className="lg:col-span-7 h-[600px] rounded-xl" />
                    <Skeleton className="lg:col-span-5 h-[600px] rounded-xl" />
                </div>
            </div>
        );
    }

    // Error State
    if (fetchError || run?.status === "failed") {
        return (
            <div className="space-y-6">
                <nav className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Link
                        href="/lessons"
                        className="hover:text-foreground transition-colors"
                    >
                        Lessons
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-medium">Report</span>
                </nav>

                <Alert className="border-destructive/40 bg-destructive/10">
                    <AlertCircle className="size-4 text-destructive" />
                    <AlertTitle className="text-sm font-semibold text-destructive">
                        Format Transfer Execution Failed
                    </AlertTitle>
                    <AlertDescription className="text-sm text-foreground/80 mt-1 space-y-3">
                        <p>
                            {fetchError ||
                                run?.error ||
                                "The OOXML restyle pipeline halted due to an unresolvable schema error."}
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    router.push(
                                        lessonId && lessonId !== "general"
                                            ? `/lessons/${lessonId}/workstation`
                                            : "/workstation",
                                    )
                                }
                            >
                                <RotateCcw className="size-4 mr-1.5" />
                                Return to Workstation
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push("/lessons")}
                            >
                                Back to Lessons Library
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Breadcrumb */}
            <div className="flex flex-col gap-3">
                <nav className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Link
                        href="/lessons"
                        className="hover:text-foreground transition-colors"
                    >
                        Lessons
                    </Link>
                    <span>/</span>
                    <Link
                        href={
                            lessonId && lessonId !== "general"
                                ? `/lessons/${lessonId}/workstation`
                                : "/workstation"
                        }
                        className="hover:text-foreground transition-colors"
                    >
                        Workstation
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-medium">
                        Verification Report
                    </span>
                </nav>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {warningsCount > 0 ? (
                                <Badge
                                    variant="warn"
                                    className="gap-1 font-medium"
                                >
                                    <TriangleAlert className="size-3" />
                                    <span>
                                        Transferred ({warningsCount} warning
                                        {warningsCount > 1 ? "s" : ""})
                                    </span>
                                </Badge>
                            ) : (
                                <Badge
                                    variant="ok"
                                    className="gap-1 font-medium"
                                >
                                    <Check className="size-3" />
                                    <span>Transfer verified</span>
                                </Badge>
                            )}
                            <Badge
                                variant="outline"
                                className="text-muted-foreground font-normal"
                            >
                                Classifier:{" "}
                                {run?.classifier === "gemini"
                                    ? "Gemini AI"
                                    : "Deterministic"}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="text-muted-foreground font-mono text-[11px]"
                            >
                                {durationSec}s
                            </Badge>
                        </div>

                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Format Transfer Verification
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {targetName}{" "}
                            <span className="font-sans text-muted-foreground">
                                styled with
                            </span>{" "}
                            {referenceName}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (lessonId && lessonId !== "general") {
                                    router.push(
                                        `/lessons/${lessonId}/workstation`,
                                    );
                                } else {
                                    router.push("/workstation");
                                }
                            }}
                            className="gap-1.5 h-9"
                        >
                            <RotateCcw className="size-4" />
                            <span>Re-run</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadDocx}
                            className="gap-1.5 h-9"
                        >
                            <Download className="size-4" />
                            <span>Download .docx</span>
                        </Button>

                        <Button
                            size="sm"
                            onClick={handleSaveToLesson}
                            disabled={isSaving}
                            className="gap-1.5 h-9 font-medium"
                        >
                            <Save className="size-4" />
                            <span>
                                {isSaving ? "Saving…" : "Save to lesson"}
                            </span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Split Workbench Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Document Visual Workbench (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                    {/* Viewport Toolbar */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-card shadow-sm">
                        {/* View Mode Radiogroup */}
                        <div
                            role="radiogroup"
                            aria-label="Document preview mode"
                            className="inline-flex items-center bg-muted p-1 rounded-md text-xs font-medium"
                        >
                            <button
                                role="radio"
                                aria-checked={previewMode === "original"}
                                onClick={() => setPreviewMode("original")}
                                className={`h-7 px-3 rounded-[5px] transition-colors cursor-pointer ${
                                    previewMode === "original"
                                        ? "bg-background text-foreground shadow-sm font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Original
                            </button>
                            <button
                                role="radio"
                                aria-checked={previewMode === "restyled"}
                                onClick={() => setPreviewMode("restyled")}
                                className={`h-7 px-3 rounded-[5px] transition-colors cursor-pointer ${
                                    previewMode === "restyled"
                                        ? "bg-background text-foreground shadow-sm font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Restyled
                            </button>
                        </div>

                        <div className="text-xs text-muted-foreground font-mono truncate px-2 hidden sm:block">
                            {previewMode === "original"
                                ? targetName
                                : restyledFileName}
                        </div>
                    </div>

                    {/* Workbench Canvas */}
                    <div className="rounded-xl border border-border bg-muted/20 dark:bg-zinc-950/40 p-3 md:p-4 min-h-[600px] overflow-hidden">
                        <div className="w-full grid grid-cols-1 gap-4 items-start">
                            {/* Original Document Preview */}
                            {previewMode === "original" && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs px-1">
                                        <span className="font-medium text-foreground">
                                            Original Document
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="h-4 text-[10px] font-medium uppercase font-mono"
                                        >
                                            {originalFileType}
                                        </Badge>
                                    </div>

                                    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm flex flex-col h-[680px]">
                                        <DocumentViewer
                                            url={originalUrl}
                                            fileType={originalFileType}
                                            fileName={originalFileName}
                                            className="w-full flex-1 h-full"
                                        />
                                    </div>

                                    {/* Compact metadata pills below viewer */}
                                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted font-medium text-foreground">
                                            {paragraphsCount} paragraphs
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted font-mono">
                                            {originalFileType.toUpperCase()}
                                        </span>
                                        <span
                                            className="truncate max-w-[240px]"
                                            title={referenceName}
                                        >
                                            Template: {referenceName}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Restyled Document Preview (DocViewer) */}
                            {previewMode === "restyled" && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs px-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-foreground">
                                                Restyled Document Preview
                                            </span>
                                            <span className="text-[11px] text-muted-foreground italic">
                                                (preview may not be accurate)
                                            </span>
                                        </div>
                                        <Badge
                                            variant="ok"
                                            className="h-4 text-[10px] font-medium uppercase font-mono"
                                        >
                                            {restyledFileType}
                                        </Badge>
                                    </div>

                                    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm flex flex-col h-[680px]">
                                        <DocumentViewer
                                            url={restyledUrl}
                                            fileType={restyledFileType}
                                            fileName={restyledFileName}
                                            className="w-full flex-1 h-full"
                                        />
                                    </div>

                                    {/* Compact metadata pills below viewer */}
                                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted font-medium text-foreground">
                                            {rolesTransferredCount} roles
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted font-mono">
                                            {restyledFileType.toUpperCase()}
                                        </span>
                                        <span>Duration: {durationSec}s</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Inspection & Diff Sidebar (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    <Tabs defaultValue="inspector" className="w-full">
                        <TabsList className="w-full grid grid-cols-2 bg-muted">
                            <TabsTrigger value="inspector" className="text-xs">
                                Inspection
                            </TabsTrigger>
                            <TabsTrigger value="roles" className="text-xs">
                                Role Diff ({roleList.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Tab 1: Inspection & Quality Metrics */}
                        <TabsContent
                            value="inspector"
                            className="space-y-4 mt-3"
                        >
                            {/* Metric Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <Card className="p-3.5 shadow-sm">
                                    <div className="text-xs text-muted-foreground">
                                        Paragraphs
                                    </div>
                                    <div className="text-2xl font-semibold tracking-tight tabular-nums mt-0.5 text-foreground">
                                        {paragraphsCount}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                        {paragraphsCount} paragraphs processed
                                    </div>
                                </Card>

                                <Card className="p-3.5 shadow-sm">
                                    <div className="text-xs text-muted-foreground">
                                        Roles Transferred
                                    </div>
                                    <div className="text-2xl font-semibold tracking-tight tabular-nums mt-0.5 text-foreground">
                                        {rolesTransferredCount}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                        {fromRefCount} reference · {fromFbCount}{" "}
                                        fallback
                                    </div>
                                </Card>

                                <Card className="p-3.5 shadow-sm">
                                    <div className="text-xs text-muted-foreground">
                                        Page Geometry
                                    </div>
                                    {run?.sectionChanges ? (
                                        run.sectionChanges.pageSize ||
                                        run.sectionChanges.margins ? (
                                            <>
                                                <div className="text-sm font-semibold tracking-tight mt-1 text-foreground flex items-center gap-1.5">
                                                    <MoveRight className="size-4 text-primary" />
                                                    <span>Adapted</span>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                    {run.sectionChanges.pageSize
                                                        ? "Page size updated"
                                                        : "Page size kept"}{" "}
                                                    ·{" "}
                                                    {run.sectionChanges.margins
                                                        ? "Margins normalized"
                                                        : "Margins kept"}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-sm font-semibold tracking-tight mt-1 text-foreground flex items-center gap-1.5">
                                                    <Check className="size-4 text-[hsl(var(--success))]" />
                                                    <span>Retained</span>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                    Template geometry preserved
                                                </div>
                                            </>
                                        )
                                    ) : run?.stats?.geometryMatched !==
                                      false ? (
                                        <>
                                            <div className="text-sm font-semibold tracking-tight mt-1 text-foreground flex items-center gap-1.5">
                                                <Check className="size-4 text-[hsl(var(--success))]" />
                                                <span>Preserved</span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                                Section geometry maintained
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-sm font-semibold tracking-tight mt-1 text-foreground flex items-center gap-1.5">
                                                <AlertCircle className="size-4 text-[hsl(var(--warning))]" />
                                                <span>Modified</span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                                Geometry altered
                                            </div>
                                        </>
                                    )}
                                </Card>

                                <Card className="p-3.5 shadow-sm">
                                    <div className="text-xs text-muted-foreground">
                                        Fidelity Warnings
                                    </div>
                                    <div
                                        className={`text-2xl font-semibold tracking-tight tabular-nums mt-0.5 ${
                                            warningsCount > 0
                                                ? "text-[hsl(var(--warning))]"
                                                : "text-[hsl(var(--success))]"
                                        }`}
                                    >
                                        {warningsCount}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                        {warningsCount === 0
                                            ? "Zero fallbacks"
                                            : "Non-blocking"}
                                    </div>
                                </Card>
                            </div>

                            {/* Warnings / Fallback Section */}
                            {warningsCount > 0 ? (
                                <Alert className="border-[hsl(var(--warning)/.4)] bg-[hsl(var(--warning)/.06)]">
                                    <TriangleAlert className="size-4 text-[hsl(var(--warning))]" />
                                    <AlertTitle className="text-xs font-semibold text-foreground">
                                        Fidelity &amp; Fallback Warnings (
                                        {warningsCount})
                                    </AlertTitle>
                                    <AlertDescription className="text-xs text-muted-foreground mt-1 space-y-2">
                                        <ul className="list-disc pl-4 space-y-1">
                                            {warnings.map((w, i) => {
                                                const msg =
                                                    typeof w === "string"
                                                        ? w
                                                        : (w as any)?.message ||
                                                          JSON.stringify(w);
                                                return <li key={i}>{msg}</li>;
                                            })}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert className="border-[hsl(var(--success)/.4)] bg-[hsl(var(--success)/.06)]">
                                    <CheckCircle2 className="size-4 text-[hsl(var(--success))]" />
                                    <AlertTitle className="text-xs font-semibold text-foreground">
                                        Complete Reference Alignment
                                    </AlertTitle>
                                    <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                                        All document roles matched cleanly
                                        against the reference template with zero
                                        fallback styles.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </TabsContent>

                        {/* Tab 2: Role Mapping Comparative Diff */}
                        <TabsContent value="roles" className="space-y-3 mt-3">
                            {/* Filter & Search Bar */}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search roles..."
                                        value={roleSearch}
                                        onChange={(e) =>
                                            setRoleSearch(e.target.value)
                                        }
                                        className="h-8 pl-8 text-xs"
                                    />
                                </div>
                                <div className="flex items-center bg-muted p-0.5 rounded-md text-xs font-medium">
                                    <button
                                        onClick={() => setRoleFilter("all")}
                                        className={`h-7 px-2.5 rounded transition-colors cursor-pointer text-xs ${
                                            roleFilter === "all"
                                                ? "bg-background text-foreground shadow-sm font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        All ({roleList.length})
                                    </button>
                                    <button
                                        onClick={() =>
                                            setRoleFilter("fallback")
                                        }
                                        className={`h-7 px-2.5 rounded transition-colors cursor-pointer text-xs ${
                                            roleFilter === "fallback"
                                                ? "bg-background text-foreground shadow-sm font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Fallbacks ({fromFbCount})
                                    </button>
                                </div>
                            </div>

                            {/* Diff Table */}
                            <Card className="shadow-sm border border-border overflow-hidden">
                                <div className="max-h-[480px] overflow-y-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-border text-muted-foreground h-9 bg-muted/30 sticky top-0 bg-background z-10">
                                                <th
                                                    scope="col"
                                                    className="px-3 py-2 font-medium"
                                                >
                                                    Role
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-3 py-2 font-medium"
                                                >
                                                    Applied Style
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-3 py-2 font-medium text-right"
                                                >
                                                    Paras
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-3 py-2 font-medium text-center"
                                                >
                                                    Source
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredRoles.length > 0 ? (
                                                filteredRoles.map(
                                                    (item, idx) => (
                                                        <tr
                                                            key={idx}
                                                            className="hover:bg-muted/30 transition-colors"
                                                        >
                                                            <td className="px-3 py-2.5">
                                                                <span className="font-mono text-[11px] font-medium text-foreground block">
                                                                    {item.role}
                                                                </span>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {item.label ||
                                                                        item.role}
                                                                </span>
                                                            </td>

                                                            <td className="px-3 py-2.5 text-foreground text-[11px]">
                                                                <div>
                                                                    <span className="font-medium">
                                                                        {item.font ||
                                                                            "Default"}{" "}
                                                                        {item.sizePt
                                                                            ? `${item.sizePt} pt`
                                                                            : ""}
                                                                    </span>
                                                                    {item.bold && (
                                                                        <span className="font-bold ml-1">
                                                                            · B
                                                                        </span>
                                                                    )}
                                                                    {item.italic && (
                                                                        <span className="italic ml-1">
                                                                            · I
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {item.alignment ||
                                                                        "Left"}{" "}
                                                                    ·{" "}
                                                                    {item.spacing ||
                                                                        "Normal"}
                                                                </span>
                                                            </td>

                                                            <td className="px-3 py-2.5 tabular-nums font-mono text-[11px] text-muted-foreground text-right">
                                                                {
                                                                    item.paragraphs
                                                                }
                                                            </td>

                                                            <td className="px-3 py-2.5 text-center">
                                                                {item.source ===
                                                                "reference" ? (
                                                                    <Badge
                                                                        variant="ok"
                                                                        className="text-[10px] h-4 font-medium"
                                                                    >
                                                                        Reference
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge
                                                                        variant="warn"
                                                                        className="text-[10px] h-4 font-medium"
                                                                    >
                                                                        Fallback
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan={4}
                                                        className="px-4 py-8 text-center text-muted-foreground"
                                                    >
                                                        No matching roles found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
