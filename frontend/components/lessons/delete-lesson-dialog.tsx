"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lesson, CATEGORY_LABELS } from "@/lib/types";

interface DeleteLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteLessonDialog({
  open,
  onOpenChange,
  lesson,
  onConfirm,
  isDeleting = false,
}: DeleteLessonDialogProps) {
  if (!lesson) return null;

  const categoryName = CATEGORY_LABELS[lesson.category] || lesson.category;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[17px] font-semibold">
            Delete this lesson?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13.5px] text-muted-foreground mt-1.5">
            &ldquo;Lesson {lesson.number} · {lesson.title}&rdquo; will be permanently removed from{" "}
            <span className="font-semibold text-foreground">{categoryName}</span>, including its stored
            .docx and transfer reports. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting…" : "Delete lesson"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
