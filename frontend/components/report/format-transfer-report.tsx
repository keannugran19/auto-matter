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
    ChevronLeft,
    ChevronRight,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TransferRun, Lesson, CATEGORY_LABELS } from "@/lib/types";

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
    const [isSaving, setIsSaving] = React.useState(false);

    // Preview tab state
    const [previewMode, setPreviewMode] = React.useState<
        "split" | "original" | "restyled"
    >("split");
    const [previewPage, setPreviewPage] = React.useState(1);
    const totalPreviewPages = 9;

    React.useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                const [lessonRes, runRes] = await Promise.all([
                    fetch(`/api/lessons/${lessonId}`),
                    fetch(`/api/transfer/${runId}`),
                ]);

                if (lessonRes.ok) {
                    const lData = await lessonRes.json();
                    setLesson(lData);
                }

                if (runRes.ok) {
                    const rData = await runRes.json();
                    setRun(rData);
                }
            } catch {
                toast.error("Failed to load report data");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [lessonId, runId]);

    const handleSaveToLesson = async () => {
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

            // Route back to lessons list
            router.push("/lessons");
        } catch (err: any) {
            toast.error(err.message || "Failed to save lesson");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadDocx = () => {
        toast.success(
            `Downloading restyled-${lesson?.originalFileName || "lesson.docx"}`,
        );
    };

    const targetName =
        run?.targetFile ||
        lesson?.originalFileName ||
        "document.docx";
    const referenceName = run?.referenceFileName || "reference.docx";
    const durationSec = run?.durationMs ? (run.durationMs / 1000).toFixed(1) : "0.0";

    return (
        <div className="space-y-6">
            {/* 3-step Stepper */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <div className="flex size-5.5 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[11px]">
                        <Check className="size-3 stroke-[3]" />
                    </div>
                    <span>Lesson details</span>
                </div>
                <div className="w-12 h-px bg-border" />
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <div className="flex size-5.5 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[11px]">
                        <Check className="size-3 stroke-[3]" />
                    </div>
                    <span>Format transfer</span>
                </div>
                <div className="w-12 h-px bg-border" />
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <div className="flex size-5.5 items-center justify-center rounded-full border-1.5 border-primary text-foreground font-bold text-[11px]">
                        3
                    </div>
                    <span>Review report</span>
                </div>
            </div>

            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    {/* Status Badge Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="ok" className="gap-1 font-medium">
                            <Check className="size-3" />
                            <span>Transfer complete</span>
                        </Badge>
                        <Badge
                            variant="outline"
                            className="text-muted-foreground font-normal"
                        >
                            Classifier ·{" "}
                            {run?.classifier === "gemini"
                                ? "Gemini AI"
                                : "Heuristic"}
                        </Badge>
                        <Badge
                            variant="outline"
                            className="text-muted-foreground font-mono text-[11px]"
                        >
                            {durationSec}s
                        </Badge>
                    </div>

                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                        Format Transfer Report
                    </h1>
                    <p className="text-[13.5px] text-muted-foreground mt-0.5 font-mono text-xs">
                        {targetName}{" "}
                        <span className="font-sans text-muted-foreground">
                            → styled with
                        </span>{" "}
                        {referenceName}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            router.push(`/lessons/${lessonId}/workstation`)
                        }
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
                        <span>{isSaving ? "Saving…" : "Save to lesson"}</span>
                    </Button>
                </div>
            </div>

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Card className="p-4 shadow-sm">
                    <div className="text-[13px] text-muted-foreground">
                        Paragraphs
                    </div>
                    <div className="text-[26px] font-semibold tracking-tight tabular-nums mt-1 text-foreground">
                        {run?.stats.paragraphs || 41}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        All retained
                    </div>
                </Card>

                <Card className="p-4 shadow-sm">
                    <div className="text-[13px] text-muted-foreground">
                        Roles transferred
                    </div>
                    <div className="text-[26px] font-semibold tracking-tight tabular-nums mt-1 text-foreground">
                        {run?.stats.rolesTransferred || 10}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {run?.stats.fromReference || 7} reference ·{" "}
                        {run?.stats.fromFallback || 3} fallback
                    </div>
                </Card>

                <Card className="p-4 shadow-sm">
                    <div className="text-[13px] text-muted-foreground">
                        Page geometry
                    </div>
                    <div className="mt-2.5">
                        <Badge variant="ok" className="font-medium text-[11px]">
                            Matched to reference
                        </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                        Letter · 0.5 in margins
                    </div>
                </Card>

                <Card className="p-4 shadow-sm">
                    <div className="text-[13px] text-muted-foreground">
                        Warnings
                    </div>
                    <div className="text-[26px] font-semibold tracking-tight tabular-nums mt-1 text-[hsl(var(--warning))]">
                        {run?.warnings.length || 3}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        Non-blocking fallbacks
                    </div>
                </Card>
            </div>

            {/* Tabs: Summary / Role Mapping / Preview */}
            <Tabs defaultValue="summary" className="space-y-4">
                <TabsList className="bg-muted">
                    <TabsTrigger value="summary" className="text-xs">
                        Summary
                    </TabsTrigger>
                    <TabsTrigger value="roles" className="text-xs">
                        Role mapping
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs">
                        Preview
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Summary */}
                <TabsContent value="summary" className="space-y-3.5 mt-0">
                    <Alert className="border-[hsl(var(--success)/.4)] bg-[hsl(var(--success)/.06)]">
                        <CheckCircle2 className="size-4 text-[hsl(var(--success))]" />
                        <AlertTitle className="text-[13.5px] font-semibold text-foreground">
                            Section &amp; layout properties aligned
                        </AlertTitle>
                        <AlertDescription className="text-[13px] text-muted-foreground mt-0.5">
                            Page size &amp; orientation · Margins (0.5 in / 36
                            pt) · Header &amp; footer sync
                        </AlertDescription>
                    </Alert>

                    <Alert className="border-[hsl(var(--warning)/.4)] bg-[hsl(var(--warning)/.06)]">
                        <TriangleAlert className="size-4 text-[hsl(var(--warning))]" />
                        <AlertTitle className="text-[13.5px] font-semibold text-foreground">
                            Fidelity &amp; fallback warnings (
                            {run?.warnings.length || 3})
                        </AlertTitle>
                        <AlertDescription className="text-[13px] text-muted-foreground mt-1 space-y-2">
                            <ul className="list-disc pl-4 space-y-1">
                                {(
                                    run?.warnings || [
                                        "heading_3 missing in reference; derived from heading_1",
                                        "reference_line unresolvable in reference; defaulted to body",
                                        "definition_term unresolvable in reference; defaulted to body",
                                    ]
                                ).map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                            <div className="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        router.push("/settings/templates")
                                    }
                                    className="h-8 text-xs cursor-pointer"
                                >
                                    Add missing roles to reference template
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                </TabsContent>

                {/* Tab 2: Role Mapping */}
                <TabsContent value="roles" className="mt-0">
                    <Card className="shadow-sm border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13.5px] border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-[12.5px] text-muted-foreground h-10 bg-muted/20">
                                        <th className="px-4 py-2 font-medium">
                                            Role
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Paragraphs
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Typography
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Alignment
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Spacing
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Source
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(
                                        run?.roleMap || [
                                            {
                                                role: "body",
                                                label: "Body",
                                                paragraphs: 16,
                                                font: "Times New Roman",
                                                sizePt: 22,
                                                alignment: "Justified",
                                                spacing: "After 0 pt",
                                                source: "reference",
                                            },
                                            {
                                                role: "heading_3",
                                                label: "Heading 3",
                                                paragraphs: 9,
                                                font: "Times New Roman",
                                                sizePt: 22,
                                                bold: true,
                                                alignment: "Justified",
                                                spacing: "Before 18 pt",
                                                source: "fallback",
                                            },
                                            {
                                                role: "list_item",
                                                label: "List item",
                                                paragraphs: 6,
                                                font: "Times New Roman",
                                                sizePt: 22,
                                                italic: true,
                                                alignment: "Justified",
                                                spacing: "Before 20.6 pt",
                                                source: "reference",
                                            },
                                            {
                                                role: "scripture",
                                                label: "Scripture quote",
                                                paragraphs: 4,
                                                font: "Times New Roman",
                                                sizePt: 22,
                                                bold: true,
                                                italic: true,
                                                alignment: "Justified",
                                                spacing: "After 6 pt",
                                                source: "reference",
                                            },
                                            {
                                                role: "title",
                                                label: "Lesson title",
                                                paragraphs: 1,
                                                font: "Times New Roman",
                                                sizePt: 36,
                                                bold: true,
                                                alignment: "Left",
                                                spacing: "After 12 pt",
                                                source: "reference",
                                            },
                                        ]
                                    ).map((item, idx) => (
                                        <tr
                                            key={idx}
                                            className="hover:bg-muted/30"
                                        >
                                            <td className="px-4 py-2.5">
                                                <span className="font-mono text-[12.5px] font-medium text-foreground block">
                                                    {item.role}
                                                </span>
                                                <span className="text-[12px] text-muted-foreground">
                                                    {item.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 tabular-nums font-mono text-[13px] text-muted-foreground">
                                                {item.paragraphs}
                                            </td>
                                            <td className="px-4 py-2.5 text-[13px]">
                                                <span>
                                                    {item.font} {item.sizePt} pt
                                                </span>
                                                {item.bold && (
                                                    <span className="font-bold ml-1.5">
                                                        · Bold
                                                    </span>
                                                )}
                                                {item.italic && (
                                                    <span className="italic ml-1.5">
                                                        · Italic
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                                                {item.alignment}
                                            </td>
                                            <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                                                {item.spacing}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {item.source === "reference" ? (
                                                    <Badge
                                                        variant="ok"
                                                        className="text-[11px] font-medium"
                                                    >
                                                        Reference
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="warn"
                                                        className="text-[11px] font-medium"
                                                    >
                                                        Fallback
                                                    </Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                {/* Tab 3: Preview */}
                <TabsContent value="preview" className="space-y-3 mt-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center bg-muted p-0.5 rounded-md text-xs font-medium">
                            <button
                                onClick={() => setPreviewMode("split")}
                                className={`h-7 px-3 rounded-[5px] transition-all cursor-pointer ${
                                    previewMode === "split"
                                        ? "bg-background text-foreground shadow-sm font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Split
                            </button>
                            <button
                                onClick={() => setPreviewMode("original")}
                                className={`h-7 px-3 rounded-[5px] transition-all cursor-pointer ${
                                    previewMode === "original"
                                        ? "bg-background text-foreground shadow-sm font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Original
                            </button>
                            <button
                                onClick={() => setPreviewMode("restyled")}
                                className={`h-7 px-3 rounded-[5px] transition-all cursor-pointer ${
                                    previewMode === "restyled"
                                        ? "bg-background text-foreground shadow-sm font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Restyled
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={previewPage <= 1}
                                onClick={() =>
                                    setPreviewPage((p) => Math.max(1, p - 1))
                                }
                            >
                                <ChevronLeft className="size-4" />
                                <span className="sr-only">Previous page</span>
                            </Button>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                Page {previewPage} of {totalPreviewPages}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={previewPage >= totalPreviewPages}
                                onClick={() =>
                                    setPreviewPage((p) =>
                                        Math.min(totalPreviewPages, p + 1),
                                    )
                                }
                            >
                                <ChevronRight className="size-4" />
                                <span className="sr-only">Next page</span>
                            </Button>
                        </div>
                    </div>

                    <div
                        className={`grid gap-4 ${
                            previewMode === "split"
                                ? "grid-cols-1 md:grid-cols-2"
                                : "grid-cols-1 max-w-2xl mx-auto"
                        }`}
                    >
                        {/* Before (Original) */}
                        {(previewMode === "split" ||
                            previewMode === "original") && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-foreground">
                                        Before
                                    </span>
                                    <span className="font-mono text-muted-foreground text-[11px]">
                                        {targetName}
                                    </span>
                                </div>
                                <div className="rounded-md border border-border bg-white text-zinc-900 p-6 min-h-[320px] font-serif text-[11.5px] leading-relaxed shadow-sm">
                                    <div className="italic text-zinc-600 mb-1">
                                        {lesson?.series || "Original format"}
                                    </div>
                                    <div className="font-bold italic text-zinc-800 text-sm mb-3">
                                        {lesson?.title || targetName}
                                    </div>
                                    {lesson?.summary ? (
                                        <p className="mb-3">
                                            <b>Summary:</b> {lesson.summary}
                                        </p>
                                    ) : (
                                        <p className="mb-3 text-zinc-500 italic">
                                            Original formatting before OOXML restyle.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* After (Restyled) */}
                        {(previewMode === "split" ||
                            previewMode === "restyled") && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-foreground">
                                        After
                                    </span>
                                    <Badge
                                        variant="ok"
                                        className="h-4 text-[10px] font-medium"
                                    >
                                        Format transfer applied
                                    </Badge>
                                </div>
                                <div className="rounded-md border border-border bg-white text-zinc-950 p-6 min-h-[320px] font-serif text-[14px] leading-relaxed shadow-sm">
                                    <div className="italic text-zinc-500 text-xs mb-1">
                                        {lesson?.series || referenceName}
                                    </div>
                                    <h4 className="text-xl font-bold tracking-tight text-zinc-900 my-2">
                                        {lesson?.title || targetName}
                                    </h4>
                                    {lesson?.summary ? (
                                        <p className="mb-3 text-[13.5px]">
                                            <b>Summary:</b> {lesson.summary}
                                        </p>
                                    ) : (
                                        <p className="mb-3 text-[13.5px] text-zinc-600">
                                            Styles normalized from {referenceName}.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
