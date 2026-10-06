"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { LessonSheet } from "@/components/lessons/lesson-sheet";
import { Lesson } from "@/lib/types";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

  const [commandOpen, setCommandOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedLesson, setSelectedLesson] = React.useState<Lesson | null>(null);

  React.useEffect(() => {
    if (isAuthRoute) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K for search command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
      // ⌘N or Ctrl+N for Add Lesson
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setSelectedLesson(null);
        setSheetOpen(true);
      }
    };

    const handleOpenAddLesson = () => {
      setSelectedLesson(null);
      setSheetOpen(true);
    };

    const handleOpenEditLesson = (e: Event) => {
      const customEvent = e as CustomEvent<Lesson>;
      if (customEvent.detail) {
        setSelectedLesson(customEvent.detail);
        setSheetOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-add-lesson", handleOpenAddLesson);
    window.addEventListener("open-edit-lesson", handleOpenEditLesson as EventListener);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-add-lesson", handleOpenAddLesson);
      window.removeEventListener("open-edit-lesson", handleOpenEditLesson as EventListener);
    };
  }, [isAuthRoute]);

  if (isAuthRoute) {
    return (
      <main className="min-h-screen w-full bg-background flex flex-col">
        <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
          {children}
        </React.Suspense>
      </main>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <React.Suspense fallback={<div className="w-64 border-r border-sidebar-border bg-sidebar" />}>
          <AppSidebar />
        </React.Suspense>
        <SidebarInset className="flex flex-col min-w-0 overflow-x-hidden">
          <React.Suspense fallback={<div className="h-14 border-b border-border bg-background" />}>
            <Topbar onOpenSearch={() => setCommandOpen(true)} />
          </React.Suspense>
          <main className="flex-1 w-full max-w-[1180px] mx-auto p-5 sm:p-7 lg:py-7">
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
              {children}
            </React.Suspense>
          </main>
        </SidebarInset>
      </div>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenAddLesson={() => {
          setSelectedLesson(null);
          setSheetOpen(true);
        }}
      />

      <LessonSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        lesson={selectedLesson}
        onSuccess={() => {
          // Dispatch event for components to refresh data
          window.dispatchEvent(new CustomEvent("refresh-lessons"));
        }}
      />
    </SidebarProvider>
  );
}
