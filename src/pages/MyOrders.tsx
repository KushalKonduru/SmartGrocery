import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, MapPin, CreditCard, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function MyOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    loadOrders();

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to all order changes and filter client-side
      const channel = supabase
        .channel(`orders-changes-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
          },
          (payload) => {
            // Only refresh if this order is for the current user
            if (payload.new && payload.new.buyer_id === user.id) {
              console.log("New order detected, refreshing...");
              loadOrders();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
          },
          (payload) => {
            // Only refresh if this order update is for the current user
            if (payload.new && payload.new.buyer_id === user.id) {
              console.log("Order updated, refreshing...");
              loadOrders();
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    setupRealtime();

    // Refresh when window gains focus
    const handleFocus = () => {
      loadOrders();
    };
    window.addEventListener("focus", handleFocus);

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadOrders();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const loadOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("order_date", { ascending: false });

    if (error) {
      console.error("Error loading orders:", error);
      setLoading(false);
      return;
    }

    console.log("Loaded orders:", data?.length || 0, "orders");
    if (data) {
      setOrders(data);
    } else {
      setOrders([]);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "default";
      case "in_transit": return "secondary";
      case "pending": return "outline";
      default: return "outline";
    }
  };

  if (loading) {
    return <div className="container py-8">Loading orders...</div>;
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">My Orders</h1>
        </div>
        <Button variant="outline" onClick={loadOrders} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground">
              Start shopping in the marketplace!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{order.item_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ordered {formatDistanceToNow(new Date(order.order_date))} ago
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">₹{order.item_price}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">Delivery Status</span>
                    </div>
                    <Badge variant={getStatusColor(order.delivery_status)}>
                      {order.delivery_status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">Payment Status</span>
                    </div>
                    <Badge variant={order.payment_status === "completed" ? "default" : "outline"}>
                      {order.payment_status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">Delivery Address</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
                </div>

                {order.tracking_id && (
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm font-semibold">Tracking ID</p>
                    <p className="text-sm text-muted-foreground font-mono">{order.tracking_id}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}