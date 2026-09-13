"use client";

import React, { useRef, useState } from "react";

interface DropZoneProps {
    label: string;
    sublabel: string;
    side: "target" | "reference";
    file: File | null;
    onFileSelect: (file: File | null) => void;
    disabled?: boolean;
}

export default function DropZone({
    label,
    sublabel,
    side,
    file,
    onFileSelect,
    disabled = false,
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
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider ${
                            isTarget
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-100 text-indigo-800"
                        }`}
                    >
                        {isTarget ? "Target Document" : "Reference Document"}
                    </span>
                    <h3 className="text-base font-medium text-slate-800 mt-1">
                        {label}
                    </h3>
                    <p className="text-xs text-slate-500">{sublabel}</p>
                </div>
            </div>

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !file && !disabled && inputRef.current?.click()}
                className={`relative flex-1 min-h-[220px] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center ${
                    isDragging
                        ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]"
                        : file
                          ? "border-slate-200 bg-white shadow-sm"
                          : "border-slate-300 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-400 cursor-pointer"
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
                        <p className="text-sm font-semibold text-slate-800 break-all max-w-[90%]">
                            {file.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {formatFileSize(file.size)}
                        </p>

                        {!disabled && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFileSelect(null);
                                    if (inputRef.current)
                                        inputRef.current.value = "";
                                }}
                                className="mt-4 px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                                Remove file
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-200/70 text-slate-500 flex items-center justify-center mb-3">
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
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                            Drag & drop a{" "}
                            <span className="font-semibold">.docx</span> file
                            here
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            or click to browse from computer
                        </p>
                    </div>
                )}

                {error && (
                    <div className="absolute bottom-2 left-4 right-4 bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                        <svg
                            className="w-4 h-4 shrink-0 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
