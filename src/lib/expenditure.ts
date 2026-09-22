import { supabase } from "@/integrations/supabase/client";

export type TimePeriod = "week" | "month" | "all";
export type CategoryFilter = "all" | "Fruits" | "Vegetables" | "Dairy Products" | "Meat & Poultry" | "Grains" | "Snacks" | "Beverages" | "Other";

export interface ExpenditureData {
  category: string;
  total_positive: number;
  total_negative: number;
  net_amount: number;
  transaction_count: number;
}

export interface WeeklyExpenditureData {
  week_start: string;
  category: string;
  total_positive: number;
  total_negative: number;
  net_amount: number;
}

export interface MonthlyExpenditureData {
  month_start: string;
  category: string;
  total_positive: number;
  total_negative: number;
  net_amount: number;
}

/**
 * Get date range based on time period
 */
export function getExpenditureDateRange(period: TimePeriod): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();

  switch (period) {
    case "week":
      // Get current week start (Monday)
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "all":
      // Use a fixed early date so we include all historical transactions
      start.setFullYear(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
}

/**
 * Fetch expenditure data by category for the selected time period
 */
export async function getExpenditureByCategory(
  userId: string,
  period: TimePeriod,
  categoryFilter: CategoryFilter = "all"
): Promise<ExpenditureData[]> {
  const { start, end } = getExpenditureDateRange(period);
  
  let query = supabase
    .from("expenditures")
    .select("category, amount, transaction_type")
    .eq("user_id", userId)
    .gte("transaction_date", start.toISOString())
    .lte("transaction_date", end.toISOString());

  if (categoryFilter !== "all") {
    query = query.eq("category", categoryFilter);
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Aggregate by category
  const categoryMap = new Map<string, { positive: number; negative: number; count: number }>();

  data.forEach((item) => {
    const category = item.category;
    const existing = categoryMap.get(category) || { positive: 0, negative: 0, count: 0 };
    
    if (item.amount > 0) {
      existing.positive += Number(item.amount);
    } else {
      existing.negative += Math.abs(Number(item.amount));
    }
    existing.count += 1;
    
    categoryMap.set(category, existing);
  });

  // Convert to array format
  const results: ExpenditureData[] = Array.from(categoryMap.entries()).map(([category, stats]) => ({
    category,
    total_positive: stats.positive,
    total_negative: stats.negative,
    net_amount: stats.positive - stats.negative,
    transaction_count: stats.count,
  }));

  return results.sort((a, b) => Math.abs(b.net_amount) - Math.abs(a.net_amount));
}

/**
 * Fetch weekly expenditure breakdown
 */
export async function getWeeklyExpenditure(
  userId: string,
  categoryFilter: CategoryFilter = "all",
  weeks: number = 4
): Promise<WeeklyExpenditureData[]> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  const start = new Date();
  start.setDate(start.getDate() - (weeks * 7));
  start.setHours(0, 0, 0, 0);

  let query = supabase
    .from("expenditures")
    .select("transaction_date, category, amount")
    .eq("user_id", userId)
    .gte("transaction_date", start.toISOString())
    .lte("transaction_date", end.toISOString())
    .order("transaction_date", { ascending: true });

  if (categoryFilter !== "all") {
    query = query.eq("category", categoryFilter);
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Group by week and category
  const weekMap = new Map<string, Map<string, { positive: number; negative: number }>>();

  data.forEach((item) => {
    const date = new Date(item.transaction_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, new Map());
    }

    const categoryMap = weekMap.get(weekKey)!;
    const category = item.category;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { positive: 0, negative: 0 });
    }

    const stats = categoryMap.get(category)!;
    const amount = Number(item.amount);

    if (amount > 0) {
      stats.positive += amount;
    } else {
      stats.negative += Math.abs(amount);
    }
  });

  // Convert to array
  const results: WeeklyExpenditureData[] = [];
  weekMap.forEach((categoryMap, weekStart) => {
    categoryMap.forEach((stats, category) => {
      results.push({
        week_start: weekStart,
        category,
        total_positive: stats.positive,
        total_negative: stats.negative,
        net_amount: stats.positive - stats.negative,
      });
    });
  });

  return results.sort((a, b) => a.week_start.localeCompare(b.week_start));
}

/**
 * Fetch monthly expenditure breakdown
 */
export async function getMonthlyExpenditure(
  userId: string,
  categoryFilter: CategoryFilter = "all",
  months: number = 6
): Promise<MonthlyExpenditureData[]> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  let query = supabase
    .from("expenditures")
    .select("transaction_date, category, amount")
    .eq("user_id", userId)
    .gte("transaction_date", start.toISOString())
    .lte("transaction_date", end.toISOString())
    .order("transaction_date", { ascending: true });

  if (categoryFilter !== "all") {
    query = query.eq("category", categoryFilter);
  }

  const { data, error } = await query;

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Group by month and category
  const monthMap = new Map<string, Map<string, { positive: number; negative: number }>>();

  data.forEach((item) => {
    const date = new Date(item.transaction_date);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthKey = monthStart.toISOString().split("T")[0];

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, new Map());
    }

    const categoryMap = monthMap.get(monthKey)!;
    const category = item.category;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { positive: 0, negative: 0 });
    }

    const stats = categoryMap.get(category)!;
    const amount = Number(item.amount);

    if (amount > 0) {
      stats.positive += amount;
    } else {
      stats.negative += Math.abs(amount);
    }
  });

  // Convert to array
  const results: MonthlyExpenditureData[] = [];
  monthMap.forEach((categoryMap, monthStart) => {
    categoryMap.forEach((stats, category) => {
      results.push({
        month_start: monthStart,
        category,
        total_positive: stats.positive,
        total_negative: stats.negative,
        net_amount: stats.positive - stats.negative,
      });
    });
  });

  return results.sort((a, b) => a.month_start.localeCompare(b.month_start));
}

/**
 * Get total expenditure summary
 */
export async function getExpenditureSummary(
  userId: string,
  period: TimePeriod
): Promise<{ total_positive: number; total_negative: number; net_amount: number }> {
  const { start, end } = getExpenditureDateRange(period);

  const { data, error } = await supabase
    .from("expenditures")
    .select("amount")
    .eq("user_id", userId)
    .gte("transaction_date", start.toISOString())
    .lte("transaction_date", end.toISOString());

  if (error) throw error;
  if (!data || data.length === 0) {
    return { total_positive: 0, total_negative: 0, net_amount: 0 };
  }

  let totalPositive = 0;
  let totalNegative = 0;

  data.forEach((item) => {
    const amount = Number(item.amount);
    if (amount > 0) {
      totalPositive += amount;
    } else {
      totalNegative += Math.abs(amount);
    }
  });

  return {
    total_positive: totalPositive,
    total_negative: totalNegative,
    net_amount: totalPositive - totalNegative,
  };
}






