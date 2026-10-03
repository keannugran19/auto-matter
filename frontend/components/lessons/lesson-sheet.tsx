"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { UploadCloud, ArrowRight, FileText, X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Lesson, Category } from "@/lib/types";

const lessonFormSchema = z.object({
  number: z.coerce.number().min(1, "Lesson number is required"),
  category: z.enum(["new_believers", "mentoring", "leadership"]),
  title: z.string().min(1, "Title is required"),
  series: z.string().optional(),
  status: z.enum(["draft", "published"]),
  summary: z.string().optional(),
  runTransfer: z.boolean(),
});

type LessonFormValues = z.infer<typeof lessonFormSchema>;

interface LessonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson?: Lesson | null;
  onSuccess?: (lesson: Lesson) => void;
}

export function LessonSheet({
  open,
  onOpenChange,
  lesson,
  onSuccess,
}: LessonSheetProps) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const isEditing = Boolean(lesson);

  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      number: lesson ? lesson.number : 38,
      category: lesson ? lesson.category : "leadership",
      title: lesson ? lesson.title : "",
      series: lesson?.series || "",
      status: lesson ? lesson.status : "draft",
      summary: lesson?.summary || "",
      runTransfer: true,
    },
  });

  React.useEffect(() => {
    if (lesson) {
      form.reset({
        number: lesson.number,
        category: lesson.category,
        title: lesson.title,
        series: lesson.series || "",
        status: lesson.status,
        summary: lesson.summary || "",
        runTransfer: true,
      });
      setFile(null);
    } else {
      // Find highest number from existing lessons or default
      fetch("/api/lessons")
        .then((res) => (res.ok ? res.json() : []))
        .then((lessons: Lesson[]) => {
          if (Array.isArray(lessons) && lessons.length > 0) {
            const maxNum = Math.max(...lessons.map((l) => l.number));
            form.setValue("number", maxNum + 1);
          }
        })
        .catch(() => {});

      form.reset({
        number: 38,
        category: "leadership",
        title: "",
        series: "Leadership Series 2",
        status: "draft",
        summary: "",
        runTransfer: true,
      });
      setFile(null);
    }
  }, [lesson, open, form]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.name.endsWith(".docx")) {
        setFile(dropped);
      } else {
        toast.error("Please upload a .docx document");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.name.endsWith(".docx")) {
        setFile(selected);
      } else {
        toast.error("Please upload a .docx document");
      }
    }
  };

  const onSubmit = async (values: LessonFormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditing && lesson) {
        const res = await fetch(`/api/lessons/${lesson.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        if (!res.ok) throw new Error("Failed to update lesson");
        const updated = await res.json();

        // If new file attached
        if (file) {
          const fd = new FormData();
          fd.append("file", file);
          await fetch(`/api/lessons/${lesson.id}/upload`, {
            method: "POST",
            body: fd,
          });
        }

        toast.success(`Lesson #${updated.number} updated successfully`);
        onOpenChange(false);
        if (onSuccess) onSuccess(updated);

        if (values.runTransfer) {
          router.push(`/lessons/${updated.id}/workstation`);
        }
      } else {
        // Create new lesson
        const formData = new FormData();
        formData.append("number", String(values.number));
        formData.append("category", values.category);
        formData.append("title", values.title);
        formData.append("series", values.series || "");
        formData.append("status", values.status);
        formData.append("summary", values.summary || "");

        if (file) {
          formData.append("file", file);
        }

        const res = await fetch("/api/lessons", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Failed to create lesson");
        const created: Lesson = await res.json();

        toast.success(`Lesson #${created.number} created`);
        onOpenChange(false);
        if (onSuccess) onSuccess(created);

        if (values.runTransfer) {
          router.push(`/lessons/${created.id}/workstation`);
        } else {
          router.refresh();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] p-0 flex flex-col justify-between"
      >
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-[17px] font-semibold tracking-tight">
              {isEditing ? `Edit Lesson #${lesson?.number}` : "Add lesson"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              {isEditing
                ? "Update lesson metadata or replace the source document."
                : "Create the lesson record, upload the .docx, then continue to Document Workstation."}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form id="lesson-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Lesson number</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new_believers">
                            <div className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-[hsl(var(--nb))]" />
                              <span>New Believers</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="mentoring">
                            <div className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-[hsl(var(--mt))]" />
                              <span>Mentoring</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="leadership">
                            <div className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-[hsl(var(--ld))]" />
                              <span>Leadership</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. What does servant leadership look like?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3.5">
                <FormField
                  control={form.control}
                  name="series"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Series</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Leadership Series 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium">
                      Summary <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="One or two sentences shown in the lesson list…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Lesson Document Dropzone */}
              <div className="space-y-2 pt-1">
                <label className="text-[13px] font-medium">Lesson document</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".docx"
                  className="hidden"
                />

                {file ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <FileText className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB · Ready to upload
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setFile(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-1.5 border-dashed rounded-lg p-7 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-primary bg-accent/40"
                        : "border-border bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="size-10 rounded-lg bg-background border border-border mx-auto mb-2.5 flex items-center justify-center">
                      <UploadCloud className="size-5 text-muted-foreground" />
                    </div>
                    <b className="block text-[13.5px] font-medium text-foreground">
                      Drag & drop a .docx here
                    </b>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to browse · max 25 MB
                    </p>
                  </div>
                )}
                <p className="text-[12px] text-muted-foreground">
                  The original is stored untouched. Formatting is applied to a copy in the next step.
                </p>
              </div>

              {/* Run format transfer after upload Switch */}
              <FormField
                control={form.control}
                name="runTransfer"
                render={({ field }) => (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <b className="block text-[13px] font-medium">Run format transfer after upload</b>
                      <p className="text-[12px] text-muted-foreground">
                        You&apos;ll be taken to the Document Workstation with this file preloaded.
                      </p>
                    </div>
                  </div>
                )}
              />
            </form>
          </Form>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 bg-background">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="lesson-form"
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              "Saving…"
            ) : form.watch("runTransfer") ? (
              <>
                Upload & continue <ArrowRight className="size-4" />
              </>
            ) : (
              "Save lesson"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
