"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Plus,
    FileCog,
    ClipboardCheck,
    Settings,
    BookOpen,
} from "lucide-react";
import { Lesson, CATEGORY_LABELS } from "@/lib/types";

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenAddLesson?: () => void;
}

export function CommandPalette({
    open,
    onOpenChange,
    onOpenAddLesson,
}: CommandPaletteProps) {
    const router = useRouter();
    const [lessons, setLessons] = React.useState<Lesson[]>([]);

    React.useEffect(() => {
        if (open) {
            fetch("/api/lessons")
                .then((res) => (res.ok ? res.json() : []))
                .then((data) => {
                    if (Array.isArray(data)) setLessons(data);
                })
                .catch(() => {});
        }
    }, [open]);

    const handleSelect = (callback: () => void) => {
        onOpenChange(false);
        callback();
    };

    const categoryDotClass = (cat: string) => {
        switch (cat) {
            case "new_believers":
                return "bg-[hsl(var(--nb))]";
            case "mentoring":
                return "bg-[hsl(var(--mt))]";
            case "leadership":
                return "bg-[hsl(var(--ld))]";
            default:
                return "bg-muted-foreground";
        }
    };

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Search lessons, jump to a page, run an action…" />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Actions">
                    <CommandItem
                        onSelect={() =>
                            handleSelect(() => {
                                if (onOpenAddLesson) onOpenAddLesson();
                            })
                        }
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Add lesson</span>
                        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                            ⌘N
                        </kbd>
                    </CommandItem>

                    <CommandItem
                        onSelect={() =>
                            handleSelect(() => {
                                router.push("/workstation");
                            })
                        }
                    >
                        <FileCog className="mr-2 h-4 w-4" />
                        <span>Open Document Workstation</span>
                    </CommandItem>

                    <CommandItem
                        onSelect={() =>
                            handleSelect(() => {
                                router.push("/reports");
                            })
                        }
                    >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        <span>View Transfer Reports</span>
                    </CommandItem>

                    <CommandItem
                        onSelect={() =>
                            handleSelect(() => {
                                router.push("/settings/templates");
                            })
                        }
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Reference Templates</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Lessons">
                    {lessons.slice(0, 10).map((lesson) => (
                        <CommandItem
                            key={lesson.id}
                            value={`${lesson.number} ${lesson.title} ${lesson.series || ""}`}
                            onSelect={() =>
                                handleSelect(() => {
                                    router.push(
                                        `/lessons/${lesson.id}/workstation`,
                                    );
                                })
                            }
                        >
                            <span
                                className={`mr-2 h-2 w-2 rounded-full shrink-0 ${categoryDotClass(
                                    lesson.category,
                                )}`}
                            />
                            <span className="font-mono text-xs text-muted-foreground mr-1.5">
                                #{lesson.number}
                            </span>
                            <span className="truncate font-medium">
                                {lesson.title}
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground truncate">
                                ·{" "}
                                {CATEGORY_LABELS[lesson.category] ||
                                    lesson.category}
                            </span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
