import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAchievements } from "@/hooks/useAchievements";

interface DonateItemDialogProps {
  item: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
    expiry_date?: string;
    image_url?: string;
  };
  onItemDonated: () => void;
}

export const DonateItemDialog = ({ item, onItemDonated }: DonateItemDialogProps) => {
  const [open, setOpen] = useState(false);
  const [charityName, setCharityName] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | undefined>();
  const { checkAndAwardAchievements } = useAchievements(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('donations').insert({
      user_id: user.id,
      pantry_item_id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expiry_date: item.expiry_date || null,
      image_url: item.image_url || null,
      charity_name: charityName || null,
      pickup_date: pickupDate || null,
      status: 'pending',
    } as any);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Remove from pantry
    await supabase.from('pantry_items').delete().eq('id', item.id);

    toast({
      title: "Thank you for donating!",
      description: `${item.name} has been added to your donations.`,
    });

    // Check for achievements
    await checkAndAwardAchievements();

    setCharityName("");
    setPickupDate("");
    setOpen(false);
    setLoading(false);
    onItemDonated();
  };

  const getDaysUntilExpiry = () => {
    if (!item.expiry_date) return null;
    const expiry = new Date(item.expiry_date);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilExpiry = getDaysUntilExpiry();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Heart className="w-4 h-4" />
          Donate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Donate to Charity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">{item.name}</span>
              <span className="text-sm text-muted-foreground">{item.category}</span>
            </div>
            <div className="text-sm">
              <span>Quantity: {item.quantity} {item.unit}</span>
            </div>
            {daysUntilExpiry !== null && (
              <div className={`text-sm font-medium ${daysUntilExpiry < 3 ? 'text-destructive' : 'text-orange-500'}`}>
                {daysUntilExpiry > 0 
                  ? `Expires in ${daysUntilExpiry} days`
                  : 'Expired'}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="charityName">Charity Organization (optional)</Label>
            <Select value={charityName} onValueChange={setCharityName}>
              <SelectTrigger>
                <SelectValue placeholder="Select a charity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Local Food Bank">Local Food Bank</SelectItem>
                <SelectItem value="Community Kitchen">Community Kitchen</SelectItem>
                <SelectItem value="Homeless Shelter">Homeless Shelter</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickupDate">Preferred Pickup Date (optional)</Label>
            <Input
              id="pickupDate"
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="bg-primary/10 p-3 rounded-lg text-sm">
            <p className="font-medium text-primary">Impact:</p>
            <p className="text-muted-foreground mt-1">
              Your donation will help feed those in need and reduce food waste.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processing..." : "Confirm Donation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
