import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getConsumptionByCategory, getTopConsumedItems, getItemBreakdownInCategory, type TimeRange, type CategoryFilter } from "@/lib/consumption";
import { useToast } from "@/hooks/use-toast";
import { Filter, Calendar, ListOrdered } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "Fruits": "#ff6b6b",
  "Vegetables": "#51cf66",
  "Dairy Products": "#ffd43b",
  "Meat & Poultry": "#ff8787",
  "Grains": "#fcc419",
  "Snacks": "#ff922b",
  "Beverages": "#74c0fc",
  "Other": "#adb5bd",
};

export const ConsumptionAnalytics = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [categoryData, setCategoryData] = useState<{ category: string; total: number }[]>([]);
  const [itemBreakdown, setItemBreakdown] = useState<{ name: string; unit: string; total: number; percent: number }[]>([]);
  const [itemCategoryTotal, setItemCategoryTotal] = useState<number>(0);
  const [topItems, setTopItems] = useState<{ name: string; category: string; unit: string; total: number }[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    init();
  }, []);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const topItemsPromise = getTopConsumedItems(userId, timeRange, categoryFilter, search, 8);
      if (categoryFilter === "all") {
        const [cats, items] = await Promise.all([
          getConsumptionByCategory(userId, timeRange, categoryFilter, search),
          topItemsPromise,
        ]);
        setCategoryData(cats);
        setItemBreakdown([]);
        setItemCategoryTotal(0);
        setTopItems(items);
      } else {
        const [{ items: itemList, categoryTotal }, items] = await Promise.all([
          getItemBreakdownInCategory(userId, timeRange, categoryFilter as Exclude<CategoryFilter, "all">, search),
          topItemsPromise,
        ]);
        setItemBreakdown(itemList);
        setItemCategoryTotal(categoryTotal);
        setCategoryData([]);
        setTopItems(items);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to load consumption data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, timeRange, categoryFilter, search]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("consumed-items-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "consumed_items", filter: `user_id=eq.${userId}` },
        () => {
          // Re-fetch on every relevant insert
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, timeRange, categoryFilter, search]);

  const pieData = useMemo(() => {
    if (categoryFilter === "all") {
      const total = categoryData.reduce((acc, d) => acc + d.total, 0);
      return categoryData.map((d) => ({ name: d.category, value: total > 0 ? (d.total / total) * 100 : 0 }));
    }
    return itemBreakdown.map((d) => ({ name: d.name, value: d.percent, unit: d.unit }));
  }, [categoryFilter, categoryData, itemBreakdown]);

  function hexToHsl(hex: string) {
    const n = hex.replace('#','');
    const bigint = parseInt(n, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const r1 = r/255, g1 = g/255, b1 = b/255;
    const max = Math.max(r1,g1,b1), min = Math.min(r1,g1,b1);
    let h = 0, s = 0, l = (max+min)/2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
        case r1: h = (g1 - b1) / d + (g1 < b1 ? 6 : 0); break;
        case g1: h = (b1 - r1) / d + 2; break;
        case b1: h = (r1 - g1) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h*360, s: s*100, l: l*100 };
  }

  function hslToHex(h: number, s: number, l: number) {
    s/=100; l/=100;
    const c = (1 - Math.abs(2*l - 1)) * s;
    const x = c * (1 - Math.abs(((h/60) % 2) - 1));
    const m = l - c/2;
    let r=0,g=0,b=0;
    if (0 <= h && h < 60) { r=c; g=x; b=0; }
    else if (60 <= h && h < 120) { r=x; g=c; b=0; }
    else if (120 <= h && h < 180) { r=0; g=c; b=x; }
    else if (180 <= h && h < 240) { r=0; g=x; b=c; }
    else if (240 <= h && h < 300) { r=x; g=0; b=c; }
    else { r=c; g=0; b=x; }
    const toHex = (v: number) => {
      const hv = Math.round((v + m) * 255).toString(16).padStart(2,'0');
      return hv;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function generateShades(baseHex: string, count: number) {
    const { h, s } = hexToHsl(baseHex);
    const shades: string[] = [];
    const minL = 35, maxL = 70;
    for (let i=0;i<count;i++) {
      const l = count === 1 ? 50 : minL + (i * (maxL - minL)) / (count - 1);
      shades.push(hslToHex(h, s, l));
    }
    return shades;
  }

  const sliceColors = useMemo(() => {
    if (categoryFilter === "all") {
      return pieData.map((d: any) => CATEGORY_COLORS[d.name] || CATEGORY_COLORS["Other"]);
    }
    const base = CATEGORY_COLORS[categoryFilter] || "#94a3b8";
    return generateShades(base, pieData.length);
  }, [categoryFilter, pieData]);

  if (!userId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Please sign in to view consumption analytics</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading consumption data...</p>
        </div>
      </div>
    );
  }

  const hasData = pieData.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Consumption Analytics
            </CardTitle>
            <div className="flex gap-3 flex-wrap">
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="year">Past Year</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Fruits">Fruits</SelectItem>
                  <SelectItem value="Vegetables">Vegetables</SelectItem>
                  <SelectItem value="Dairy Products">Dairy Products</SelectItem>
                  <SelectItem value="Meat & Poultry">Meat & Poultry</SelectItem>
                  <SelectItem value="Grains">Grains</SelectItem>
                  <SelectItem value="Snacks">Snacks</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Input
                  placeholder="Search item name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[220px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Consumption by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <ResponsiveContainer width="100%" height={360}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ value, name }: any) => `${name}: ${Number(value).toFixed(1)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={sliceColors[index] || CATEGORY_COLORS["Other"]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${Number(value).toFixed(2)}%`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-12">No consumption data for the selected filters.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="w-5 h-5" />
              Top Items Consumed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topItems.length ? (
              <div className="space-y-3">
                {topItems.map((it, idx) => (
                  <div key={it.name + idx} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.category}</div>
                    </div>
                    <div className="text-sm font-semibold">{it.total} {it.unit}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">No items match the selected filters.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsumptionAnalytics;
