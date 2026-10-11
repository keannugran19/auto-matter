import { NextRequest, NextResponse } from "next/server";
import { getAllCategories, createCategory } from "@/lib/categoriesStore";

export async function GET() {
  try {
    const categories = await getAllCategories();
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const created = await createCategory({
      name: body.name,
      slug: body.slug,
      color: body.color || "#3b82f6",
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

