import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/AuthForm";
import { PantryItem } from "@/components/PantryItem";
import { AddItemDialog } from "@/components/AddItemDialog";
import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import { ShoppingCart } from "@/components/ShoppingCart";
import { IronChefChat } from "@/components/IronChefChat";
import { Marketplace } from "@/components/Marketplace";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Package, ShoppingCart as CartIcon, Store, Mic, Clock, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAchievements } from "@/hooks/useAchievements";
import { useToast } from "@/hooks/use-toast";
import { ProfileSidebar } from "@/components/ProfileSidebar";
import { OnboardingTour } from "@/components/OnboardingTour";
import ironChefLogo from "@/assets/iron-chef-logo.png";

interface PantryItemType {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  is_favorite: boolean;
  image_url?: string;
  expiry_date?: string;
}
const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [pantryItems, setPantryItems] = useState<PantryItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showTour, setShowTour] = useState(false);
  const {
    toast
  } = useToast();
  const {
    userAchievements,
    checkAndAwardAchievements
  } = useAchievements(session?.user?.id);
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setLoading(false);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadPantryItems = async () => {
    if (!session) return;
    const {
      data,
      error
    } = await supabase.from('pantry_items').select('*').order('created_at', {
      ascending: false
    });
    if (!error && data) {
      setPantryItems(data);

      // Check for expiring items
      const today = new Date();
      data.forEach(item => {
        if (item.expiry_date) {
          const expiry = new Date(item.expiry_date);
          const diffTime = expiry.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            toast({
              title: "⚠️ Expiry Warning",
              description: `${item.name} expires tomorrow!`,
              variant: "destructive"
            });
          }
        }
      });

      // Check for achievements after loading items
      checkAndAwardAchievements();
    }
  };
  useEffect(() => {
    loadPantryItems();
  }, [session]);

  // Check if user needs onboarding (only for new users)
  useEffect(() => {
    if (session?.user?.id) {
      const onboardingKey = `onboarding_completed_${session.user.id}`;
      const hasCompletedOnboarding = localStorage.getItem(onboardingKey);
      
      // Only show tour if user hasn't completed onboarding
      if (!hasCompletedOnboarding) {
        // Check if this is a new user
        const isNewUser = checkIfNewUser(session.user, pantryItems);
        
        if (isNewUser) {
          // Wait a bit for the page to render, then start tour
          const timer = setTimeout(() => {
            setShowTour(true);
          }, 1000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [session, pantryItems]);

  const checkIfNewUser = (user: any, items: PantryItemType[]): boolean => {
    // Check 1: User account created within last 48 hours
    if (user.created_at) {
      const accountCreated = new Date(user.created_at);
      const now = new Date();
      const hoursSinceCreation = (now.getTime() - accountCreated.getTime()) / (1000 * 60 * 60);
      
      // If account is older than 48 hours, they're not a new user
      if (hoursSinceCreation > 48) {
        return false;
      }
    }
    
    // Check 2: User has no pantry items (new users typically haven't added items yet)
    if (items.length > 0) {
      // If they have items, check when the first item was created
      // For now, if they have items, assume they're not completely new
      // But if account is very recent (< 24 hours), still consider them new
      if (user.created_at) {
        const accountCreated = new Date(user.created_at);
        const now = new Date();
        const hoursSinceCreation = (now.getTime() - accountCreated.getTime()) / (1000 * 60 * 60);
        
        // If account is less than 24 hours old, still show tour even if they have items
        return hoursSinceCreation <= 24;
      }
      return false;
    }
    
    // If no items and account is recent, they're a new user
    return true;
  };

  const handleTourComplete = () => {
    if (session?.user?.id) {
      const onboardingKey = `onboarding_completed_${session.user.id}`;
      localStorage.setItem(onboardingKey, "true");
    }
    setShowTour(false);
  };

  const expiringItems = useMemo(() => {
    const today = new Date();
    return pantryItems
      .map((item) => {
        if (!item.expiry_date) return null;
        const expiry = new Date(item.expiry_date);
        const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? { ...item, diffDays } : null;
      })
      .filter((item): item is PantryItemType & { diffDays: number } => !!item && item.diffDays <= 7)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [pantryItems]);

  const favoriteItems = useMemo(
    () => pantryItems.filter((item) => item.is_favorite),
    [pantryItems],
  );
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-2xl text-primary">Loading...</div>
      </div>;
  }
  if (!session) {
    return <AuthForm />;
  }
  return <div className="min-h-screen p-4 md:p-8">
      <OnboardingTour run={showTour} onComplete={handleTourComplete} hasPantryItems={pantryItems.length > 0} />
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Smart Pantry
            </h1>
            <p className="text-muted-foreground mt-1">Manage your groceries intelligently</p>
          </div>
          <ProfileSidebar userId={session.user.id} userEmail={session.user.email || ""} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => expiringItems.length > 0 && setShowExpiringModal(true)}
            id="tour-expiring-summary-card"
            className={`rounded-2xl border bg-card/60 p-4 text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
              expiringItems.length === 0 ? "cursor-default opacity-70" : "cursor-pointer"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Expiring Soon</p>
                <p className="text-3xl font-semibold mt-1">{expiringItems.length}</p>
                <p className="text-sm text-muted-foreground">
                  {expiringItems.length === 0 ? "All good for now" : "Tap to review and act"}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </button>

          <button
            onClick={() => favoriteItems.length > 0 && setShowFavoritesModal(true)}
            className={`rounded-2xl border bg-card/60 p-4 text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${
              favoriteItems.length === 0 ? "cursor-default opacity-70" : "cursor-pointer"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Favorites & Wins</p>
                <p className="text-3xl font-semibold mt-1">{favoriteItems.length}</p>
                <p className="text-sm text-muted-foreground">
                  {favoriteItems.length === 0 ? "No favorites yet" : "Tap to view favourites"}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Star className="h-6 w-6" />
              </div>
            </div>
          </button>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="pantry" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mx-auto max-w-3xl">
            <TabsTrigger value="pantry" className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4" />
              Pantry
            </TabsTrigger>
            <TabsTrigger value="cart" className="flex items-center justify-center gap-2" data-tour="tab-cart">
              <CartIcon className="w-4 h-4" />
              Shopping List
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="flex items-center justify-center gap-2" data-tour="tab-marketplace">
              <Store className="w-4 h-4" />
              Market
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pantry" className="space-y-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold flex-1">Your Pantry Items</h2>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search pantry..."
                  className="max-w-xs"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-green-300" id="tour-voice-assistant">
                      <Mic className="w-4 h-4 mr-2" />
                      Voice Assistant
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <VoiceAssistant />
                  </DialogContent>
                </Dialog>
                <BarcodeScannerDialog onItemAdded={loadPantryItems} />
                <div id="tour-add-item" className="inline-flex">
                  <AddItemDialog onItemAdded={loadPantryItems} />
                </div>
                <Button onClick={() => navigate("/bill-upload")} id="tour-ocr-upload">
                  Upload Bill
                </Button>
              </div>
            </div>

            {pantryItems.length === 0 ? <div className="text-center py-16">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Your pantry is empty</h3>
                <p className="text-muted-foreground mb-6">Start adding items to track your groceries</p>
                <AddItemDialog onItemAdded={loadPantryItems} />
              </div> : <div className="space-y-8">
                {Object.entries(
              pantryItems.reduce((acc, item) => {
                if (!acc[item.category]) {
                  acc[item.category] = [];
                }
                acc[item.category].push(item);
                return acc;
              }, {} as Record<string, PantryItemType[]>)
            ).map(([category, items]) => {
                    const filtered = items.filter((item) =>
                      item.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div key={category} className="space-y-4">
                        <h3 className="text-xl font-semibold text-primary">{category}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filtered.map((item) => (
                            <PantryItem key={item.id} item={item} onUpdate={loadPantryItems} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                {searchTerm &&
                  pantryItems.every((item) =>
                    !item.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
                  ) && <p className="text-muted-foreground">No items match “{searchTerm}”.</p>}
              </div>}
          </TabsContent>

          <TabsContent value="cart">
            <ShoppingCart />
          </TabsContent>

          <TabsContent value="marketplace">
            <Marketplace />
          </TabsContent>
        </Tabs>

        <Dialog open={showExpiringModal} onOpenChange={setShowExpiringModal}>
          <DialogContent className="max-w-3xl">
            <h2 className="text-2xl font-semibold mb-4">Items expiring soon</h2>
            {expiringItems.length === 0 ? (
              <p className="text-muted-foreground">No items expiring in the next week.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {expiringItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center rounded-lg border bg-muted/50 p-3"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.category && (
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        {item.diffDays === 0
                          ? "Expires today"
                          : item.diffDays === 1
                            ? "Expires tomorrow"
                            : `Expires in ${item.diffDays} days`}
                      </p>
                      {item.expiry_date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.expiry_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showFavoritesModal} onOpenChange={setShowFavoritesModal}>
          <DialogContent className="max-w-3xl">
            <h2 className="text-2xl font-semibold mb-4">Favorite items</h2>
            {favoriteItems.length === 0 ? (
              <p className="text-muted-foreground">You haven't marked any favorites yet.</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {favoriteItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center rounded-lg border bg-muted/50 p-3"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.category && (
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Floating Iron Chef Button */}
        <TooltipProvider delayDuration={0}>
          <Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button size="lg" className="fixed bottom-6 left-6 h-16 w-16 rounded-full shadow-lg bg-gradient-to-r from-primary to-primary-glow hover:shadow-2xl hover:scale-110 transition-all duration-300 z-50 group p-0 overflow-hidden" data-tour="ai-chef">
                    <img src={ironChefLogo} alt="Iron Chef" className="w-full h-full object-cover group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-primary text-primary-foreground">
                <p>Chat with Iron Chef AI</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0">
              <IronChefChat pantryItems={pantryItems} expiringItems={expiringItems} />
            </DialogContent>
          </Dialog>
        </TooltipProvider>
      </div>
    </div>;
};
export default Index;