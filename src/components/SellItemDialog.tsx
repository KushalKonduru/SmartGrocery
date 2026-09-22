import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";
import { useAchievements } from "@/hooks/useAchievements";

interface SellItemDialogProps {
  item: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
    image_url?: string;
    expiry_date?: string;
  };
  onItemListed: () => void;
}

export const SellItemDialog = ({ item, onItemListed }: SellItemDialogProps) => {
  const [open, setOpen] = useState(false);
  const [originalPrice, setOriginalPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [quantity, setQuantity] = useState(item.quantity.toString());
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | undefined>();
  const { checkAndAwardAchievements } = useAchievements(userId);
  const [pickupLocation, setPickupLocation] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("address, pincode")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profile) {
          setPickupLocation(profile.address);
          setPincode(profile.pincode);
        }
      }
    };
    loadUserData();
  }, []);

  const getDaysUntilExpiry = () => {
    if (!item.expiry_date) return null;
    const expiry = new Date(item.expiry_date);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const canSell = () => {
    const daysUntilExpiry = getDaysUntilExpiry();
    if (!daysUntilExpiry) return true; // No expiry date set
    
    if (item.category === 'Dairy Products') {
      return daysUntilExpiry >= 2;
    }
    return daysUntilExpiry >= 7;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSell()) {
      const daysUntilExpiry = getDaysUntilExpiry();
      const message = item.category === 'Dairy Products' 
        ? 'Dairy products must have at least 2 days before expiry to sell'
        : 'Items must have at least 7 days before expiry to sell';
      
      toast({
        title: "Cannot list item",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // List item in marketplace
      const { error: listError } = await supabase.from("marketplace_items").insert({
        user_id: user.id,
        pantry_item_id: item.id,
        name: item.name,
        category: item.category,
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        sale_price: parseFloat(salePrice),
        quantity: parseFloat(quantity),
        unit: item.unit,
        expiry_date: item.expiry_date,
        image_url: item.image_url,
        description,
        pickup_location: pickupLocation,
        pincode: pincode,
        status: "available",
      } as any);

      if (listError) throw listError;

      // Delete item from pantry after successfully listing for sale
      const { error: deleteError } = await supabase
        .from("pantry_items")
        .delete()
        .eq("id", item.id);

      if (deleteError) throw deleteError;

      toast({
        title: "Item listed!",
        description: `${item.name} is now available in the marketplace and removed from your pantry`,
      });

      // Check for achievements
      await checkAndAwardAchievements();

      setOpen(false);
      onItemListed();
    } catch (error: any) {
      toast({
        title: "Error listing item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <DollarSign className="w-4 h-4" />
          Sell
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>List {item.name} for Sale</DialogTitle>
          <DialogDescription>
            {!canSell() && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg mb-2">
                {item.category === 'Dairy Products' 
                  ? '⚠️ This dairy item needs at least 2 days before expiry to sell. Consider donating instead.'
                  : '⚠️ This item needs at least 7 days before expiry to sell. Consider donating instead.'}
              </div>
            )}
            Set your price and list this item in the marketplace
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity to Sell</Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
                required
                max={item.quantity}
              />
              <span className="flex items-center text-sm text-muted-foreground px-3">
                {item.unit}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Available: {item.quantity} {item.unit}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="originalPrice">Original Price (Optional)</Label>
            <Input
              id="originalPrice"
              type="number"
              step="0.01"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="₹0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salePrice">Sale Price *</Label>
            <Input
              id="salePrice"
              type="number"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="₹0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any details about the item..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickupLocation">Pickup Location *</Label>
            <Input
              id="pickupLocation"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="Your address for pickup"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode *</Label>
            <Input
              id="pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="Area pincode"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Listing..." : "List Item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};