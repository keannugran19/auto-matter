"use client";

import React, { useState } from "react";

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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        Document Previews
                    </h2>
                    <p className="text-xs text-slate-500">
                        Compare visual layout before and after style transfer
                    </p>
                </div>

                {hasImages && (
                    <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between">
                        {/* View mode toggle */}
                        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
                            <button
                                onClick={() => setViewMode("side-by-side")}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    viewMode === "side-by-side"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "hover:text-slate-900"
                                }`}
                            >
                                Split View
                            </button>
                            <button
                                onClick={() => setViewMode("before")}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    viewMode === "before"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "hover:text-slate-900"
                                }`}
                            >
                                Original
                            </button>
                            <button
                                onClick={() => setViewMode("after")}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    viewMode === "after"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "hover:text-slate-900"
                                }`}
                            >
                                Restyled
                            </button>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage <= 0}
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(0, p - 1),
                                        )
                                    }
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                                    title="Previous Page"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                </button>
                                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                                <button
                                    disabled={currentPage >= totalPages - 1}
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages - 1, p + 1),
                                        )
                                    }
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                                    title="Next Page"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!hasImages ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">
                        Preview Rendering Notice
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mt-1">
                        Visual page snapshots require headless LibreOffice in
                        the backend container. Your DOCX document has been
                        restyled and is fully ready for download below!
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
                    {(viewMode === "side-by-side" || viewMode === "before") && (
                        <div className="flex flex-col items-center">
                            <div className="w-full flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Before (Original)
                                </span>
                                <span className="text-xs text-slate-400 truncate max-w-[200px]">
                                    {targetName || "target.docx"}
                                </span>
                            </div>
                            <div className="w-full aspect-[1/1.414] bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200 flex items-center justify-center">
                                {beforePages[currentPage] ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={beforePages[currentPage]}
                                        alt={`Original page ${currentPage + 1}`}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <span className="text-xs text-slate-400">
                                        No page preview
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* After Pane */}
                    {(viewMode === "side-by-side" || viewMode === "after") && (
                        <div className="flex flex-col items-center">
                            <div className="w-full flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                                    After (Restyled)
                                </span>
                                <span className="text-xs text-emerald-600 bg-emerald-50 font-medium px-2 py-0.5 rounded-full">
                                    Format Transfer Applied
                                </span>
                            </div>
                            <div className="w-full aspect-[1/1.414] bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200 flex items-center justify-center">
                                {afterPages[currentPage] ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={afterPages[currentPage]}
                                        alt={`Restyled page ${currentPage + 1}`}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <span className="text-xs text-slate-400">
                                        No page preview
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
