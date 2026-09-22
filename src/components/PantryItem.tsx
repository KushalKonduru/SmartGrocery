import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Star, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DonateItemDialog } from "./DonateItemDialog";
import { SellItemDialog } from "./SellItemDialog";

interface PantryItemProps {
  item: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
    is_favorite: boolean;
    image_url?: string;
    expiry_date?: string;
    brand?: string | null;
  };
  onUpdate: () => void;
}

export const PantryItem = ({ item, onUpdate }: PantryItemProps) => {
  const [quantity, setQuantity] = useState(item.quantity);
  const { toast } = useToast();

  const getDaysUntilExpiry = () => {
    if (!item.expiry_date) return null;
    const today = new Date();
    const expiry = new Date(item.expiry_date);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilExpiry = getDaysUntilExpiry();
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 3;
  const canDonate = daysUntilExpiry !== null && daysUntilExpiry < 7 && daysUntilExpiry >= 0;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Dairy Products': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Vegetables': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Fruits': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Grains': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Meat & Poultry': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Beverages': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      'Snacks': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Other': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };
    return colors[category] || colors['Other'];
  };

  const updateQuantity = async (newQuantity: number) => {
    if (newQuantity < 0) return;

    const previousQuantity = quantity;
    const consumedDelta = Math.max(0, previousQuantity - newQuantity);

    setQuantity(newQuantity);

    // Auto-delete if quantity is 0
    if (newQuantity === 0) {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', item.id);

      if (error) {
        toast({
          title: "Error removing item",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Log consumption for the remaining quantity consumed
      if (consumedDelta > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('consumed_items' as any).insert({
            user_id: user.id,
            pantry_item_id: item.id,
            name: item.name,
            category: item.category,
            quantity: consumedDelta,
            unit: item.unit,
            cost: null,
            brand: item.brand ?? null,
            consumed_at: new Date().toISOString(),
          } as any);
        }
      }

      // Auto-add to shopping list if favorite
      if (item.is_favorite) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if item already exists in shopping list
          const { data: existingCartItem } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('name', item.name)
            .maybeSingle();

          if (existingCartItem) {
            // Update quantity if already in shopping list
            const { error: updateError } = await supabase
              .from('cart_items')
              .update({ quantity: existingCartItem.quantity + 1 })
              .eq('id', existingCartItem.id);

            if (updateError) {
              console.error('Error updating shopping list:', updateError);
              toast({
                title: "Error adding to shopping list",
                description: updateError.message,
                variant: "destructive",
              });
              return;
            }
          } else {
            // Insert new shopping list item without pantry_item_id since item is being deleted
            const { error: insertError } = await supabase
              .from('cart_items')
              .insert({
                user_id: user.id,
                name: item.name,
                quantity: 1,
                unit: item.unit,
              });

            if (insertError) {
              console.error('Error adding to shopping list:', insertError);
              toast({
                title: "Error adding to shopping list",
                description: insertError.message,
                variant: "destructive",
              });
              return;
            }
          }

          toast({
            title: "Added to shopping list!",
            description: `${item.name} removed from pantry and added to shopping list.`,
          });
        }
      } else {
        toast({
          title: "Item removed",
          description: `${item.name} has been removed from your pantry.`,
        });
      }
    } else {
      const { error } = await supabase
        .from('pantry_items')
        .update({ quantity: newQuantity })
        .eq('id', item.id);

      if (error) {
        toast({
          title: "Error updating quantity",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Log partial consumption if quantity decreased
      if (consumedDelta > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('consumed_items' as any).insert({
            user_id: user.id,
            pantry_item_id: item.id,
            name: item.name,
            category: item.category,
            quantity: consumedDelta,
            unit: item.unit,
            cost: null,
            brand: item.brand ?? null,
            consumed_at: new Date().toISOString(),
          } as any);
        }
      }
    }

    onUpdate();
  };

  const toggleFavorite = async () => {
    const { error } = await supabase
      .from('pantry_items')
      .update({ is_favorite: !item.is_favorite })
      .eq('id', item.id);

    if (!error) {
      onUpdate();
    }
  };

  const deleteItem = async () => {
    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', item.id);

    if (!error) {
      // Auto-add to shopping list if favorite
      if (item.is_favorite) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if item already exists in shopping list
          const { data: existingCartItem } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('name', item.name)
            .maybeSingle();

          if (existingCartItem) {
            // Update quantity if already in shopping list
            const { error: updateError } = await supabase
              .from('cart_items')
              .update({ quantity: existingCartItem.quantity + 1 })
              .eq('id', existingCartItem.id);

            if (updateError) {
              console.error('Error updating shopping list:', updateError);
              toast({
                title: "Error adding to shopping list",
                description: updateError.message,
                variant: "destructive",
              });
              return;
            }
          } else {
            // Insert new shopping list item without pantry_item_id since item is being deleted
            const { error: insertError } = await supabase
              .from('cart_items')
              .insert({
                user_id: user.id,
                name: item.name,
                quantity: 1,
                unit: item.unit,
              });

            if (insertError) {
              console.error('Error adding to shopping list:', insertError);
              toast({
                title: "Error adding to shopping list",
                description: insertError.message,
                variant: "destructive",
              });
              return;
            }
          }

          toast({
            title: "Added to shopping list!",
            description: `${item.name} removed from pantry and added to shopping list.`,
          });
        }
      } else {
        toast({
          title: "Item removed",
          description: `${item.name} has been removed from your pantry.`,
        });
      }
      onUpdate();
    }
  };

  const addToCart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('cart_items').insert({
      user_id: user.id,
      pantry_item_id: item.id,
      name: item.name,
      quantity: 1,
      unit: item.unit,
    });

    if (!error) {
      toast({
        title: "Added to shopping list",
        description: `${item.name} added to your shopping list.`,
      });
    }
  };

  return (
    <Card className={`pantry-item-card card-hover ${isExpired ? 'border-destructive' : isExpiringSoon ? 'border-warning expiry-warning' : ''}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-20 h-20 object-cover rounded-lg"
            />
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  <Badge className={`text-xs ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </Badge>
                </div>
                {item.expiry_date && (
                  <p className={`text-sm ${isExpired ? 'text-destructive font-semibold' : isExpiringSoon ? 'text-warning font-semibold' : 'text-muted-foreground'}`}>
                    {isExpired ? '⚠️ Expired' : isExpiringSoon ? `⏰ Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}` : `Expires: ${new Date(item.expiry_date).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFavorite}
                className="shrink-0"
              >
                <Star className={`w-5 h-5 ${item.is_favorite ? 'fill-accent text-accent' : ''}`} />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateQuantity(quantity - 1)}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => updateQuantity(Number(e.target.value))}
                className="w-24 text-center"
                data-tour="edit-quantity"
              />
              <span className="text-sm text-muted-foreground min-w-12">{item.unit}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateQuantity(quantity + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={addToCart}
                className="flex-1"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Shopping List
              </Button>
              <div data-tour="sell-donate">
                {canDonate ? (
                  <DonateItemDialog item={item} onItemDonated={onUpdate} />
                ) : (
                  <SellItemDialog item={item} onItemListed={onUpdate} />
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteItem}
                data-tour="delete-item"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
