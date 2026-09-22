import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAchievements } from "@/hooks/useAchievements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, DollarSign, Gift, Trophy, TrendingUp, PieChart } from "lucide-react";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const { profile } = useProfile();
  const { userAchievements } = useAchievements(user?.id);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSales: 0,
    totalDonations: 0,
    activeListings: 0,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) loadStats(user.id);
    });
  }, []);

  const loadStats = async (userId: string) => {
    const [orders, sales, donations, listings] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact" }).eq("buyer_id", userId),
      supabase.from("orders").select("*", { count: "exact" }).eq("seller_id", userId),
      supabase.from("donations").select("*", { count: "exact" }).eq("user_id", userId),
      supabase
        .from("marketplace_items")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .eq("status", "available"),
    ]);

    setStats({
      totalOrders: orders.count || 0,
      totalSales: sales.count || 0,
      totalDonations: donations.count || 0,
      activeListings: listings.count || 0,
    });
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-2xl text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">Profile</h1>
        </div>

        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile?.profile_picture_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left space-y-2">
                <h2 className="text-2xl font-bold">
                  {profile?.full_name || "User"}
                </h2>
                <p className="text-muted-foreground">{user.email}</p>
                {profile?.address && (
                  <p className="text-sm text-muted-foreground">
                    {profile.address}, {profile.pincode}
                  </p>
                )}
                {profile?.phone && (
                  <p className="text-sm text-muted-foreground">{profile.phone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                Items purchased
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSales}</div>
              <p className="text-xs text-muted-foreground">
                Items sold
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Donations</CardTitle>
              <Gift className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDonations}</div>
              <p className="text-xs text-muted-foreground">
                Items donated
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeListings}</div>
              <p className="text-xs text-muted-foreground">
                In marketplace
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Achievements Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userAchievements.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userAchievements.map((achievement) => (
                  <Badge
                    key={achievement.id}
                    variant="secondary"
                    className="text-lg py-2 px-4"
                  >
                    {achievement.achievement_type}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No achievements yet. Keep using the app to unlock badges!
              </p>
            )}
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/achievements")}
            >
              View All Achievements
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Button variant="outline" onClick={() => navigate("/my-orders")}>
              <Package className="w-4 h-4 mr-2" />
              View Orders
            </Button>
            <Button variant="outline" onClick={() => navigate("/my-sales")}>
              <DollarSign className="w-4 h-4 mr-2" />
              View Sales
            </Button>
            
            <Button variant="outline" onClick={() => navigate("/analytics/expenditure")}>
              <DollarSign className="w-4 h-4 mr-2" />
              Expenditure Tracking
            </Button>
            <Button variant="outline" onClick={() => navigate("/analytics/consumption")}>
              <PieChart className="w-4 h-4 mr-2" />
              Consumption Analysis
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Pantry
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
