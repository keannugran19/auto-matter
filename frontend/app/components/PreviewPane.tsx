"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface PreviewPaneProps {
    previews?: {
        before: string[];
        after: string[];
    };
    targetName?: string;
    referenceName?: string;
}

export default function PreviewPane({
    previews,
    targetName,
}: PreviewPaneProps) {
    const [currentPage, setCurrentPage] = useState(0);
    const [viewMode, setViewMode] = useState<
        "side-by-side" | "before" | "after"
    >("side-by-side");

    const beforePages = previews?.before || [];
    const afterPages = previews?.after || [];
    const totalPages = Math.max(beforePages.length, afterPages.length);

    const hasImages = totalPages > 0;

    return (
        <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-border">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">
                            Document Previews
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Visual comparison before and after format transfer
                        </p>
                    </div>

                    {hasImages && (
                        <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto justify-between">
                            {/* View mode toggle using shadcn Tabs */}
                            <Tabs
                                value={viewMode}
                                onValueChange={(val) =>
                                    setViewMode(
                                        val as
                                            | "side-by-side"
                                            | "before"
                                            | "after",
                                    )
                                }
                            >
                                <TabsList className="bg-muted">
                                    <TabsTrigger
                                        value="side-by-side"
                                        className="text-xs"
                                    >
                                        Split View
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="before"
                                        className="text-xs"
                                    >
                                        Original
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="after"
                                        className="text-xs"
                                    >
                                        Restyled
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={currentPage <= 0}
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.max(0, p - 1),
                                            )
                                        }
                                        className="h-8 w-8 rounded-lg cursor-pointer"
                                        title="Previous Page"
                                        aria-label="Previous Page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <span className="text-xs font-semibold text-foreground tabular-nums px-1">
                                        Page {currentPage + 1} of {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={currentPage >= totalPages - 1}
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.min(totalPages - 1, p + 1),
                                            )
                                        }
                                        className="h-8 w-8 rounded-lg cursor-pointer"
                                        title="Next Page"
                                        aria-label="Next Page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!hasImages ? (
                    <div className="flex flex-col items-center justify-center p-10 text-center bg-muted/30 border border-dashed border-border rounded-xl">
                        <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mb-3">
                            <Eye className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">
                            Preview Rendering Notice
                        </h4>
                        <p className="text-xs text-muted-foreground max-w-md mt-1 leading-relaxed">
                            Visual page snapshots require headless LibreOffice
                            in the backend environment. Your DOCX document has
                            been restyled and is ready for download!
                        </p>
                    </div>
                ) : (
                    <div
                        className={`grid gap-6 ${
                            viewMode === "side-by-side"
                                ? "grid-cols-1 md:grid-cols-2"
                                : "grid-cols-1"
                        }`}
                    >
                        {/* Before Pane */}
                        {(viewMode === "side-by-side" ||
                            viewMode === "before") && (
                            <div className="flex flex-col items-center">
                                <div className="w-full flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Before (Original)
                                    </span>
                                    <span className="text-xs text-fg-subtle truncate max-w-[200px]">
                                        {targetName || "target.docx"}
                                    </span>
                                </div>
                                <div className="w-full aspect-[1/1.414] bg-muted/40 rounded-xl overflow-hidden shadow-inner border border-border flex items-center justify-center p-2">
                                    {beforePages[currentPage] ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={beforePages[currentPage]}
                                            alt={`Original page ${currentPage + 1}`}
                                            className="w-full h-full object-contain bg-white rounded shadow-sm border border-border/40"
                                        />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            No page preview
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* After Pane */}
                        {(viewMode === "side-by-side" ||
                            viewMode === "after") && (
                            <div className="flex flex-col items-center">
                                <div className="w-full flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                                        After (Restyled)
                                    </span>
                                    <Badge
                                        variant="ok"
                                        className="font-medium text-xs"
                                    >
                                        Format Transfer Applied
                                    </Badge>
                                </div>
                                <div className="w-full aspect-[1/1.414] bg-muted/40 rounded-xl overflow-hidden shadow-inner border border-border flex items-center justify-center p-2">
                                    {afterPages[currentPage] ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={afterPages[currentPage]}
                                            alt={`Restyled page ${currentPage + 1}`}
                                            className="w-full h-full object-contain bg-white rounded shadow-sm border border-border/40"
                                        />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            No page preview
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
