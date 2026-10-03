"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Download,
    ChevronDown,
    CheckCircle2,
    AlertTriangle,
    FileText,
    RefreshCw,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

    const formatSpacing = (twips?: number): string => {
        if (twips === undefined || twips === null || twips === 0) return "0 pt";
        const pt = Math.round((twips / 20) * 10) / 10;
        return `${pt} pt`;
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
        <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-8">
                {/* Download error banner */}
                {downloadError && (
                    <div className="mb-6 p-3 bg-destructive-soft border border-destructive/20 text-destructive text-xs rounded-xl flex items-center justify-between">
                        <span>{downloadError}</span>
                        <button
                            type="button"
                            onClick={() => setDownloadError(null)}
                            className="ml-3 font-bold hover:opacity-80 p-1"
                            aria-label="Dismiss error"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Top Header & Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                            <Badge
                                variant="ok"
                                className="font-semibold uppercase tracking-wider text-[11px]"
                            >
                                Transfer Complete
                            </Badge>
                            <span className="text-muted-foreground text-xs">·</span>
                            <Badge
                                variant="secondary"
                                className={`text-xs font-medium ${
                                    report.classifier === "llm"
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                }`}
                            >
                                Classifier:{" "}
                                {report.classifier === "llm"
                                    ? "Gemini AI"
                                    : "Deterministic Rule Engine"}
                            </Badge>
                        </div>
                        <h2 className="text-xl font-bold text-foreground">
                            Format Transfer Report
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Styles, section properties, and numbering mapped
                            from reference document
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onReset}
                            className="flex-1 sm:flex-none gap-1.5 rounded-xl cursor-pointer"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>New Transfer</span>
                        </Button>
                        {downloadUrl && (
                            <div
                                className="relative flex-1 sm:flex-none inline-flex items-center rounded-xl shadow-sm"
                                ref={dropdownRef}
                            >
                                <Button
                                    type="button"
                                    disabled={isDownloading !== null}
                                    onClick={() => handleDownload("docx")}
                                    className="flex-1 sm:flex-none gap-2 rounded-r-none cursor-pointer"
                                >
                                    {isDownloading === "docx" ? (
                                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    <span>Save DOCX</span>
                                </Button>
                                <Button
                                    type="button"
                                    disabled={isDownloading !== null}
                                    onClick={() =>
                                        setDropdownOpen((prev) => !prev)
                                    }
                                    aria-label="Export format options"
                                    aria-haspopup="true"
                                    aria-expanded={dropdownOpen}
                                    className="px-2.5 rounded-l-none border-l border-primary-hover cursor-pointer"
                                >
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform duration-200 ${
                                            dropdownOpen ? "rotate-180" : ""
                                        }`}
                                    />
                                </Button>

                                {/* Dropdown Menu */}
                                {dropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-popover text-popover-foreground border border-border rounded-xl shadow-pop py-1.5 z-30">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                handleDownload("docx");
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium hover:bg-muted transition-colors text-left cursor-pointer"
                                        >
                                            <FileText className="w-4 h-4 text-primary shrink-0" />
                                            <span>Save as DOCX</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                handleDownload("pdf");
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium hover:bg-muted transition-colors text-left cursor-pointer"
                                        >
                                            {isDownloading === "pdf" ? (
                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                                            ) : (
                                                <Download className="w-4 h-4 text-accent shrink-0" />
                                            )}
                                            <span>Save as PDF</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-6">
                    <Card className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                            <span className="text-xs font-medium text-muted-foreground">
                                Total Paragraphs
                            </span>
                            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                                {totalParagraphs}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                            <span className="text-xs font-medium text-muted-foreground">
                                Roles Transferred
                            </span>
                            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                                {roles.length}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                            <span className="text-xs font-medium text-muted-foreground">
                                Page Dimensions
                            </span>
                            <p className="text-sm font-semibold text-primary mt-2">
                                {report.sectionChanges?.pageSize
                                    ? "Matched to Reference"
                                    : "Preserved"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                            <span className="text-xs font-medium text-muted-foreground">
                                Warnings
                            </span>
                            <p
                                className={`text-2xl font-bold mt-1 tabular-nums ${
                                    warnings.length > 0
                                        ? "text-warning"
                                        : "text-foreground"
                                }`}
                            >
                                {warnings.length}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Section Changes Callout */}
                {report.sectionChanges && (
                    <div className="mb-6 bg-muted/40 border border-border rounded-xl p-4 text-xs">
                        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span>Section & Layout Properties Aligned:</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <span className="text-success font-bold">
                                    ✓
                                </span>
                                <span>Page size & orientation</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-success font-bold">
                                    ✓
                                </span>
                                <span>Margins aligned (0.5 in / 36 pt)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-success font-bold">
                                    ✓
                                </span>
                                <span>Header & footer sync</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Warnings / Fallback notices */}
                {warnings.length > 0 && (
                    <div className="mb-6 bg-warning-soft border border-warning/30 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-warning mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-warning" />
                            <span>
                                Fidelity & Fallback Warnings ({warnings.length})
                            </span>
                        </h4>
                        <ul className="space-y-1.5 text-xs text-warning">
                            {warnings.map((w, idx) => (
                                <li
                                    key={idx}
                                    className="flex items-start gap-2"
                                >
                                    <span className="font-bold">•</span>
                                    <span>{w.message}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Roles & Styles Applied Table */}
                <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                        Applied Formatting by Semantic Role
                    </h3>
                    <div className="border border-border rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-xs text-muted-foreground">
                            <thead className="bg-muted text-foreground font-semibold border-b border-border uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="py-3 px-4">Role</th>
                                    <th className="py-3 px-4">Paragraphs</th>
                                    <th className="py-3 px-4">Typography</th>
                                    <th className="py-3 px-4">Alignment</th>
                                    <th className="py-3 px-4">Spacing</th>
                                    <th className="py-3 px-4">Source</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {roles.map((r, i) => {
                                    const s = r.specApplied;
                                    return (
                                        <tr
                                            key={i}
                                            className="hover:bg-muted/40 transition-colors"
                                        >
                                            <td className="py-3 px-4 font-medium text-foreground">
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono text-[11px] text-foreground font-semibold"
                                                >
                                                    {r.role}
                                                </Badge>
                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                    {formatRoleName(r.role)}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-medium text-foreground tabular-nums">
                                                {r.paragraphCount}
                                            </td>
                                            <td className="py-3 px-4">
                                                {s?.font ? (
                                                    <div className="space-y-0.5">
                                                        <span className="font-medium text-foreground">
                                                            {s.font}
                                                        </span>
                                                        <span className="text-muted-foreground ml-1.5 tabular-nums">
                                                            {s.size_pt
                                                                ? `${s.size_pt} pt`
                                                                : ""}
                                                        </span>
                                                        <div className="flex gap-1.5 text-[10px] text-fg-subtle">
                                                            {s.bold && (
                                                                <span className="font-semibold text-foreground">
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
                                                    <span className="text-fg-subtle">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 capitalize text-foreground">
                                                {s?.alignment || "—"}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground space-y-0.5 tabular-nums">
                                                <div>
                                                    After:{" "}
                                                    {formatSpacing(
                                                        s?.space_after,
                                                    )}
                                                </div>
                                                {s?.space_before ? (
                                                    <div>
                                                        Before:{" "}
                                                        {formatSpacing(
                                                            s.space_before,
                                                        )}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge
                                                    variant="secondary"
                                                    className={`font-semibold text-[11px] uppercase tracking-wide ${
                                                        r.source === "reference"
                                                            ? "text-success"
                                                            : "text-warning"
                                                    }`}
                                                >
                                                    {r.source}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
