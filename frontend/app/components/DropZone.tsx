"use client";

import React, { useRef, useState } from "react";
import {
    FileText,
    UploadCloud,
    CheckCircle2,
    Trash2,
    AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
    label: string;
    sublabel: string;
    side: "target" | "reference";
    file: File | null;
    onFileSelect: (file: File | null) => void;
    disabled?: boolean;
    isDefault?: boolean;
    onToggleDefault?: (checked: boolean) => void;
}

export default function DropZone({
    label,
    sublabel,
    side,
    file,
    onFileSelect,
    disabled = false,
    isDefault = false,
    onToggleDefault,
}: DropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const validateAndSet = (selectedFile: File) => {
        setError(null);
        if (!selectedFile.name.toLowerCase().endsWith(".docx")) {
            setError("Only .docx files are supported");
            return;
        }
        if (selectedFile.size === 0) {
            setError("File is empty");
            return;
        }
        if (selectedFile.size > 50 * 1024 * 1024) {
            setError("File exceeds maximum size of 50MB");
            return;
        }
        onFileSelect(selectedFile);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            validateAndSet(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndSet(e.target.files[0]);
        }
    };

    const isTarget = side === "target";

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="secondary"
                            className={`text-xs font-semibold uppercase tracking-wider ${
                                isTarget
                                    ? "text-warning"
                                    : "text-primary"
                            }`}
                        >
                            {isTarget
                                ? "1 · Target Document"
                                : "2 · Reference Style Template"}
                        </Badge>
                    </div>
                    <h3 className="text-base font-semibold text-foreground mt-1.5">
                        {label}
                    </h3>
                    <p className="text-xs text-muted-foreground">{sublabel}</p>
                </div>
            </div>

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !file && !disabled && inputRef.current?.click()}
                className={`relative flex-1 min-h-[200px] sm:min-h-[220px] rounded-xl border-2 transition-all flex flex-col items-center justify-center p-6 text-center ${
                    isDragging
                        ? "border-accent bg-primary-soft border-solid"
                        : file
                          ? "border-border bg-card shadow-sm border-solid"
                          : "border-dashed border-border-strong bg-card hover:bg-muted/50 hover:border-primary/60 cursor-pointer"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".docx"
                    onChange={handleChange}
                    disabled={disabled}
                    className="hidden"
                />

                {file ? (
                    <div className="w-full flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
                            <svg
                                className="w-7 h-7"
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
                        </div>
                        <p className="text-sm font-semibold text-foreground break-all max-w-[90%]">
                            {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                            {formatFileSize(file.size)}
                        </p>

                        {side === "reference" && isDefault && (
                            <Badge
                                variant="ok"
                                className="mt-2 text-xs font-medium"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Saved Default Template</span>
                            </Badge>
                        )}

                        {side === "reference" && onToggleDefault && (
                            <label
                                onClick={(e) => e.stopPropagation()}
                                className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground"
                            >
                                <input
                                    type="checkbox"
                                    checked={isDefault}
                                    onChange={(e) =>
                                        onToggleDefault(e.target.checked)
                                    }
                                    disabled={disabled}
                                    className="w-4 h-4 rounded border-border-strong text-primary focus:ring-ring cursor-pointer"
                                />
                                <span>
                                    Remember as default reference document
                                </span>
                            </label>
                        )}

                        {!disabled && (
                            <div className="mt-4 flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        inputRef.current?.click();
                                    }}
                                    className="text-primary hover:bg-primary-soft hover:text-primary-hover"
                                >
                                    Replace file
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFileSelect(null);
                                        if (inputRef.current)
                                            inputRef.current.value = "";
                                    }}
                                    className="text-destructive hover:bg-destructive-soft hover:text-destructive flex items-center gap-1"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove</span>
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-3 shadow-xs">
                            <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            Drag & drop a{" "}
                            <span className="font-semibold text-primary">
                                .docx
                            </span>{" "}
                            file here
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            or tap to browse from device
                        </p>
                    </div>
                )}

                {error && (
                    <div className="absolute bottom-2 left-4 right-4 bg-destructive-soft text-destructive border border-destructive/20 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
