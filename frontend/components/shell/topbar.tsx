"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "./theme-toggle";
import { CATEGORY_LABELS, CATEGORY_CODES } from "@/lib/types";

interface TopbarProps {
    onOpenSearch: () => void;
}

export function Topbar({ onOpenSearch }: TopbarProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get("category");

    // Determine breadcrumb segments
    const renderBreadcrumbs = () => {
        if (pathname === "/lessons") {
            const catLabel =
                categoryParam && CATEGORY_CODES[categoryParam]
                    ? CATEGORY_LABELS[CATEGORY_CODES[categoryParam]]
                    : "All lessons";

            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link href="/lessons">Lessons</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            {catLabel}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        if (
            pathname.includes("/workstation") &&
            pathname.startsWith("/lessons/")
        ) {
            const parts = pathname.split("/");
            const lessonId = parts[2];
            const matchNum = lessonId.match(/\d+/);
            const lessonNum = matchNum ? matchNum[0] : "";

            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link href="/lessons">Lessons</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>
                            Lesson {lessonNum || "Detail"}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            Document Workstation
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        if (pathname.includes("/report") && pathname.startsWith("/lessons/")) {
            const parts = pathname.split("/");
            const lessonId = parts[2];
            const matchNum = lessonId.match(/\d+/);
            const lessonNum = matchNum ? matchNum[0] : "";

            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link href="/lessons">Lessons</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>
                            Lesson {lessonNum || "Detail"}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            Transfer Report
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        if (pathname === "/workstation") {
            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbPage>Platform</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            Document Workstation
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        if (pathname === "/reports") {
            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbPage>Platform</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            Transfer Reports
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        if (pathname === "/settings/templates") {
            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbPage>Engine</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            Reference Templates
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        if (pathname === "/settings/api-keys") {
            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbPage>Engine</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            API Keys
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        if (pathname === "/settings/account" || pathname === "/settings") {
            return (
                <BreadcrumbList className="text-[13.5px]">
                    <BreadcrumbItem>
                        <BreadcrumbPage>Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium text-foreground">
                            Account
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            );
        }

        return (
            <BreadcrumbList className="text-[13.5px]">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/lessons">One Life</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="font-medium text-foreground">
                        Admin
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        );
    };

    return (
        <header className="sticky top-0 z-30 flex h-14 w-full items-center gap-3 border-b border-border bg-background px-5">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4 bg-border" />

            <Breadcrumb className="hidden sm:block">
                {renderBreadcrumbs()}
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-3">
                {/* ⌘K Search trigger */}
                <button
                    onClick={onOpenSearch}
                    className="flex h-9 w-60 sm:w-64 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                    <Search className="size-4 shrink-0" />
                    <span className="truncate">Search lessons…</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10.5px] font-medium text-muted-foreground opacity-100">
                        ⌘K
                    </kbd>
                </button>

                {/* Theme Toggle */}
                <ThemeToggle />
            </div>
        </header>
    );
}
