"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
    BookOpen,
    FileCog,
    ClipboardCheck,
    FileType2,
    KeyRound,
    Settings2,
    ChevronsUpDown,
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentCategory = searchParams.get("category");

    const [stats, setStats] = React.useState({
        total: 128,
        nb: 52,
        mt: 41,
        ld: 35,
    });

    React.useEffect(() => {
        fetch("/api/lessons")
            .then((res) => (res.ok ? res.json() : []))
            .then((lessons: any[]) => {
                if (Array.isArray(lessons) && lessons.length > 0) {
                    const nb = lessons.filter(
                        (l) => l.category === "new_believers",
                    ).length;
                    const mt = lessons.filter(
                        (l) => l.category === "mentoring",
                    ).length;
                    const ld = lessons.filter(
                        (l) => l.category === "leadership",
                    ).length;
                    setStats({
                        total: lessons.length,
                        nb,
                        mt,
                        ld,
                    });
                }
            })
            .catch(() => {});
    }, [pathname]);

    const isLessonsRoot = pathname === "/lessons" && !currentCategory;

    return (
        <Sidebar
            collapsible="icon"
            className="border-r border-sidebar-border bg-sidebar"
        >
            {/* Brand Header */}
            <SidebarHeader className="p-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="hover:bg-sidebar-accent"
                        >
                            <Link
                                href="/lessons"
                                className="flex items-center gap-2.5"
                            >
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-background border border-border/80 shadow-xs overflow-hidden shrink-0">
                                    <Image
                                        src="/logo-square.png"
                                        alt="One Life"
                                        width={32}
                                        height={32}
                                        className="size-6 object-contain"
                                        priority
                                    />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold text-[13.5px]">
                                        One Life
                                    </span>
                                    <span className="truncate text-[11.5px] text-muted-foreground">
                                        Admin · Lessons
                                    </span>
                                </div>
                                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="px-2">
                {/* Platform Group */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[11.5px] font-medium text-muted-foreground px-2">
                        Platform
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {/* Lessons with Submenu */}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={
                                        pathname.startsWith("/lessons") &&
                                        !currentCategory
                                    }
                                    tooltip="Lessons"
                                >
                                    <Link
                                        href="/lessons"
                                        className="flex items-center gap-2.5"
                                    >
                                        <BookOpen className="size-4" />
                                        <span className="font-medium text-[13.5px]">
                                            Lessons
                                        </span>
                                        <span className="ml-auto text-[11.5px] text-muted-foreground tabular-nums">
                                            {stats.total}
                                        </span>
                                    </Link>
                                </SidebarMenuButton>

                                <SidebarMenuSub className="ml-5 pl-2.5 border-l border-sidebar-border space-y-0.5">
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={
                                                pathname === "/lessons" &&
                                                currentCategory === "nb"
                                            }
                                        >
                                            <Link
                                                href="/lessons?category=nb"
                                                className="flex items-center gap-2 text-[13px]"
                                            >
                                                <span className="size-2 rounded-full bg-[hsl(var(--nb))] shrink-0" />
                                                <span>New Believers</span>
                                                <span className="ml-auto text-[11.5px] text-muted-foreground tabular-nums">
                                                    {stats.nb}
                                                </span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>

                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={
                                                pathname === "/lessons" &&
                                                currentCategory === "mt"
                                            }
                                        >
                                            <Link
                                                href="/lessons?category=mt"
                                                className="flex items-center gap-2 text-[13px]"
                                            >
                                                <span className="size-2 rounded-full bg-[hsl(var(--mt))] shrink-0" />
                                                <span>Mentoring</span>
                                                <span className="ml-auto text-[11.5px] text-muted-foreground tabular-nums">
                                                    {stats.mt}
                                                </span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>

                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={
                                                pathname === "/lessons" &&
                                                currentCategory === "ld"
                                            }
                                        >
                                            <Link
                                                href="/lessons?category=ld"
                                                className="flex items-center gap-2 text-[13px]"
                                            >
                                                <span className="size-2 rounded-full bg-[hsl(var(--ld))] shrink-0" />
                                                <span>Leadership</span>
                                                <span className="ml-auto text-[11.5px] text-muted-foreground tabular-nums">
                                                    {stats.ld}
                                                </span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                </SidebarMenuSub>
                            </SidebarMenuItem>

                            {/* Document Workstation */}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/workstation"}
                                    tooltip="Document Workstation"
                                >
                                    <Link
                                        href="/workstation"
                                        className="flex items-center gap-2.5"
                                    >
                                        <FileCog className="size-4" />
                                        <span className="text-[13.5px]">
                                            Document Workstation
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Transfer Reports */}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/reports"}
                                    tooltip="Transfer Reports"
                                >
                                    <Link
                                        href="/reports"
                                        className="flex items-center gap-2.5"
                                    >
                                        <ClipboardCheck className="size-4" />
                                        <span className="text-[13.5px]">
                                            Transfer Reports
                                        </span>
                                        <Badge
                                            variant="secondary"
                                            className="ml-auto text-[11px] font-medium"
                                        >
                                            3 new
                                        </Badge>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Engine Group */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[11.5px] font-medium text-muted-foreground px-2">
                        Engine
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={
                                        pathname === "/settings/templates"
                                    }
                                    tooltip="Reference Templates"
                                >
                                    <Link
                                        href="/settings/templates"
                                        className="flex items-center gap-2.5"
                                    >
                                        <FileType2 className="size-4" />
                                        <span className="text-[13.5px]">
                                            Reference Templates
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/settings/api-keys"}
                                    tooltip="API Keys"
                                >
                                    <Link
                                        href="/settings/api-keys"
                                        className="flex items-center gap-2.5"
                                    >
                                        <KeyRound className="size-4" />
                                        <span className="text-[13.5px]">
                                            API Keys
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/settings"}
                                    tooltip="Settings"
                                >
                                    <Link
                                        href="/settings/templates"
                                        className="flex items-center gap-2.5"
                                    >
                                        <Settings2 className="size-4" />
                                        <span className="text-[13.5px]">
                                            Settings
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* User Footer */}
            <SidebarFooter className="border-t border-sidebar-border p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            className="hover:bg-sidebar-accent"
                        >
                            <div className="flex size-8 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground">
                                JD
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium text-[13px]">
                                    Admin
                                </span>
                                <span className="truncate text-[11.5px] text-muted-foreground">
                                    admin@onelife.org
                                </span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
