import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Filter,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  type TimePeriod,
  type CategoryFilter,
  getExpenditureByCategory,
  getMonthlyExpenditure,
  getWeeklyExpenditure,
  getExpenditureSummary,
} from "@/lib/expenditure";
import { useToast } from "@/hooks/use-toast";

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

const POSITIVE_COLOR = "#22c55e"; // Green for purchases
const NEGATIVE_COLOR = "#ef4444"; // Red for losses

export const ExpenditureAnalytics = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_positive: 0, total_negative: 0, net_amount: 0 });

  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const loadExpenditure = async () => {
      setLoading(true);
      try {
        const [categoryDataResult, summaryResult] = await Promise.all([
          getExpenditureByCategory(userId, timePeriod, categoryFilter),
          getExpenditureSummary(userId, timePeriod),
        ]);

        setCategoryData(categoryDataResult);
        setSummary(summaryResult);
      } catch (error: any) {
        console.error("Error loading expenditure:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load expenditure data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadExpenditure();
  }, [userId, timePeriod, categoryFilter, toast]);

  // Format data for chart (separate positive and negative bars)
  const chartData = categoryData.map((item) => ({
    category: item.category,
    "Purchases (₹)": item.total_positive,
    "Losses/Waste (₹)": -item.total_negative, // Negative for downward bars
    net: item.net_amount,
  }));

  // Custom tooltip to show formatted values
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.category}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-green-600">Purchases:</span>
              <span className="font-medium">₹{data["Purchases (₹)"]?.toFixed(2) || 0}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-red-600">Losses/Waste:</span>
              <span className="font-medium">₹{Math.abs(data["Losses/Waste (₹)"] || 0).toFixed(2)}</span>
            </div>
            <div className="border-t pt-1 mt-1">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">Net:</span>
                <span className={`font-bold ${data.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ₹{data.net.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Render cells with proper colors: green for purchases, red for losses
  const renderPurchaseBars = () => {
    return categoryData.map((item, index) => (
      <Cell key={`purchase-cell-${index}`} fill={POSITIVE_COLOR} />
    ));
  };

  const renderLossBars = () => {
    return categoryData.map((item, index) => (
      <Cell key={`loss-cell-${index}`} fill={NEGATIVE_COLOR} />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading expenditure data...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Please sign in to view expenditure analytics</p>
        </CardContent>
      </Card>
    );
  }

  const hasData = categoryData.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Expenditure Data</h3>
          <p className="text-muted-foreground">
            Start purchasing items or track resold items to see expenditure analytics here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Expenditure Tracking
            </CardTitle>
            <div className="flex gap-3">
              <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
              >
                <SelectTrigger className="w-[160px]">
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
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Total Purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{summary.total_positive.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Money spent on purchases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              Total Losses/Waste
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{summary.total_negative.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Expired items & resale losses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Net Expenditure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                summary.net_amount >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              ₹{summary.net_amount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Purchases - Losses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Expenditure by Category ({
              timePeriod === "week"
                ? "Weekly"
                : timePeriod === "month"
                ? "Monthly"
                : "All time"
            })
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Positive bars (upward) show purchases. Negative bars (downward) show losses from expired or resold items.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis
                dataKey="category"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickFormatter={(value) => `₹${value >= 0 ? value : Math.abs(value)}`}
                label={{
                  value: "Amount (₹)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#9ca3af" },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="square"
              />
              {/* Positive bars (upward) - Green for all purchases */}
              <Bar
                dataKey="Purchases (₹)"
                fill={POSITIVE_COLOR}
                name="Purchases (₹)"
                radius={[4, 4, 0, 0]}
              >
                {renderPurchaseBars()}
              </Bar>
              {/* Negative bars (downward) - Red for all losses */}
              <Bar
                dataKey="Losses/Waste (₹)"
                fill={NEGATIVE_COLOR}
                name="Losses/Waste (₹)"
                radius={[0, 0, 4, 4]}
              >
                {renderLossBars()}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend Explanation */}
          <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-muted-foreground">
                Positive bars = Money spent on purchases
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-muted-foreground">
                Negative bars = Losses from resold items
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-semibold">Category</th>
                  <th className="text-right p-3 text-sm font-semibold">Purchases</th>
                  <th className="text-right p-3 text-sm font-semibold">Losses/Waste</th>
                  <th className="text-right p-3 text-sm font-semibold">Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((item) => (
                  <tr key={item.category} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Other"],
                          }}
                        ></div>
                        <span className="font-medium">{item.category}</span>
                      </div>
                    </td>
                    <td className="text-right p-3 text-green-600 font-medium">
                      ₹{item.total_positive.toFixed(2)}
                    </td>
                    <td className="text-right p-3 text-red-600 font-medium">
                      ₹{item.total_negative.toFixed(2)}
                    </td>
                    <td className="text-right p-3">
                      <span
                        className={`font-bold ${
                          item.net_amount >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        ₹{item.net_amount.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

