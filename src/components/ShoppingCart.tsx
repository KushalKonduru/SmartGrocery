import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart as CartIcon, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export const ShoppingCart = () => {
  const [items, setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const loadCartItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("cart_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data);
    }
  };

  useEffect(() => {
    loadCartItems();
  }, []);

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);

    if (!error) {
      loadCartItems();
      toast({
        title: "Item removed",
        description: "Item removed from shopping list.",
      });
    }
  };

  const clearCart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id);

    if (!error) {
      loadCartItems();
      toast({
        title: "Shopping list cleared",
        description: "All items removed from shopping list.",
      });
    }
  };

  // 🔍 Generate automatic search query
  const getSearchQuery = () => {
    if (items.length === 0) return "";
    return items.map((i) => i.name).join(" ");
  };

  // 🛒 Auto-search on Blinkit
  const orderOnBlinkit = () => {
    const query = getSearchQuery();
    window.open(
      `https://blinkit.com/s/?q=${encodeURIComponent(query)}`,
      "_blank"
    );
  };

  // 🛒 Auto-search on Swiggy Instamart
 const orderOnInstamart = () => {
  const query = getSearchQuery();
  // Try a few URL patterns:
  window.open(
    `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}`,
    "_blank"
  );
};


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CartIcon className="w-5 h-5" />
            Shopping List
          </CardTitle>
          <Badge variant="secondary">{items.length} items</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Your shopping list is empty
          </p>
        ) : (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={orderOnBlinkit} className="hero-button">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Order on Blinkit
                </Button>
                <Button
                  onClick={orderOnInstamart}
                  className="bg-gradient-to-r from-secondary to-accent text-secondary-foreground"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Order on Swiggy
                </Button>
              </div>
              <Button variant="outline" onClick={clearCart} className="w-full">
                Clear Shopping List
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
