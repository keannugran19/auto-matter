"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import "@iamjariwala/react-doc-viewer/dist/index.css";

const DocViewerComponent = dynamic(
    () =>
        import("@iamjariwala/react-doc-viewer").then((mod) => {
            const Viewer = mod.default;
            const renderers = mod.DocViewerRenderers;
            return function WrappedDocViewer(props: {
                documents: Array<{
                    uri: string;
                    fileType?: string;
                    fileName?: string;
                }>;
                className?: string;
            }) {
                const containerRef = React.useRef<HTMLDivElement>(null);
                const pagesRef = React.useRef<HTMLElement[]>([]);
                const activePageRef = React.useRef<number>(1);
                const syncingRef = React.useRef<boolean>(false);

                // Helper: compute and apply fit scale to docx viewer element
                const applyFitScale = React.useCallback(() => {
                    const el = containerRef.current;
                    if (!el) return;

                    const docxViewer = el.querySelector<HTMLElement>(".rdv-docx-viewer");
                    if (!docxViewer) return;

                    const firstSection = pagesRef.current[0] || el.querySelector<HTMLElement>("section");
                    const docWidth = firstSection?.offsetWidth || 816;
                    const docHeight = firstSection?.offsetHeight || 1056;

                    const availableWidth = Math.max(100, el.clientWidth - 32);
                    const availableHeight = Math.max(100, el.clientHeight - 64);

                    const scaleX = availableWidth / docWidth;
                    const scaleY = availableHeight / docHeight;
                    const scale = Number(Math.min(1, Math.max(0.2, Math.min(scaleX, scaleY))).toFixed(2));

                    syncingRef.current = true;
                    docxViewer.style.zoom = String(scale);
                    if (!("zoom" in document.body.style)) {
                        docxViewer.style.transform = `scale(${scale})`;
                        docxViewer.style.transformOrigin = "top center";
                    }
                    syncingRef.current = false;
                }, []);

                // Effect A: ResizeObserver for container resizing
                React.useEffect(() => {
                    const el = containerRef.current;
                    if (!el) return;

                    let rafId = 0;
                    const onResize = () => {
                        cancelAnimationFrame(rafId);
                        rafId = requestAnimationFrame(applyFitScale);
                    };

                    onResize();
                    const resizeObserver = new ResizeObserver(onResize);
                    resizeObserver.observe(el);

                    return () => {
                        resizeObserver.disconnect();
                        cancelAnimationFrame(rafId);
                    };
                }, [applyFitScale]);

                // Effect B: Page pagination and initial document render sync
                React.useEffect(() => {
                    const el = containerRef.current;
                    if (!el) return;

                    const syncPages = () => {
                        if (syncingRef.current) return;

                        applyFitScale();

                        const wrapper = el.querySelector<HTMLElement>(
                            ".rdv-docx-wrapper, .docx-wrapper, #docx-renderer > div > div"
                        );
                        const pages = wrapper && wrapper.children.length > 0
                            ? (Array.from(wrapper.children) as HTMLElement[])
                            : Array.from(el.querySelectorAll<HTMLElement>("section"));

                        pagesRef.current = pages;
                        if (pages.length <= 1) return;

                        const input = el.querySelector<HTMLInputElement>(
                            ".rdv-toolbar-page-input, #pdf-pagination-input"
                        );
                        const pageNum = input ? parseInt(input.value, 10) : 1;
                        const active = isNaN(pageNum) ? 1 : Math.max(1, Math.min(pages.length, pageNum));

                        const needsUpdate = active !== activePageRef.current || pages.some((p, idx) => {
                            const shouldHide = idx !== active - 1;
                            return (p.style.display === "none") !== shouldHide;
                        });

                        if (!needsUpdate) return;
                        activePageRef.current = active;

                        syncingRef.current = true;
                        const activeIdx = active - 1;
                        pages.forEach((p, idx) => {
                            p.style.setProperty(
                                "display",
                                idx === activeIdx ? "block" : "none",
                                "important"
                            );
                        });
                        syncingRef.current = false;
                    };

                    // Watch for rendered pages being mounted (async docx rendering)
                    const mutObserver = new MutationObserver(() => {
                        if (!syncingRef.current) {
                            requestAnimationFrame(syncPages);
                        }
                    });
                    mutObserver.observe(el, { childList: true, subtree: true });

                    // Handle page navigation via toolbar buttons or keyboard
                    const onNav = () => {
                        requestAnimationFrame(syncPages);
                        setTimeout(syncPages, 60);
                    };

                    el.addEventListener("click", onNav, { capture: true });
                    el.addEventListener("keyup", onNav, { capture: true });

                    syncPages();

                    return () => {
                        mutObserver.disconnect();
                        el.removeEventListener("click", onNav, { capture: true });
                        el.removeEventListener("keyup", onNav, { capture: true });
                    };
                }, [props.documents, applyFitScale]);

                return (
                    <div
                        ref={containerRef}
                        className={`rdv-viewer-container w-full h-full ${props.className || ""}`}
                    >
                        <Viewer
                            documents={props.documents}
                            pluginRenderers={renderers}
                            className="w-full h-full"
                            config={{
                                header: {
                                    disableHeader: true,
                                    disableFileName: true,
                                },
                                pdfVerticalScrollByDefault: false,
                                docx: {
                                    useOfficeOnlineViewer: false,
                                },
                                themeMode: "auto",
                            }}
                        />
                    </div>
                );
            };
        }),
    {
        ssr: false,
        loading: () => (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[480px] w-full bg-card rounded-lg border border-border">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-[380px] w-full rounded-md" />
            </div>
        ),
    },
);

interface DocumentViewerProps {
    url: string;
    fileType?: "docx" | "pdf" | string;
    fileName?: string;
    className?: string;
}

export function DocumentViewer({
    url,
    fileType,
    fileName,
    className,
}: DocumentViewerProps) {
    const documents = React.useMemo(
        () => [{ uri: url, fileType, fileName }],
        [url, fileType, fileName],
    );

    return <DocViewerComponent documents={documents} className={className} />;
}

