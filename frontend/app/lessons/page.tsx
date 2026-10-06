"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Download,
    Plus,
    Library,
    ListFilter,
    SlidersHorizontal,
    Ellipsis,
    Pencil,
    ClipboardCheck,
    FileCog,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Check,
    FileText,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { DeleteLessonDialog } from "@/components/lessons/delete-lesson-dialog";
import { Lesson, Category, CATEGORY_LABELS } from "@/lib/types";

export default function LessonsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get("category");

    const [lessons, setLessons] = React.useState<Lesson[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
        new Set(),
    );
    const [page, setPage] = React.useState(1);
    const pageSize = 10;

    // Column visibility
    const [columnVisibility, setColumnVisibility] = React.useState({
        number: true,
        title: true,
        category: true,
        series: true,
        format: true,
        updated: true,
    });

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
    const [lessonToDelete, setLessonToDelete] = React.useState<Lesson | null>(
        null,
    );
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(false);

    // Active Category filter
    const activeCategory = React.useMemo<string>(() => {
        if (categoryParam === "nb") return "new_believers";
        if (categoryParam === "mt") return "mentoring";
        if (categoryParam === "ld") return "leadership";
        if (categoryParam) return categoryParam;
        return "all";
    }, [categoryParam]);

    const fetchLessons = React.useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/lessons");
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setLessons(data);
                }
            }
        } catch {
            toast.error("Failed to load lessons");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchLessons();
    }, [fetchLessons]);

    const handleSync = async () => {
        try {
            setIsSyncing(true);
            const res = await fetch("/api/lessons/sync", { method: "POST" });
            if (!res.ok) throw new Error("Failed to sync storage lessons");
            const data = await res.json();
            const count = data.count ?? data.lessons?.length ?? 42;
            toast.success(`Synced ${count} lessons from storage`);
            fetchLessons();
        } catch (err: any) {
            toast.error(err.message || "Failed to sync lessons");
        } finally {
            setIsSyncing(false);
        }
    };

    React.useEffect(() => {
        const handleRefresh = () => fetchLessons();
        window.addEventListener("refresh-lessons", handleRefresh);
        return () =>
            window.removeEventListener("refresh-lessons", handleRefresh);
    }, [fetchLessons]);

    // Statistics
    const stats = React.useMemo(() => {
        const total = lessons.length;
        const nb = lessons.filter((l) => l.category === "new_believers").length;
        const mt = lessons.filter((l) => l.category === "mentoring").length;
        const ld = lessons.filter((l) => l.category === "leadership").length;
        const needsTransfer = lessons.filter(
            (l) => l.formatStatus === "needs_transfer",
        ).length;
        return { total, nb, mt, ld, needsTransfer };
    }, [lessons]);

    // Filtered lessons
    const filteredLessons = React.useMemo(() => {
        return lessons.filter((lesson) => {
            // Category filter
            if (
                activeCategory !== "all" &&
                lesson.category !== activeCategory
            ) {
                return false;
            }

            // Status filter
            if (
                statusFilter === "formatted" &&
                lesson.formatStatus !== "formatted"
            ) {
                return false;
            }
            if (
                statusFilter === "needs_transfer" &&
                lesson.formatStatus !== "needs_transfer"
            ) {
                return false;
            }
            if (statusFilter === "draft" && lesson.status !== "draft") {
                return false;
            }
            if (statusFilter === "published" && lesson.status !== "published") {
                return false;
            }

            // Text search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = lesson.title.toLowerCase().includes(q);
                const matchesNum = lesson.number.toString().includes(q);
                const matchesSeries = (lesson.series || "")
                    .toLowerCase()
                    .includes(q);
                if (!matchesTitle && !matchesNum && !matchesSeries)
                    return false;
            }

            return true;
        });
    }, [lessons, activeCategory, statusFilter, searchQuery]);

    // Pagination
    const totalPages = Math.max(
        1,
        Math.ceil(filteredLessons.length / pageSize),
    );
    const paginatedLessons = React.useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredLessons.slice(start, start + pageSize);
    }, [filteredLessons, page, pageSize]);

    // Selection
    const isAllSelected =
        paginatedLessons.length > 0 &&
        paginatedLessons.every((l) => selectedIds.has(l.id));

    const toggleSelectAll = () => {
        const next = new Set(selectedIds);
        if (isAllSelected) {
            paginatedLessons.forEach((l) => next.delete(l.id));
        } else {
            paginatedLessons.forEach((l) => next.add(l.id));
        }
        setSelectedIds(next);
    };

    const toggleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleCategoryTab = (cat: string) => {
        setPage(1);
        if (cat === "all") {
            router.push("/lessons");
        } else if (cat === "new_believers") {
            router.push("/lessons?category=nb");
        } else if (cat === "mentoring") {
            router.push("/lessons?category=mt");
        } else if (cat === "leadership") {
            router.push("/lessons?category=ld");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!lessonToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/lessons/${lessonToDelete.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete lesson");
            toast.success(`Lesson #${lessonToDelete.number} deleted`);
            setDeleteModalOpen(false);
            setLessonToDelete(null);
            fetchLessons();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete");
        } finally {
            setIsDeleting(false);
        }
    };

    const openAddLesson = () => {
        window.dispatchEvent(new CustomEvent("open-add-lesson"));
    };

    const openEditLesson = (lesson: Lesson) => {
        window.dispatchEvent(
            new CustomEvent("open-edit-lesson", { detail: lesson }),
        );
    };

    const formatRelativeTime = (isoString: string) => {
        try {
            const diffDays = Math.round(
                (Date.now() - new Date(isoString).getTime()) /
                    (1000 * 60 * 60 * 24),
            );
            if (diffDays <= 0) return "Today";
            if (diffDays === 1) return "Yesterday";
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 14) return "1 week ago";
            if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks ago`;
            return new Date(isoString).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
            });
        } catch {
            return "Recently";
        }
    };

    const pageTitle =
        activeCategory === "new_believers"
            ? "New Believers"
            : activeCategory === "mentoring"
              ? "Mentoring"
              : activeCategory === "leadership"
                ? "Leadership"
                : "Lessons";

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                        {pageTitle}
                    </h1>
                    <p className="text-[13.5px] text-muted-foreground mt-0.5">
                        Every One Life lesson in the library. Upload a new one
                        to run it through the format engine.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="h-9 gap-1.5 cursor-pointer"
                    >
                        <RefreshCw
                            className={`size-4 ${isSyncing ? "animate-spin" : ""}`}
                        />
                        <span>Sync Storage</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const blob = new Blob(
                                [JSON.stringify(filteredLessons, null, 2)],
                                { type: "application/json" },
                            );
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `lessons-${activeCategory}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("Lessons exported");
                        }}
                        className="h-9 gap-1.5 cursor-pointer"
                    >
                        <Download className="size-4" />
                        <span>Export</span>
                    </Button>
                    <Button
                        onClick={openAddLesson}
                        size="sm"
                        className="h-9 gap-1.5 cursor-pointer"
                    >
                        <Plus className="size-4" />
                        <span>Add lesson</span>
                    </Button>
                </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Card className="p-4 shadow-sm">
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                        <span>Total lessons</span>
                        <Library className="size-4 text-muted-foreground" />
                    </div>
                    <div className="text-[26px] font-semibold tracking-tight tabular-nums mt-1 text-foreground">
                        {stats.total}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {stats.total > 0 ? `${stats.total} total` : "No lessons yet"}
                    </div>
                </Card>

                <Card className="p-4 shadow-sm">
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                        <span>New Believers</span>
                        <span className="size-2 rounded-full bg-[hsl(var(--nb))]" />
                    </div>
                    <div className="text-[26px] font-semibold tracking-tight tabular-nums mt-1 text-foreground">
                        {stats.nb}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {stats.nb > 0 ? `${stats.nb} lesson${stats.nb === 1 ? "" : "s"}` : "No lessons"}
                    </div>
                </Card>

                <Card className="p-4 shadow-sm">
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                        <span>Mentoring</span>
                        <span className="size-2 rounded-full bg-[hsl(var(--mt))]" />
                    </div>
                    <div className="text-[26px] font-semibold tracking-tight tabular-nums mt-1 text-foreground">
                        {stats.mt}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {stats.mt > 0 ? `${stats.mt} lesson${stats.mt === 1 ? "" : "s"}` : "No lessons"}
                    </div>
                </Card>

                <Card className="p-4 shadow-sm">
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                        <span>Leadership</span>
                        <span className="size-2 rounded-full bg-[hsl(var(--ld))]" />
                    </div>
                    <div className="text-[26px] font-semibold tracking-tight tabular-nums mt-1 text-foreground">
                        {stats.ld}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        {stats.needsTransfer > 0
                            ? `${stats.needsTransfer} need format transfer`
                            : "All up to date"}
                    </div>
                </Card>
            </div>

            {/* Main Card with Data Table */}
            <Card className="shadow-sm overflow-hidden border border-border">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5 p-3.5 border-b border-border bg-card">
                    {/* Category Tabs */}
                    <div className="inline-flex items-center bg-muted p-0.5 rounded-md text-xs font-medium">
                        <button
                            onClick={() => handleCategoryTab("all")}
                            className={`h-7 px-3 rounded-[5px] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeCategory === "all"
                                    ? "bg-background text-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <span>All</span>
                            <span className="text-[11px] opacity-75 tabular-nums">
                                {stats.total}
                            </span>
                        </button>
                        <button
                            onClick={() => handleCategoryTab("new_believers")}
                            className={`h-7 px-3 rounded-[5px] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeCategory === "new_believers"
                                    ? "bg-background text-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <span className="size-2 rounded-full bg-[hsl(var(--nb))]" />
                            <span>New Believers</span>
                            <span className="text-[11px] opacity-75 tabular-nums">
                                {stats.nb}
                            </span>
                        </button>
                        <button
                            onClick={() => handleCategoryTab("mentoring")}
                            className={`h-7 px-3 rounded-[5px] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeCategory === "mentoring"
                                    ? "bg-background text-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <span className="size-2 rounded-full bg-[hsl(var(--mt))]" />
                            <span>Mentoring</span>
                            <span className="text-[11px] opacity-75 tabular-nums">
                                {stats.mt}
                            </span>
                        </button>
                        <button
                            onClick={() => handleCategoryTab("leadership")}
                            className={`h-7 px-3 rounded-[5px] inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeCategory === "leadership"
                                    ? "bg-background text-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <span className="size-2 rounded-full bg-[hsl(var(--ld))]" />
                            <span>Leadership</span>
                            <span className="text-[11px] opacity-75 tabular-nums">
                                {stats.ld}
                            </span>
                        </button>
                    </div>

                    {/* Search Filter */}
                    <div className="w-64">
                        <Input
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Filter by title or series…"
                            className="h-8 text-xs"
                        />
                    </div>

                    {/* Status Faceted Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 cursor-pointer"
                            >
                                <ListFilter className="size-3.5" />
                                <span>
                                    {statusFilter === "all"
                                        ? "Status"
                                        : statusFilter === "formatted"
                                          ? "Formatted"
                                          : statusFilter === "needs_transfer"
                                            ? "Needs transfer"
                                            : statusFilter === "draft"
                                              ? "Draft"
                                              : "Published"}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuLabel className="text-xs">
                                Filter by status
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setStatusFilter("all")}
                                className="text-xs cursor-pointer"
                            >
                                All statuses
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setStatusFilter("formatted")}
                                className="text-xs cursor-pointer"
                            >
                                Formatted
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    setStatusFilter("needs_transfer")
                                }
                                className="text-xs cursor-pointer"
                            >
                                Needs transfer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setStatusFilter("draft")}
                                className="text-xs cursor-pointer"
                            >
                                Draft
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setStatusFilter("published")}
                                className="text-xs cursor-pointer"
                            >
                                Published
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* View Columns Toggle */}
                    <div className="ml-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 cursor-pointer"
                                >
                                    <SlidersHorizontal className="size-3.5" />
                                    <span>View</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuLabel className="text-xs">
                                    Toggle columns
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={columnVisibility.number}
                                    onCheckedChange={(c) =>
                                        setColumnVisibility((prev) => ({
                                            ...prev,
                                            number: Boolean(c),
                                        }))
                                    }
                                    className="text-xs"
                                >
                                    # (Number)
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={columnVisibility.title}
                                    onCheckedChange={(c) =>
                                        setColumnVisibility((prev) => ({
                                            ...prev,
                                            title: Boolean(c),
                                        }))
                                    }
                                    className="text-xs"
                                >
                                    Title
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={columnVisibility.category}
                                    onCheckedChange={(c) =>
                                        setColumnVisibility((prev) => ({
                                            ...prev,
                                            category: Boolean(c),
                                        }))
                                    }
                                    className="text-xs"
                                >
                                    Category
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={columnVisibility.series}
                                    onCheckedChange={(c) =>
                                        setColumnVisibility((prev) => ({
                                            ...prev,
                                            series: Boolean(c),
                                        }))
                                    }
                                    className="text-xs"
                                >
                                    Series
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={columnVisibility.format}
                                    onCheckedChange={(c) =>
                                        setColumnVisibility((prev) => ({
                                            ...prev,
                                            format: Boolean(c),
                                        }))
                                    }
                                    className="text-xs"
                                >
                                    Format
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={columnVisibility.updated}
                                    onCheckedChange={(c) =>
                                        setColumnVisibility((prev) => ({
                                            ...prev,
                                            updated: Boolean(c),
                                        }))
                                    }
                                    className="text-xs"
                                >
                                    Updated
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13.5px] border-collapse">
                        <thead>
                            <tr className="border-b border-border text-[12.5px] text-muted-foreground h-11 bg-muted/20">
                                <th className="w-10 px-3.5 py-2">
                                    <Checkbox
                                        checked={isAllSelected}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </th>
                                {columnVisibility.number && (
                                    <th className="w-16 px-3.5 py-2 font-medium">
                                        #
                                    </th>
                                )}
                                {columnVisibility.title && (
                                    <th className="px-3.5 py-2 font-medium">
                                        Title
                                    </th>
                                )}
                                {columnVisibility.category && (
                                    <th className="px-3.5 py-2 font-medium">
                                        Category
                                    </th>
                                )}
                                {columnVisibility.series && (
                                    <th className="px-3.5 py-2 font-medium">
                                        Series
                                    </th>
                                )}
                                {columnVisibility.format && (
                                    <th className="px-3.5 py-2 font-medium">
                                        Format
                                    </th>
                                )}
                                {columnVisibility.updated && (
                                    <th className="px-3.5 py-2 font-medium">
                                        Updated
                                    </th>
                                )}
                                <th className="w-12 px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="h-12">
                                        <td className="px-3.5 py-3">
                                            <Skeleton className="h-4 w-4" />
                                        </td>
                                        {columnVisibility.number && (
                                            <td className="px-3.5 py-3">
                                                <Skeleton className="h-4 w-6" />
                                            </td>
                                        )}
                                        {columnVisibility.title && (
                                            <td className="px-3.5 py-3">
                                                <Skeleton className="h-4 w-48" />
                                            </td>
                                        )}
                                        {columnVisibility.category && (
                                            <td className="px-3.5 py-3">
                                                <Skeleton className="h-5 w-20 rounded-full" />
                                            </td>
                                        )}
                                        {columnVisibility.series && (
                                            <td className="px-3.5 py-3">
                                                <Skeleton className="h-4 w-28" />
                                            </td>
                                        )}
                                        {columnVisibility.format && (
                                            <td className="px-3.5 py-3">
                                                <Skeleton className="h-4 w-16 rounded" />
                                            </td>
                                        )}
                                        {columnVisibility.updated && (
                                            <td className="px-3.5 py-3">
                                                <Skeleton className="h-4 w-16" />
                                            </td>
                                        )}
                                        <td className="px-3 py-3">
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                        </td>
                                    </tr>
                                ))
                            ) : paginatedLessons.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="h-48 text-center text-muted-foreground text-sm"
                                    >
                                        <p className="font-medium text-foreground">
                                            No lessons found
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {searchQuery
                                                ? "Try adjusting your search query or filters."
                                                : "Get started by adding your first lesson."}
                                        </p>
                                        <Button
                                            onClick={openAddLesson}
                                            variant="outline"
                                            size="sm"
                                            className="mt-4 gap-1.5"
                                        >
                                            <Plus className="size-4" />
                                            <span>Add lesson</span>
                                        </Button>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLessons.map((lesson) => {
                                    const isSelected = selectedIds.has(
                                        lesson.id,
                                    );
                                    return (
                                        <tr
                                            key={lesson.id}
                                            className={`transition-colors hover:bg-muted/40 ${
                                                isSelected ? "bg-muted/30" : ""
                                            }`}
                                        >
                                            <td className="px-3.5 py-2.5">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() =>
                                                        toggleSelectRow(
                                                            lesson.id,
                                                        )
                                                    }
                                                    aria-label={`Select lesson ${lesson.number}`}
                                                />
                                            </td>

                                            {columnVisibility.number && (
                                                <td className="px-3.5 py-2.5 text-muted-foreground tabular-nums font-mono text-[13px]">
                                                    {lesson.number}
                                                </td>
                                            )}

                                            {columnVisibility.title && (
                                                <td className="px-3.5 py-2.5">
                                                    <div className="flex items-center gap-2 max-w-md">
                                                        <button
                                                            onClick={() =>
                                                                router.push(
                                                                    `/lessons/${lesson.id}/workstation`,
                                                                )
                                                            }
                                                            className="font-medium text-left hover:underline text-foreground cursor-pointer truncate"
                                                        >
                                                            {lesson.title}
                                                        </button>
                                                        {lesson.pdfUrl && (
                                                            <a
                                                                href={lesson.pdfUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) =>
                                                                    e.stopPropagation()
                                                                }
                                                                className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded border border-border/60 transition-colors shrink-0 cursor-pointer"
                                                                title="Open PDF"
                                                            >
                                                                <FileText className="size-3 text-red-500/80" />
                                                                <span>PDF</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            )}

                                            {columnVisibility.category && (
                                                <td className="px-3.5 py-2.5">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white shadow-xs ${
                                                            lesson.category ===
                                                            "new_believers"
                                                                ? "bg-emerald-500/80 dark:bg-emerald-600/80"
                                                                : lesson.category ===
                                                                    "mentoring"
                                                                  ? "bg-amber-500/85 dark:bg-amber-600/80"
                                                                  : "bg-violet-500/80 dark:bg-violet-600/80"
                                                        }`}
                                                    >
                                                        {CATEGORY_LABELS[
                                                            lesson.category
                                                        ] || lesson.category}
                                                    </span>
                                                </td>
                                            )}

                                            {columnVisibility.series && (
                                                <td className="px-3.5 py-2.5 text-muted-foreground text-[13px] truncate max-w-xs">
                                                    {lesson.series || "—"}
                                                </td>
                                            )}

                                            {columnVisibility.format && (
                                                <td className="px-3.5 py-2.5">
                                                    {lesson.formatStatus ===
                                                    "formatted" ? (
                                                        <Badge
                                                            variant="ok"
                                                            className="gap-1 font-medium"
                                                        >
                                                            Formatted
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="warn"
                                                            className="gap-1 font-medium"
                                                        >
                                                            Needs transfer
                                                        </Badge>
                                                    )}
                                                </td>
                                            )}

                                            {columnVisibility.updated && (
                                                <td className="px-3.5 py-2.5 text-muted-foreground text-[13px]">
                                                    {formatRelativeTime(
                                                        lesson.updatedAt ||
                                                            lesson.createdAt,
                                                    )}
                                                </td>
                                            )}

                                            <td className="px-3 py-2.5 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                                        >
                                                            <Ellipsis className="size-4" />
                                                            <span className="sr-only">
                                                                Row menu
                                                            </span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-52"
                                                    >
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                openEditLesson(
                                                                    lesson,
                                                                )
                                                            }
                                                            className="cursor-pointer gap-2"
                                                        >
                                                            <Pencil className="size-3.5 text-muted-foreground" />
                                                            <span>
                                                                Edit details
                                                            </span>
                                                        </DropdownMenuItem>

                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                router.push(
                                                                    `/lessons/${lesson.id}/report/${
                                                                        lesson.latestRunId ||
                                                                        "run-default-37"
                                                                    }`,
                                                                )
                                                            }
                                                            className="cursor-pointer gap-2"
                                                        >
                                                            <ClipboardCheck className="size-3.5 text-muted-foreground" />
                                                            <span>
                                                                View transfer
                                                                report
                                                            </span>
                                                        </DropdownMenuItem>

                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                router.push(
                                                                    `/lessons/${lesson.id}/workstation`,
                                                                )
                                                            }
                                                            className="cursor-pointer gap-2"
                                                        >
                                                            <FileCog className="size-3.5 text-muted-foreground" />
                                                            <span>
                                                                Re-run format
                                                                transfer
                                                            </span>
                                                        </DropdownMenuItem>

                                                        {lesson.pdfUrl && (
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    window.open(
                                                                        lesson.pdfUrl,
                                                                        "_blank",
                                                                    );
                                                                }}
                                                                className="cursor-pointer gap-2"
                                                            >
                                                                <FileText className="size-3.5 text-muted-foreground" />
                                                                <span>
                                                                    View / Download PDF
                                                                </span>
                                                            </DropdownMenuItem>
                                                        )}

                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                toast.success(
                                                                    `Downloading ${
                                                                        lesson.originalFileName ||
                                                                        `lesson-${lesson.number}.docx`
                                                                    }`,
                                                                );
                                                            }}
                                                            className="cursor-pointer gap-2"
                                                        >
                                                            <Download className="size-3.5 text-muted-foreground" />
                                                            <span>
                                                                Download .docx
                                                            </span>
                                                        </DropdownMenuItem>

                                                        <DropdownMenuSeparator />

                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setLessonToDelete(
                                                                    lesson,
                                                                );
                                                                setDeleteModalOpen(
                                                                    true,
                                                                );
                                                            }}
                                                            className="text-destructive focus:text-destructive cursor-pointer gap-2"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                            <span>Delete</span>
                                                            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                                                                ⌫
                                                            </span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pager Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[13px] text-muted-foreground bg-card">
                    <div className="flex items-center gap-6">
                        <span>
                            {selectedIds.size} of {filteredLessons.length}{" "}
                            row(s) selected.
                        </span>
                        <span className="hidden sm:inline">
                            Rows per page{" "}
                            <b className="text-foreground font-medium">
                                {pageSize}
                            </b>
                        </span>
                        <span>
                            Page {page} of {totalPages}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="size-4" />
                            <span className="sr-only">Previous page</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={page >= totalPages}
                            onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                            }
                        >
                            <ChevronRight className="size-4" />
                            <span className="sr-only">Next page</span>
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Delete Confirmation Alert Dialog */}
            <DeleteLessonDialog
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                lesson={lessonToDelete}
                onConfirm={handleDeleteConfirm}
                isDeleting={isDeleting}
            />
        </div>
    );
}
