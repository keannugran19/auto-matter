import { createServiceClient } from "./supabase/server";
import { CategoryItem, DEFAULT_CATEGORIES } from "./types";

// In-memory fallback if Supabase categories table is not created yet
let memoryCategories: CategoryItem[] = [...DEFAULT_CATEGORIES];

async function populateCounts(categories: CategoryItem[]): Promise<CategoryItem[]> {
  try {
    const db = createServiceClient();
    const { data: lessons } = await db.from("lessons").select("category");
    const counts: Record<string, number> = {};
    if (lessons) {
      for (const l of lessons) {
        if (l.category) {
          counts[l.category] = (counts[l.category] || 0) + 1;
        }
      }
    }
    return categories.map((c) => ({
      ...c,
      count: counts[c.slug] || 0,
    }));
  } catch {
    return categories.map((c) => ({ ...c, count: c.count ?? 0 }));
  }
}

export async function getAllCategories(): Promise<CategoryItem[]> {
  const db = createServiceClient();
  try {
    const { data, error } = await db
      .from("categories")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !data) {
      return await populateCounts(memoryCategories);
    }

    if (data.length === 0) {
      // Seed default categories into DB
      await db.from("categories").upsert(
        DEFAULT_CATEGORIES.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          color: c.color,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      );
      return await populateCounts(DEFAULT_CATEGORIES);
    }

    const items: CategoryItem[] = data.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return await populateCounts(items);
  } catch {
    return await populateCounts(memoryCategories);
  }
}

export async function createCategory(input: {
  name: string;
  slug?: string;
  color: string;
}): Promise<CategoryItem> {
  const db = createServiceClient();
  const name = input.name.trim();
  const slug =
    (input.slug?.trim() || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  if (!slug) {
    throw new Error("Invalid category name or slug");
  }

  const color = input.color.trim() || "#3b82f6";
  const now = new Date().toISOString();

  const newCat: CategoryItem = {
    id: slug,
    name,
    slug,
    color,
    count: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const { data, error } = await db
      .from("categories")
      .insert({
        id: slug,
        name,
        slug,
        color,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      if (memoryCategories.some((c) => c.slug === slug)) {
        throw new Error("Category already exists");
      }
      memoryCategories.push(newCat);
      return newCat;
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      color: data.color,
      count: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err: any) {
    if (memoryCategories.some((c) => c.slug === slug)) {
      throw new Error("Category already exists");
    }
    memoryCategories.push(newCat);
    return newCat;
  }
}

export async function updateCategory(
  idOrSlug: string,
  updates: { name?: string; color?: string }
): Promise<CategoryItem> {
  const db = createServiceClient();
  const now = new Date().toISOString();
  const patch: Record<string, any> = { updated_at: now };
  if (updates.name) patch.name = updates.name.trim();
  if (updates.color) patch.color = updates.color.trim();

  try {
    const { data, error } = await db
      .from("categories")
      .update(patch)
      .eq("slug", idOrSlug)
      .select()
      .single();

    if (error) {
      const idx = memoryCategories.findIndex(
        (c) => c.id === idOrSlug || c.slug === idOrSlug
      );
      if (idx !== -1) {
        memoryCategories[idx] = {
          ...memoryCategories[idx],
          ...updates,
          updatedAt: now,
        };
        return memoryCategories[idx];
      }
      throw new Error(error.message);
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      color: data.color,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err: any) {
    const idx = memoryCategories.findIndex(
      (c) => c.id === idOrSlug || c.slug === idOrSlug
    );
    if (idx !== -1) {
      memoryCategories[idx] = {
        ...memoryCategories[idx],
        ...updates,
        updatedAt: now,
      };
      return memoryCategories[idx];
    }
    throw err;
  }
}

export async function deleteCategory(idOrSlug: string): Promise<void> {
  const db = createServiceClient();

  // Validate no lessons use this category
  try {
    const { data: lessons } = await db
      .from("lessons")
      .select("id")
      .eq("category", idOrSlug);

    if (lessons && lessons.length > 0) {
      throw new Error(
        `Cannot delete: ${lessons.length} lesson(s) are assigned to this category.`
      );
    }
  } catch (err: any) {
    if (err.message?.includes("Cannot delete")) throw err;
  }

  try {
    const { error } = await db
      .from("categories")
      .delete()
      .eq("slug", idOrSlug);

    if (error) {
      memoryCategories = memoryCategories.filter(
        (c) => c.id !== idOrSlug && c.slug !== idOrSlug
      );
      return;
    }
  } catch {
    memoryCategories = memoryCategories.filter(
      (c) => c.id !== idOrSlug && c.slug !== idOrSlug
    );
  }
}

