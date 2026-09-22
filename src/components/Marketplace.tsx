import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Calendar, Package, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useProfile } from "@/hooks/useProfile";
import { ProfileSetup } from "./ProfileSetup";

interface MarketplaceItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  original_price?: number;
  sale_price: number;
  quantity: number;
  unit: string;
  expiry_date?: string;
  image_url?: string;
  description?: string;
  status: string;
  created_at: string;
  pickup_location?: string;
  pincode?: string;
}

export const Marketplace = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { toast } = useToast();
  const { profile, loading: profileLoading } = useProfile();

  const loadMarketplaceItems = async () => {
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("*")
      .in("status", ["available", "sold"])
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMarketplaceItems();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("marketplace-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "marketplace_items",
        },
        () => {
          loadMarketplaceItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePurchase = async (item: MarketplaceItem) => {
    if (!profile) {
      toast({
        title: "Complete your profile",
        description: "Please complete your profile before purchasing",
        variant: "destructive",
      });
      return;
    }

    // Prevent buying own items
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to make a purchase",
        variant: "destructive",
      });
      return;
    }

    if (item.user_id === user.id) {
      toast({
        title: "Cannot purchase",
        description: "You cannot buy your own items",
        variant: "destructive",
      });
      return;
    }

    setPurchasing(item.id);
    try {
      // Get seller profile for pickup location
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('address, pincode')
        .eq('user_id', item.user_id)
        .single();

      if (!sellerProfile) {
        throw new Error('Seller information not available');
      }

      // Mock payment processing (prototype - no real payment)
      const mockPaymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const deliveryPartners = ['Dunzo', 'Swiggy Genie', 'Porter', 'Shadowfax'];
      const deliveryPartner = deliveryPartners[Math.floor(Math.random() * deliveryPartners.length)];
      const trackingId = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: item.user_id,
          item_id: item.id,
          item_name: item.name,
          item_price: item.sale_price,
          payment_id: mockPaymentId,
          payment_status: 'completed',
          delivery_status: 'pending',
          delivery_partner: deliveryPartner,
          tracking_id: trackingId,
          pickup_address: `${sellerProfile.address}, ${sellerProfile.pincode}`,
          delivery_address: `${profile.address}, ${profile.pincode}`,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Mark marketplace item as sold instead of deleting it to preserve order history
      const { error: updateError } = await supabase
        .from('marketplace_items')
        .update({ status: 'sold' })
        .eq('id', item.id);

      if (updateError) throw updateError;

      setItems((previousItems) =>
        previousItems.map((marketplaceItem) =>
          marketplaceItem.id === item.id
            ? { ...marketplaceItem, status: "sold" }
            : marketplaceItem
        )
      );

      toast({
        title: "Item purchased successfully!",
        description: `Order confirmed. Tracking ID: ${trackingId}`,
      });

      loadMarketplaceItems();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  if (loading || profileLoading) {
    return <div className="text-center py-8">Loading marketplace...</div>;
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Complete your profile to buy and sell items in the marketplace
          </p>
        </div>
        <ProfileSetup />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No items available</h3>
        <p className="text-muted-foreground">
          Check back later for deals on expiring items
        </p>
      </div>
    );
  }

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MarketplaceItem[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Marketplace</h2>
          <p className="text-muted-foreground">
            Great deals on items from other users
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedItems).map(([category, categoryItems]) => {
          const sortedItems = [...categoryItems].sort((a, b) => {
            if (a.status === b.status) {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            return a.status === "available" ? -1 : 1;
          });

          return (
            <div key={category} className="space-y-4">
              <h3 className="text-xl font-semibold text-primary">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedItems.map((item) => {
                  const discount = item.original_price
                    ? Math.round(
                        ((item.original_price - item.sale_price) / item.original_price) *
                          100
                      )
                    : null;
                  const isSold = item.status === "sold";

                  return (
                    <Card key={item.id} className="card-hover overflow-hidden relative">
                      {item.image_url && (
                        <div className="h-48 overflow-hidden bg-muted">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{item.name}</CardTitle>
                          <div className="flex flex-col items-end gap-2">
                            {discount && (
                              <Badge variant="destructive" className="shrink-0">
                                {discount}% OFF
                              </Badge>
                            )}
                            {isSold && (
                              <Badge className="bg-destructive/15 text-destructive uppercase tracking-wide">
                                Sold
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">
                          ₹{item.sale_price}
                        </span>
                        {item.original_price && (
                          <span className="text-sm text-muted-foreground line-through">
                            ₹{item.original_price}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="w-4 h-4" />
                        {item.quantity} {item.unit}
                      </div>

                      {item.expiry_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span className="expiry-warning">
                            Expires: {new Date(item.expiry_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {item.pickup_location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span className="line-clamp-1">{item.pickup_location}</span>
                          {item.pincode && <span>({item.pincode})</span>}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Listed {formatDistanceToNow(new Date(item.created_at))} ago
                      </p>
                    </CardContent>
                    <CardFooter>
                        <Button
                          onClick={() => !isSold && handlePurchase(item)}
                          className="w-full"
                          disabled={isSold || purchasing === item.id}
                        >
                          <ShoppingBag className="w-4 h-4 mr-2" />
                          {isSold
                            ? "Sold"
                            : purchasing === item.id
                            ? "Processing..."
                            : "Buy Now"}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};