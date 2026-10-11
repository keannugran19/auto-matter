"use client";

import * as React from "react";
import { CategoryItem, DEFAULT_CATEGORIES } from "./types";

export function useCategories() {
  const [categories, setCategories] = React.useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = React.useState(true);

  const fetchCategories = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
        }
      }
    } catch {
      // Fallback to current categories
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCategories();
    const handleRefresh = () => fetchCategories();
    window.addEventListener("refresh-categories", handleRefresh);
    window.addEventListener("refresh-lessons", handleRefresh);
    return () => {
      window.removeEventListener("refresh-categories", handleRefresh);
      window.removeEventListener("refresh-lessons", handleRefresh);
    };
  }, [fetchCategories]);

  return { categories, loading, refreshCategories: fetchCategories };
}

