"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  BookOpen,
  Check,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CategoryItem } from "@/lib/types";
import { useCategories } from "@/lib/useCategories";

const PRESET_COLORS = [
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#14b8a6", // Teal
  "#84cc16", // Lime
  "#6366f1", // Indigo
  "#e11d48", // Crimson
  "#64748b", // Slate
];

export default function CategoriesSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpenNew = searchParams.get("new") === "true";

  const { categories, loading, refreshCategories } = useCategories();

  // Dialog state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<CategoryItem | null>(null);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [color, setColor] = React.useState("#10b981");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Auto-open modal if ?new=true query param is present
  React.useEffect(() => {
    if (shouldOpenNew) {
      openCreateModal();
      router.replace("/settings/categories");
    }
  }, [shouldOpenNew, router]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setColor("#3b82f6");
    setModalOpen(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setColor(cat.color || "#3b82f6");
    setModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingCategory) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setSlug(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        // Update category
        const res = await fetch(`/api/categories/${editingCategory.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update category");
        }

        toast.success(`Updated "${name.trim()}"`);
      } else {
        // Create category
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim() || undefined,
            color,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create category");
        }

        toast.success(`Created category "${name.trim()}"`);
      }

      setModalOpen(false);
      refreshCategories();
      window.dispatchEvent(new CustomEvent("refresh-categories"));
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if ((deleteTarget.count ?? 0) > 0) {
      toast.error(
        `Cannot delete: ${deleteTarget.count} lesson(s) are assigned to this category.`
      );
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/categories/${deleteTarget.slug}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete category");
      }

      toast.success(`Category "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      refreshCategories();
      window.dispatchEvent(new CustomEvent("refresh-categories"));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            Categories
          </h1>
          <p className="text-[13.5px] text-muted-foreground mt-0.5">
            Manage lesson curriculum categories, color tags, and navigation filters.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2 shrink-0 h-9 font-medium">
          <Plus className="size-4" />
          <span>Add Category</span>
        </Button>
      </div>

      <Card className="shadow-sm border border-border">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Curriculum Categories
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Categories are shown in the sidebar, workstation, and lessons filter.
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-normal text-xs tabular-nums">
              {categories.length} {categories.length === 1 ? "category" : "categories"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border bg-muted/40 text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Identifier</th>
                  <th className="px-5 py-3 text-center">Assigned Lessons</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                      Loading categories…
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                      No categories found. Click &quot;Add Category&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr
                      key={cat.slug}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="size-3 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-medium text-foreground text-[13.5px]">
                            {cat.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                          {cat.slug}
                        </code>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <Badge
                          variant="secondary"
                          className="font-normal tabular-nums text-xs"
                        >
                          <BookOpen className="mr-1 size-3 text-muted-foreground" />
                          {cat.count ?? 0}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditModal(cat)}
                            title="Edit category"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(cat)}
                            title="Delete category"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "New Category"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingCategory
                  ? "Update display name and category color tag."
                  : "Create a new curriculum series category with custom color tag."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="category-name" className="text-[13px] font-medium">
                  Category Name
                </Label>
                <Input
                  id="category-name"
                  placeholder="e.g. Young Adults, Discipleship"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="h-9"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category-slug" className="text-[13px] font-medium">
                  Identifier (Slug)
                </Label>
                <Input
                  id="category-slug"
                  placeholder="young_adults"
                  value={slug}
                  disabled={!!editingCategory}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-9 font-mono text-xs"
                />
                <p className="text-[11.5px] text-muted-foreground">
                  Used in URL parameters and internal lesson records.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Category Color</Label>

                {/* Preset Circles */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {PRESET_COLORS.map((preset) => {
                    const isSelected =
                      color.toLowerCase() === preset.toLowerCase();
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        className={`size-7 rounded-full transition-transform flex items-center justify-center cursor-pointer hover:scale-110 ${
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                            : ""
                        }`}
                        style={{ backgroundColor: preset }}
                      >
                        {isSelected && (
                          <Check className="size-3.5 text-white stroke-[3]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom HEX Input */}
                <div className="flex items-center gap-2.5 pt-1.5">
                  <div className="relative flex items-center">
                    <input
                      type="color"
                      value={color.startsWith("#") ? color : "#3b82f6"}
                      onChange={(e) => setColor(e.target.value)}
                      className="size-9 rounded-md border border-input cursor-pointer p-0.5 bg-background"
                      title="Choose custom color"
                    />
                  </div>
                  <Input
                    placeholder="#10b981"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 font-mono text-xs w-32"
                  />
                  <div
                    className="size-8 rounded-md border border-border shrink-0 shadow-2xs"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    Custom HEX tag
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingCategory
                  ? "Save Changes"
                  : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {(deleteTarget?.count ?? 0) > 0 ? (
                <>
                  <AlertTriangle className="size-5 text-amber-500" />
                  <span>Cannot Delete Category</span>
                </>
              ) : (
                <span>Delete Category</span>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(deleteTarget?.count ?? 0) > 0 ? (
                <span>
                  The category <strong>{deleteTarget?.name}</strong> has{" "}
                  <strong>{deleteTarget?.count}</strong> active lesson(s) assigned
                  to it. To delete this category, please reassign or delete the
                  affected lessons first.
                </span>
              ) : (
                <span>
                  Are you sure you want to delete{" "}
                  <strong>{deleteTarget?.name}</strong>? This action cannot be
                  undone.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {(deleteTarget?.count ?? 0) > 0 ? (
              <AlertDialogAction onClick={() => setDeleteTarget(null)}>
                OK
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

