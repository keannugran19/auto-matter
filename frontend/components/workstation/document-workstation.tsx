"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    FileText,
    FileType2,
    Sparkles,
    CheckCircle2,
    ShieldCheck,
    Layers,
    Ruler,
    ArrowLeft,
    Loader2,
    AlertTriangle,
    Check,
    UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Lesson, Category, CATEGORY_LABELS } from "@/lib/types";
import { useCategories } from "@/lib/useCategories";

interface DocumentWorkstationProps {
    lessonId?: string;
}

export function DocumentWorkstation({ lessonId }: DocumentWorkstationProps) {
    const router = useRouter();

    const [lesson, setLesson] = React.useState<Lesson | null>(null);
    const [loadingLesson, setLoadingLesson] = React.useState(Boolean(lessonId));

    const { categories } = useCategories();
    // Target file & Category
    const [targetFile, setTargetFile] = React.useState<File | null>(null);
    const [targetFileName, setTargetFileName] = React.useState<string>("");
    const [targetFileSize, setTargetFileSize] = React.useState<string>("");
    const [category, setCategory] = React.useState<Category>("new_believers");

    // Reference template
    const [referenceFile, setReferenceFile] = React.useState<File | null>(null);
    const [referenceFileName, setReferenceFileName] = React.useState<string>("");
    const [referenceFileSize, setReferenceFileSize] = React.useState<string>("");
    const [rememberDefault, setRememberDefault] = React.useState<boolean>(true);

    // Classifier
    const [classifier, setClassifier] = React.useState<"heuristic" | "gemini">(
        "gemini",
    );

    // Transfer execution state
    const [isTransferring, setIsTransferring] = React.useState(false);
    const [transferProgress, setTransferProgress] = React.useState<number>(0);
    const [error, setError] = React.useState<string | null>(null);

    const targetInputRef = React.useRef<HTMLInputElement | null>(null);
    const referenceInputRef = React.useRef<HTMLInputElement | null>(null);

    const [targetDragOver, setTargetDragOver] = React.useState(false);
    const [referenceDragOver, setReferenceDragOver] = React.useState(false);

    // Load lesson if lessonId provided
    React.useEffect(() => {
        if (lessonId) {
            setLoadingLesson(true);
            fetch(`/api/lessons/${lessonId}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    if (data) {
                        setLesson(data);
                        if (data.category) {
                            setCategory(data.category);
                        }
                        if (data.originalFileName) {
                            setTargetFileName(data.originalFileName);
                            if (data.fileSizeBytes) {
                                setTargetFileSize(
                                    `${(data.fileSizeBytes / 1024).toFixed(1)} KB`,
                                );
                            }
                        }
                    }
                })
                .catch(() => {})
                .finally(() => setLoadingLesson(false));
        }
    }, [lessonId]);

    // Load saved default reference template preference
    React.useEffect(() => {
        const savedRefName = localStorage.getItem(
            "onelife_default_reference_name",
        );
        if (savedRefName) {
            setReferenceFileName(savedRefName);
        }
    }, []);

    const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const f = e.target.files[0];
            setTargetFile(f);
            setTargetFileName(f.name);
            setTargetFileSize(`${(f.size / 1024).toFixed(1)} KB`);
        }
    };

    const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const f = e.target.files[0];
            setReferenceFile(f);
            setReferenceFileName(f.name);
            setReferenceFileSize(`${(f.size / 1024).toFixed(1)} KB`);
            if (rememberDefault) {
                localStorage.setItem("onelife_default_reference_name", f.name);
            }
        }
    };

    const handleTargetDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setTargetDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const f = e.dataTransfer.files[0];
            if (!f.name.endsWith(".docx")) {
                toast.error("Please drop a Word document (.docx)");
                return;
            }
            setTargetFile(f);
            setTargetFileName(f.name);
            setTargetFileSize(`${(f.size / 1024).toFixed(1)} KB`);
        }
    };

    const handleReferenceDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setReferenceDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const f = e.dataTransfer.files[0];
            if (!f.name.endsWith(".docx")) {
                toast.error("Please drop a Word document (.docx)");
                return;
            }
            setReferenceFile(f);
            setReferenceFileName(f.name);
            setReferenceFileSize(`${(f.size / 1024).toFixed(1)} KB`);
            if (rememberDefault) {
                localStorage.setItem("onelife_default_reference_name", f.name);
            }
        }
    };

    const handleToggleRememberDefault = (checked: boolean) => {
        setRememberDefault(checked);
        if (checked) {
            localStorage.setItem(
                "onelife_default_reference_name",
                referenceFileName,
            );
        } else {
            localStorage.removeItem("onelife_default_reference_name");
        }
    };

    const handleTransfer = async () => {
        if (!targetFile && !lesson && !targetFileName) {
            setError("Please select a target Word document (.docx)");
            return;
        }
        if (!referenceFile && !referenceFileName) {
            setError("Please select a reference style template (.docx)");
            return;
        }

        setError(null);
        setIsTransferring(true);
        setTransferProgress(15);

        try {
            const progressTimer = setInterval(() => {
                setTransferProgress((prev) => {
                    if (prev >= 85) {
                        clearInterval(progressTimer);
                        return prev;
                    }
                    return prev + 18;
                });
            }, 400);

            const formData = new FormData();
            if (targetFile) formData.append("target", targetFile);
            if (referenceFile) formData.append("reference", referenceFile);
            if (lessonId) formData.append("lessonId", lessonId);
            formData.append("category", category);
            formData.append("classifier", classifier);

            // Check for saved API key
            const savedKey = localStorage.getItem("gemini_api_key");
            if (savedKey) formData.append("api_key", savedKey);

            const res = await fetch("/api/transfer", {
                method: "POST",
                body: formData,
            });

            clearInterval(progressTimer);
            setTransferProgress(100);

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(
                    errData.error || errData.detail || "Format transfer failed",
                );
            }

            const data = await res.json();
            const runId = data.runId || data.run?.id;
            const paragraphCount = data.run?.stats?.paragraphs;
            const msg = paragraphCount
                ? `Format transfer complete — ${paragraphCount} paragraphs restyled`
                : "Format transfer complete";

            toast.success(msg);

            // Navigate to report with specific lesson uploaded
            const targetLessonId = data.lessonId || data.run?.lessonId || lessonId;
            if (targetLessonId) {
                router.push(`/lessons/${targetLessonId}/report/${runId}`);
            } else {
                router.push(`/reports`);
            }
        } catch (err: any) {
            setError(err.message || "An error occurred during format transfer");
            setIsTransferring(false);
            setTransferProgress(0);
        }
    };

    // Keyboard shortcut: ⌘↵ to start transfer
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (!isTransferring) {
                    handleTransfer();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isTransferring, targetFile, referenceFile, lessonId, classifier, category]);

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
                    <div className="flex size-5.5 items-center justify-center rounded-full border-1.5 border-primary text-foreground font-bold text-[11px]">
                        2
                    </div>
                    <span>Format transfer</span>
                </div>
                <div className="w-12 h-px bg-border" />
                <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex size-5.5 items-center justify-center rounded-full border border-border text-muted-foreground font-bold text-[11px]">
                        3
                    </div>
                    <span>Review report</span>
                </div>
            </div>

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                        Document Workstation
                    </h1>
                    <p className="text-[13.5px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                        {lesson ? (
                            <>
                                <span>Lesson {lesson.number}</span>
                                <span>·</span>
                                <Badge
                                    variant={
                                        lesson.category === "new_believers"
                                            ? "nb"
                                            : lesson.category === "mentoring"
                                              ? "mt"
                                              : "ld"
                                    }
                                    className="font-medium"
                                >
                                    {CATEGORY_LABELS[lesson.category] ||
                                        lesson.category}
                                </Badge>
                                <span>·</span>
                                <span>
                                    Pair the uploaded lesson with a reference
                                    style template.
                                </span>
                            </>
                        ) : (
                            <span>
                                Pair the uploaded document with a reference
                                style template.
                            </span>
                        )}
                    </p>
                </div>
                <div>
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-1.5"
                    >
                        <Link href="/lessons">
                            <ArrowLeft className="size-4" />
                            <span>Back to lessons</span>
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Workstation Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
                {/* Main Workstation Card */}
                <Card className="shadow-sm border border-border overflow-hidden">
                    <div className="p-5 sm:p-6 space-y-5">
                        {/* Target and Reference File Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Target File */}
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className="font-normal text-[11.5px]"
                                    >
                                        1 · Target
                                    </Badge>
                                    <b className="text-[13.5px] font-medium text-foreground">
                                        Uploaded lesson
                                    </b>
                                </div>

                                <div
                                    onClick={() => targetInputRef.current?.click()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setTargetDragOver(true);
                                    }}
                                    onDragLeave={() => setTargetDragOver(false)}
                                    onDrop={handleTargetDrop}
                                    className={`h-56 rounded-xl border-2 transition-all flex flex-col items-center justify-between p-5 text-center cursor-pointer select-none relative ${
                                        targetDragOver
                                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                            : targetFileName
                                            ? "border-border bg-card hover:bg-muted/30 hover:border-border/80 shadow-xs"
                                            : "border-dashed border-border bg-card/60 hover:bg-muted/40 hover:border-foreground/30"
                                    }`}
                                >
                                    <input
                                        type="file"
                                        ref={targetInputRef}
                                        onChange={handleTargetChange}
                                        accept=".docx"
                                        className="hidden"
                                    />

                                    {targetFileName ? (
                                        <>
                                            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-2xs mt-1">
                                                <FileText className="size-6 text-foreground" />
                                            </div>
                                            <div className="w-full max-w-[280px] space-y-1 px-2">
                                                <b
                                                    className="block text-[13.5px] font-medium truncate text-foreground"
                                                    title={targetFileName}
                                                >
                                                    {targetFileName}
                                                </b>
                                                <small className="text-xs text-muted-foreground block truncate">
                                                    {targetFileSize
                                                        ? `${targetFileSize} · ${lesson ? 'Linked from lesson' : 'Ready'}`
                                                        : "Ready for formatting transfer"}
                                                </small>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    targetInputRef.current?.click();
                                                }}
                                                className="h-8 text-xs font-medium cursor-pointer"
                                            >
                                                Replace document
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mt-1">
                                                <UploadCloud className="size-6" />
                                            </div>
                                            <div className="space-y-1 max-w-[260px] px-2">
                                                <span className="block text-[13.5px] font-medium text-foreground">
                                                    Drop target lesson (.docx)
                                                </span>
                                                <p className="text-xs text-muted-foreground">
                                                    Drag & drop here or click to browse
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    targetInputRef.current?.click();
                                                }}
                                                className="h-8 text-xs font-medium cursor-pointer"
                                            >
                                                Browse file
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <p className="text-[12.5px] text-muted-foreground">
                                    Content is preserved; only styles will be
                                    rewritten.
                                </p>
                            </div>

                            {/* Reference Template */}
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className="font-normal text-[11.5px]"
                                    >
                                        2 · Reference
                                    </Badge>
                                    <b className="text-[13.5px] font-medium text-foreground">
                                        Style template
                                    </b>
                                </div>

                                <div
                                    onClick={() => referenceInputRef.current?.click()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setReferenceDragOver(true);
                                    }}
                                    onDragLeave={() => setReferenceDragOver(false)}
                                    onDrop={handleReferenceDrop}
                                    className={`h-56 rounded-xl border-2 transition-all flex flex-col items-center justify-between p-5 text-center cursor-pointer select-none relative ${
                                        referenceDragOver
                                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                            : referenceFileName
                                            ? "border-border bg-card hover:bg-muted/30 hover:border-border/80 shadow-xs"
                                            : "border-dashed border-border bg-card/60 hover:bg-muted/40 hover:border-foreground/30"
                                    }`}
                                >
                                    <input
                                        type="file"
                                        ref={referenceInputRef}
                                        onChange={handleReferenceChange}
                                        accept=".docx"
                                        className="hidden"
                                    />

                                    {referenceFileName ? (
                                        <>
                                            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-2xs mt-1">
                                                <FileType2 className="size-6 text-foreground" />
                                            </div>
                                            <div className="w-full max-w-[280px] space-y-1 px-2">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <b
                                                        className="text-[13.5px] font-medium truncate text-foreground max-w-[200px]"
                                                        title={referenceFileName}
                                                    >
                                                        {referenceFileName}
                                                    </b>
                                                    <Badge
                                                        variant="ok"
                                                        className="text-[10px] font-medium shrink-0"
                                                    >
                                                        Default
                                                    </Badge>
                                                </div>
                                                <small className="text-xs text-muted-foreground block truncate">
                                                    {referenceFileSize || "Master reference style template"}
                                                </small>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    referenceInputRef.current?.click();
                                                }}
                                                className="h-8 text-xs font-medium cursor-pointer"
                                            >
                                                Change template
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mt-1">
                                                <UploadCloud className="size-6" />
                                            </div>
                                            <div className="space-y-1 max-w-[260px] px-2">
                                                <span className="block text-[13.5px] font-medium text-foreground">
                                                    Drop reference template (.docx)
                                                </span>
                                                <p className="text-xs text-muted-foreground">
                                                    Master typography & geometry source
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    referenceInputRef.current?.click();
                                                }}
                                                className="h-8 text-xs font-medium cursor-pointer"
                                            >
                                                Browse file
                                            </Button>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2.5 pt-0.5">
                                    <Switch
                                        checked={rememberDefault}
                                        onCheckedChange={
                                            handleToggleRememberDefault
                                        }
                                        id="remember-default"
                                    />
                                    <label
                                        htmlFor="remember-default"
                                        className="text-[13px] text-muted-foreground cursor-pointer select-none"
                                    >
                                        Remember as default reference template
                                    </label>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Options: Target Category & Paragraph Classifier */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                            {/* Target Category */}
                            <div className="space-y-1.5">
                                <div>
                                    <b className="text-[13.5px] font-medium text-foreground block">
                                        Target category
                                    </b>
                                    <p className="text-[12.5px] text-muted-foreground mt-0.5">
                                        Curriculum series for the uploaded lesson.
                                    </p>
                                </div>

                                <Select value={category} onValueChange={(val) => setCategory(val)}>
                                    <SelectTrigger className="h-9 w-full max-w-xs text-xs">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => (
                                            <SelectItem key={c.slug} value={c.slug}>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="size-2 rounded-full shrink-0 shadow-2xs"
                                                        style={{ backgroundColor: c.color }}
                                                    />
                                                    <span>{c.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Paragraph Classifier */}
                            <div className="space-y-1.5">
                                <div>
                                    <b className="text-[13.5px] font-medium text-foreground block">
                                        Paragraph classifier
                                    </b>
                                    <p className="text-[12.5px] text-muted-foreground mt-0.5">
                                        Identifies headings, body, and scripture refs.
                                    </p>
                                </div>

                                <div className="inline-flex items-center bg-muted p-0.5 rounded-md text-xs font-medium">
                                    <button
                                        type="button"
                                        onClick={() => setClassifier("heuristic")}
                                        className={`h-7 px-3 rounded-[5px] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                            classifier === "heuristic"
                                                ? "bg-background text-foreground shadow-sm font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Default
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setClassifier("gemini")}
                                        className={`h-7 px-3 rounded-[5px] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                            classifier === "gemini"
                                                ? "bg-background text-foreground shadow-sm font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        <Sparkles className="size-3 text-primary" />
                                        <span>Gemini AI</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle className="size-4" />
                                <AlertTitle>Format transfer failed</AlertTitle>
                                <AlertDescription className="text-xs">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Transfer In-Progress Bar */}
                        {isTransferring && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Transferring styles in-place…</span>
                                    <span>{transferProgress}%</span>
                                </div>
                                <Progress
                                    value={transferProgress}
                                    className="h-1.5"
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer CTA Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 px-5 bg-muted/40 border-t border-border">
                        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                            <CheckCircle2 className="size-4.5 text-[hsl(var(--success))] shrink-0" />
                            <span>
                                {targetFileName && referenceFileName
                                    ? "Both documents ready. Transfer runs in-place on the OOXML — original file is never modified."
                                    : "Select a target document and reference template to begin format transfer."}
                            </span>
                        </div>

                        <Button
                            onClick={handleTransfer}
                            disabled={isTransferring}
                            className="gap-2 shrink-0 h-9 font-medium"
                        >
                            {isTransferring ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    <span>Transferring…</span>
                                </>
                            ) : (
                                <>
                                    <span>Transfer formatting</span>
                                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-primary-foreground/20 px-1.5 font-mono text-[10.5px] font-medium text-inherit">
                                        ⌘↵
                                    </kbd>
                                </>
                            )}
                        </Button>
                    </div>
                </Card>

                {/* Aside: Formatting Guarantees */}
                <Card className="shadow-sm border border-border">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[15px] font-semibold tracking-tight">
                            Formatting guarantees
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-3.5">
                        <ul className="space-y-3">
                            <li className="flex gap-2.5 text-[13px]">
                                <ShieldCheck className="size-4.5 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                    <b className="block font-medium text-foreground">
                                        Zero content loss
                                    </b>
                                    <span className="text-[12px] text-muted-foreground leading-normal block mt-0.5">
                                        Text, tables, images, footnotes, and
                                        citations remain completely intact.
                                    </span>
                                </div>
                            </li>

                            <li className="flex gap-2.5 text-[13px]">
                                <Layers className="size-4.5 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                    <b className="block font-medium text-foreground">
                                        Safe style updates
                                    </b>
                                    <span className="text-[12px] text-muted-foreground leading-normal block mt-0.5">
                                        Only fonts, colors, and styles change.
                                        Document layout will not drift or break.
                                    </span>
                                </div>
                            </li>

                            <li className="flex gap-2.5 text-[13px]">
                                <Ruler className="size-4.5 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                    <b className="block font-medium text-foreground">
                                        Page layout match
                                    </b>
                                    <span className="text-[12px] text-muted-foreground leading-normal block mt-0.5">
                                        Margins, page size, and headers
                                        automatically match the reference file.
                                    </span>
                                </div>
                            </li>
                        </ul>

                        <Separator />

                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                            Reference templates can be managed under{" "}
                            <Link
                                href="/settings/templates"
                                className="font-medium text-foreground hover:underline"
                            >
                                Engine → Reference Templates
                            </Link>
                            .
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
