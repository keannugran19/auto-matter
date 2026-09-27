"use client";

import React, { useEffect, useState } from "react";
import DropZone from "./components/DropZone";
import PreviewPane from "./components/PreviewPane";
import ChangeReport, { ChangeReportData } from "./components/ChangeReport";
import {
    getDefaultReference,
    saveDefaultReference,
    clearDefaultReference,
} from "./utils/referenceStorage";

interface JobResponse {
    status: "queued" | "running" | "done" | "error";
    error?: string;
    report?: ChangeReportData;
    previews?: {
        before: string[];
        after: string[];
    };
    downloadUrl?: string;
}

export default function Home() {
    const [targetFile, setTargetFile] = useState<File | null>(null);
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [isDefaultReference, setIsDefaultReference] = useState<boolean>(true);

    const [apiKey, setApiKey] = useState<string>("");
    const [showApiKey, setShowApiKey] = useState<boolean>(false);

    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<
        "idle" | "uploading" | "queued" | "running" | "done" | "error"
    >("idle");
    const [jobData, setJobData] = useState<JobResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initialize API key and default reference document
    useEffect(() => {
        const saved = localStorage.getItem("gemini_api_key");
        if (saved) {
            setApiKey(saved);
        }
        getDefaultReference().then((savedRef) => {
            if (savedRef) {
                setReferenceFile(savedRef);
                setIsDefaultReference(true);
            }
        });
    }, []);

    const handleApiKeyChange = (val: string) => {
        setApiKey(val);
        if (val.trim()) {
            localStorage.setItem("gemini_api_key", val.trim());
        } else {
            localStorage.removeItem("gemini_api_key");
        }
    };

    const handleReferenceSelect = (file: File | null) => {
        setReferenceFile(file);
        if (!file) {
            clearDefaultReference();
            setIsDefaultReference(true);
        } else if (isDefaultReference) {
            saveDefaultReference(file);
        }
    };

    const handleToggleDefault = (checked: boolean) => {
        setIsDefaultReference(checked);
        if (checked) {
            if (referenceFile) {
                saveDefaultReference(referenceFile);
            }
        } else {
            clearDefaultReference();
        }
    };

    // Polling effect when job is active
    useEffect(() => {
        if (
            !jobId ||
            jobStatus === "done" ||
            jobStatus === "error" ||
            jobStatus === "idle"
        ) {
            return;
        }

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                if (!res.ok) {
                    throw new Error(`Status check failed: HTTP ${res.status}`);
                }
                const data: JobResponse = await res.json();
                setJobData(data);

                if (data.status === "done") {
                    setJobStatus("done");
                } else if (data.status === "error") {
                    setJobStatus("error");
                    setErrorMessage(
                        data.error ||
                            "An unexpected error occurred during processing.",
                    );
                } else {
                    setJobStatus(data.status);
                }
            } catch (err: any) {
                console.error("Polling error:", err);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [jobId, jobStatus]);

    const handleStartConversion = async () => {
        if (!targetFile || !referenceFile) return;

        setErrorMessage(null);
        setJobStatus("uploading");
        setJobData(null);

        const formData = new FormData();
        formData.append("target", targetFile);
        formData.append("reference", referenceFile);
        if (apiKey.trim()) {
            formData.append("api_key", apiKey.trim());
        }

        try {
            const res = await fetch("/api/convert", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(
                    errJson.error ||
                        errJson.detail ||
                        `Upload failed with status ${res.status}`,
                );
            }

            const { jobId: newJobId } = await res.json();
            setJobId(newJobId);
            setJobStatus("queued");
        } catch (err: any) {
            setJobStatus("error");
            setErrorMessage(err.message || "Failed to submit conversion job.");
        }
    };

    const handleReset = () => {
        if (jobId) {
            // Optional clean-up call on backend
            fetch(`/api/jobs/${jobId}`, { method: "DELETE" }).catch(() => {});
        }
        setTargetFile(null);
        if (!isDefaultReference) {
            setReferenceFile(null);
        }
        setJobId(null);
        setJobStatus("idle");
        setJobData(null);
        setErrorMessage(null);
    };

    const isProcessing =
        jobStatus === "uploading" ||
        jobStatus === "queued" ||
        jobStatus === "running";

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm font-bold text-lg">
                            M
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 leading-tight">
                                Auto-Matter
                            </h1>
                            <p className="text-[11px] text-slate-500 font-medium">
                                DOCX Format Transfer Engine
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <span className="hidden sm:inline-block px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                            In-Place OOXML Patching
                        </span>
                        <span className="hidden sm:inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                            Zero Content Loss
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
                {/* Intro Card */}
                {jobStatus === "idle" && (
                    <div className="text-center max-w-2xl mx-auto mb-8 mt-2">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            Transfer Document Styles Visually
                        </h2>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                            Upload the Word document you want to restyle on the
                            left, and a document with your desired formatting on
                            the right. Auto-Matter maps semantic roles and
                            rewrites the styling in-place.
                        </p>
                    </div>
                )}

                {/* Upload Panels (Two-Pane) */}
                {jobStatus === "idle" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Target */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                                <DropZone
                                    side="target"
                                    label="Select the unformatted document"
                                    sublabel="Content will be preserved; typography & layout will be updated"
                                    file={targetFile}
                                    onFileSelect={setTargetFile}
                                    disabled={isProcessing}
                                />
                            </div>

                            {/* Right: Reference */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                                <DropZone
                                    side="reference"
                                    label="Select the reference style document"
                                    sublabel="Fonts, sizes, line spacing, margins, and lists will be copied"
                                    file={referenceFile}
                                    onFileSelect={handleReferenceSelect}
                                    disabled={isProcessing}
                                    isDefault={isDefaultReference}
                                    onToggleDefault={handleToggleDefault}
                                />
                            </div>
                        </div>

                        {/* LLM Configuration Box */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                            Gemini API Key
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                            AI Semantic Classifier
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Optional. Powers LLM paragraph role
                                        classification. If omitted, the server
                                        environment key or deterministic
                                        fallback will be used.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-80">
                                    <div className="relative flex-1">
                                        <input
                                            type={
                                                showApiKey ? "text" : "password"
                                            }
                                            value={apiKey}
                                            onChange={(e) =>
                                                handleApiKeyChange(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Paste Google API key (optional)"
                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-12 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowApiKey(!showApiKey)
                                            }
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-medium"
                                        >
                                            {showApiKey ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                    {apiKey && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleApiKeyChange("")
                                            }
                                            className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-50 transition-colors"
                                            title="Clear API key"
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
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Submit Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                            <div className="text-xs text-slate-500">
                                {!targetFile &&
                                    !referenceFile &&
                                    "Please upload both documents to start format transfer."}
                                {targetFile &&
                                    !referenceFile &&
                                    "Target document ready. Please upload a reference document."}
                                {!targetFile &&
                                    referenceFile &&
                                    "Reference document ready. Please upload a target document."}
                                {targetFile && referenceFile && (
                                    <span className="text-emerald-700 font-medium">
                                        ✓ Both documents selected and validated.
                                        Ready to transfer!
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleStartConversion}
                                disabled={
                                    !targetFile ||
                                    !referenceFile ||
                                    isProcessing
                                }
                                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                                <span>Transfer Formatting</span>
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
                                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Processing State */}
                {isProcessing && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm my-12">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-5 animate-spin">
                            <svg
                                className="w-8 h-8"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900">
                            {jobStatus === "uploading" &&
                                "Uploading documents..."}
                            {jobStatus === "queued" &&
                                "Queued for processing..."}
                            {jobStatus === "running" &&
                                "Restyling in progress..."}
                        </h3>

                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                            Resolving effective formatting, matching semantic
                            paragraph roles, remapping list definitions, and
                            patching the original document in-place.
                        </p>

                        <div className="w-full bg-slate-100 h-2 rounded-full mt-6 overflow-hidden">
                            <div
                                className="bg-indigo-600 h-full transition-all duration-500 animate-pulse"
                                style={{
                                    width:
                                        jobStatus === "uploading"
                                            ? "25%"
                                            : jobStatus === "queued"
                                              ? "50%"
                                              : "85%",
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Error State */}
                {jobStatus === "error" && (
                    <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm my-8">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
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
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                            Format Transfer Failed
                        </h3>
                        <p className="text-xs text-red-600 mt-2 font-mono bg-red-50 p-3 rounded-lg text-left break-all">
                            {errorMessage || "An unexpected error occurred."}
                        </p>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="mt-6 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Success State: Previews & Change Report */}
                {jobStatus === "done" && jobData && (
                    <div className="space-y-8">
                        <PreviewPane
                            previews={jobData.previews}
                            targetName={targetFile?.name}
                            referenceName={referenceFile?.name}
                        />

                        {jobData.report && (
                            <ChangeReport
                                report={jobData.report}
                                downloadUrl={jobData.downloadUrl}
                                onReset={handleReset}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
                <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-400">
                    Auto-Matter DOCX Format Transfer • ECMA-376 OOXML Compliant
                    • In-Place Restyling
                </div>
            </footer>
        </div>
    );
}
