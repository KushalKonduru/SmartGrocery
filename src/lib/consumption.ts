import { supabase } from "@/integrations/supabase/client";

export type TimeRange = "week" | "month" | "year";
export type CategoryFilter = "all" | "Fruits" | "Vegetables" | "Dairy Products" | "Meat & Poultry" | "Grains" | "Snacks" | "Beverages" | "Other";

function getSince(range: TimeRange): string {
  const now = new Date();
  if (range === "week") {
    now.setDate(now.getDate() - 7);
  } else if (range === "month") {
    now.setMonth(now.getMonth() - 1);
  } else if (range === "year") {
    now.setFullYear(now.getFullYear() - 1);
  }
  return now.toISOString();
}

export async function getConsumptionByCategory(
  userId: string,
  range: TimeRange,
  category: CategoryFilter,
  search: string
) {
  const since = getSince(range);
  let query = (supabase as any)
    .from("consumed_items" as any)
    .select("category, quantity, name")
    .eq("user_id", userId)
    .gte("consumed_at", since);

  if (category !== "all") query = query.eq("category", category);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = (await query) as any;
  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const row of (data || []) as any[]) {
    totals[row.category] = (totals[row.category] || 0) + Number(row.quantity || 0);
  }

  return Object.entries(totals).map(([category, total]) => ({ category, total }));
}

export async function getTopConsumedItems(
  userId: string,
  range: TimeRange,
  category: CategoryFilter,
  search: string,
  limit = 10
) {
  const since = getSince(range);
  let query = (supabase as any)
    .from("consumed_items" as any)
    .select("name, category, unit, quantity")
    .eq("user_id", userId)
    .gte("consumed_at", since);

  if (category !== "all") query = query.eq("category", category);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;

  const byItem = new Map<string, { name: string; category: string; unit: string; total: number }>();
  for (const row of (data || []) as any[]) {
    const key = row.name + "|" + (row.unit || "");
    const prev = byItem.get(key) || { name: row.name, category: row.category, unit: row.unit, total: 0 };
    prev.total += Number(row.quantity || 0);
    byItem.set(key, prev);
  }

  return Array.from(byItem.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// When a specific category is selected, return item-level breakdown within that category
export async function getItemBreakdownInCategory(
  userId: string,
  range: TimeRange,
  category: Exclude<CategoryFilter, "all">,
  search: string
) {
  const since = getSince(range);
  let query = (supabase as any)
    .from("consumed_items" as any)
    .select("name, unit, quantity")
    .eq("user_id", userId)
    .eq("category", category)
    .gte("consumed_at", since);

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = (await query) as any;
  if (error) throw error;

  const byItem = new Map<string, { name: string; unit: string; total: number }>();
  let categoryTotal = 0;
  for (const row of (data || []) as any[]) {
    const key = row.name + "|" + (row.unit || "");
    const prev = byItem.get(key) || { name: row.name, unit: row.unit, total: 0 };
    const q = Number(row.quantity || 0);
    prev.total += q;
    categoryTotal += q;
    byItem.set(key, prev);
  }

  const items = Array.from(byItem.values());
  const withPercent = items.map((i) => ({
    ...i,
    percent: categoryTotal > 0 ? (i.total / categoryTotal) * 100 : 0,
  }));

  return { items: withPercent, categoryTotal };
}
