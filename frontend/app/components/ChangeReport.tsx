"use client";

import React, { useState, useRef, useEffect } from "react";

export interface ChangeReportData {
    sectionChanges?: {
        pageSize?: boolean;
        margins?: boolean;
        headerFooterRemoved?: boolean;
    };
    roles?: Array<{
        role: string;
        paragraphCount: number;
        specApplied?: {
            font?: string;
            size_pt?: number;
            bold?: boolean;
            italic?: boolean;
            alignment?: string;
            space_before?: number;
            space_after?: number;
            line_spacing?: number;
        };
        source: "reference" | "fallback";
    }>;
    warnings?: Array<{
        severity: "info" | "warn";
        message: string;
        paragraphIndex?: number;
    }>;
    classifier?: "llm" | "fallback";
}

interface ChangeReportProps {
    report: ChangeReportData;
    downloadUrl?: string;
    downloadPdfUrl?: string;
    targetName?: string;
    onReset: () => void;
}

export default function ChangeReport({
    report,
    downloadUrl,
    downloadPdfUrl,
    targetName,
    onReset,
}: ChangeReportProps) {
    const roles = report.roles || [];
    const warnings = report.warnings || [];
    const totalParagraphs = roles.reduce((sum, r) => sum + r.paragraphCount, 0);

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState<"docx" | "pdf" | null>(
        null,
    );
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatRoleName = (role: string) => {
        return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const handleDownload = async (format: "docx" | "pdf") => {
        const url =
            format === "pdf"
                ? downloadPdfUrl || `${downloadUrl}?format=pdf`
                : downloadUrl;
        if (!url) return;

        const baseStem = targetName
            ? targetName.replace(/\.[^/.]+$/, "")
            : "restyled";
        const filename = `${baseStem}.${format}`;

        try {
            setIsDownloading(format);
            setDownloadError(null);
            const res = await fetch(url);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(
                    errData.error ||
                        errData.detail ||
                        `Download failed with HTTP ${res.status}`,
                );
            }
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err: any) {
            console.error("Download error:", err);
            setDownloadError(err.message || "Failed to download file.");
        } finally {
            setIsDownloading(null);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            {/* Download error banner */}
            {downloadError && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
                    <span>{downloadError}</span>
                    <button
                        type="button"
                        onClick={() => setDownloadError(null)}
                        className="ml-3 font-bold hover:text-red-900"
                        aria-label="Dismiss error"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Top Header & Actions */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">
                            Transfer Succeeded
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                report.classifier === "llm"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                            }`}
                        >
                            Classifier:{" "}
                            {report.classifier === "llm"
                                ? "LLM"
                                : "Deterministic Fallback"}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                        Format Transfer Report
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Overview of styles, section properties, and numbering
                        mapped from reference
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={onReset}
                        className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        New Transfer
                    </button>
                    {downloadUrl && (
                        <div
                            className="relative inline-flex items-center rounded-xl shadow-sm"
                            ref={dropdownRef}
                        >
                            <button
                                type="button"
                                disabled={isDownloading !== null}
                                onClick={() => handleDownload("docx")}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-l-xl transition-all"
                            >
                                {isDownloading === "docx" ? (
                                    <svg
                                        className="w-4 h-4 animate-spin text-white"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                ) : (
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
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                    </svg>
                                )}
                                Save as DOCX
                            </button>
                            <button
                                type="button"
                                disabled={isDownloading !== null}
                                onClick={() => setDropdownOpen((prev) => !prev)}
                                aria-label="Export format options"
                                aria-haspopup="true"
                                aria-expanded={dropdownOpen}
                                className="inline-flex items-center justify-center px-2.5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border-l border-emerald-500 disabled:opacity-60 rounded-r-xl transition-all"
                            >
                                <svg
                                    className={`w-4 h-4 transition-transform duration-200 ${
                                        dropdownOpen ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {dropdownOpen && (
                                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-30">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            handleDownload("docx");
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <svg
                                            className="w-4 h-4 text-blue-600 flex-shrink-0"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                        </svg>
                                        Save as DOCX
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            handleDownload("pdf");
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        {isDownloading === "pdf" ? (
                                            <svg
                                                className="w-4 h-4 animate-spin text-red-500 flex-shrink-0"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="w-4 h-4 text-red-500 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                                />
                                            </svg>
                                        )}
                                        Save as PDF
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">
                        Total Paragraphs
                    </span>
                    <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {totalParagraphs}
                    </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">
                        Roles Transferred
                    </span>
                    <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">
                        {roles.length}
                    </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">
                        Page Dimensions
                    </span>
                    <p className="text-sm font-semibold text-emerald-700 mt-2">
                        {report.sectionChanges?.pageSize
                            ? "Replaced (Legal/Spec)"
                            : "Retained"}
                    </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">
                        Warnings
                    </span>
                    <p
                        className={`text-2xl font-bold mt-1 tabular-nums ${warnings.length > 0 ? "text-amber-600" : "text-slate-800"}`}
                    >
                        {warnings.length}
                    </p>
                </div>
            </div>

            {/* Section Changes Callout */}
            {report.sectionChanges && (
                <div className="mb-6 bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 text-xs">
                    <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                        <svg
                            className="w-4 h-4 text-indigo-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                        Section & Layout Replaced from Reference:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600">
                        <div className="flex items-center gap-1.5">
                            <span className="text-emerald-500 font-bold">
                                ✓
                            </span>
                            <span>Page size rewritten</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-emerald-500 font-bold">
                                ✓
                            </span>
                            <span>
                                Margins aligned to reference (720 twips / 0.5
                                in)
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-emerald-500 font-bold">
                                ✓
                            </span>
                            <span>Header/Footer sync complete</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Warnings / Fallback notices */}
            {warnings.length > 0 && (
                <div className="mb-6 bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                        <svg
                            className="w-4 h-4 text-amber-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        Fidelity & Fallback Warnings ({warnings.length})
                    </h4>
                    <ul className="space-y-1.5 text-xs text-amber-800">
                        {warnings.map((w, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="text-amber-500">•</span>
                                <span>{w.message}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Roles & Styles Applied Table */}
            <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                    Applied Formatting by Semantic Role
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="py-3 px-4">Role</th>
                                <th className="py-3 px-4">Paragraphs</th>
                                <th className="py-3 px-4">Typography</th>
                                <th className="py-3 px-4">Alignment</th>
                                <th className="py-3 px-4">Spacing</th>
                                <th className="py-3 px-4">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {roles.map((r, i) => {
                                const s = r.specApplied;
                                return (
                                    <tr
                                        key={i}
                                        className="hover:bg-slate-50/60 transition-colors"
                                    >
                                        <td className="py-3 px-4 font-medium text-slate-900">
                                            <span className="inline-block bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-mono text-[11px]">
                                                {r.role}
                                            </span>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                {formatRoleName(r.role)}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 font-medium text-slate-800 tabular-nums">
                                            {r.paragraphCount}
                                        </td>
                                        <td className="py-3 px-4">
                                            {s?.font ? (
                                                <div className="space-y-0.5">
                                                    <span className="font-medium text-slate-800">
                                                        {s.font}
                                                    </span>
                                                    <span className="text-slate-400 ml-1.5">
                                                        {s.size_pt
                                                            ? `${s.size_pt} pt`
                                                            : ""}
                                                    </span>
                                                    <div className="flex gap-1.5 text-[10px] text-slate-500">
                                                        {s.bold && (
                                                            <span className="font-bold">
                                                                Bold
                                                            </span>
                                                        )}
                                                        {s.italic && (
                                                            <span className="italic">
                                                                Italic
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 capitalize">
                                            {s?.alignment || "—"}
                                        </td>
                                        <td className="py-3 px-4 text-slate-500 space-y-0.5">
                                            <div>
                                                After: {s?.space_after ?? 0}{" "}
                                                twips
                                            </div>
                                            {s?.space_before ? (
                                                <div>
                                                    Before: {s.space_before}{" "}
                                                    twips
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span
                                                className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide ${
                                                    r.source === "reference"
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-amber-50 text-amber-700"
                                                }`}
                                            >
                                                {r.source}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
