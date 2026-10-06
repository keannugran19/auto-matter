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
    ChevronsUpDown,
    User as UserIcon,
    LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    const { user, signOut } = useAuth();

    const userEmail = user?.email || "admin@onelife.org";
    const rawName = (user?.user_metadata?.full_name as string) || userEmail.split("@")[0] || "Admin";
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const initials = user?.user_metadata?.full_name
        ? (user.user_metadata.full_name as string)
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
        : userEmail.slice(0, 2).toUpperCase();

    const [stats, setStats] = React.useState({
        total: 0,
        nb: 0,
        mt: 0,
        ld: 0,
    });

    React.useEffect(() => {
        fetch("/api/lessons")
            .then((res) => (res.ok ? res.json() : []))
            .then((lessons: any[]) => {
                if (Array.isArray(lessons)) {
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="hover:bg-sidebar-accent cursor-pointer"
                                >
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground shrink-0">
                                        {initials}
                                    </div>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-medium text-[13px]">
                                            {displayName}
                                        </span>
                                        <span className="truncate text-[11.5px] text-muted-foreground">
                                            {userEmail}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-4 text-muted-foreground shrink-0" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                align="end"
                                className="w-56 mb-1"
                            >
                                <DropdownMenuLabel className="font-normal p-2">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-xs font-medium leading-none">{displayName}</p>
                                        <p className="text-[11px] leading-none text-muted-foreground truncate">{userEmail}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/settings/account" className="flex items-center gap-2 cursor-pointer text-xs">
                                        <UserIcon className="size-3.5" />
                                        <span>Account Details</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/settings/api-keys" className="flex items-center gap-2 cursor-pointer text-xs">
                                        <KeyRound className="size-3.5" />
                                        <span>API Keys</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/settings/templates" className="flex items-center gap-2 cursor-pointer text-xs">
                                        <FileType2 className="size-3.5" />
                                        <span>Templates</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={signOut}
                                    className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer text-xs"
                                >
                                    <LogOut className="size-3.5" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
