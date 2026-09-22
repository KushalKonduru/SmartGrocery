import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAchievements } from "@/hooks/useAchievements";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  User,
  Package,
  DollarSign,
  Trophy,
  LogOut,
  Settings,
  Upload,
  Eye,
  BarChart3,
  PieChart,
} from "lucide-react";

interface ProfileSidebarProps {
  userId: string;
  userEmail: string;
}

export const ProfileSidebar = ({ userId, userEmail }: ProfileSidebarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading, refetch } = useProfile();
  const { userAchievements } = useAchievements(userId);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    address: "",
    pincode: "",
  });

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        address: profile.address || "",
        pincode: profile.pincode || "",
      });
    }
  }, [profile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    toast({
      title: "Signed out",
      description: "See you next time!",
    });
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: userId,
            profile_picture_url: publicUrl,
            full_name: profile?.full_name || "",
            phone: profile?.phone || "",
            address: profile?.address || "",
            pincode: profile?.pincode || "",
          },
          { onConflict: 'user_id' }
        );

      if (updateError) throw updateError;

      await refetch();
      toast({
        title: "Success!",
        description: "Profile picture updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: userId,
            ...formData,
            profile_picture_url: profile?.profile_picture_url,
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      await refetch();
      setEditMode(false);
      toast({
        title: "Success!",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
    return userEmail[0].toUpperCase();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10 hover:scale-110 transition-transform"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.profile_picture_url} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="profile" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Package className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-4 py-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.profile_picture_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Label htmlFor="picture-upload" className="cursor-pointer">
                  <Button size="sm" disabled={uploading} asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </span>
                  </Button>
                </Label>
                <Input
                  id="picture-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePictureUpload}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleNavigation("/profile")}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Profile
                </Button>
              </div>
            </div>

            <Separator />

            {/* Profile Details */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Personal Details</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (editMode) {
                      handleSaveProfile();
                    } else {
                      setEditMode(true);
                    }
                  }}
                >
                  {editMode ? "Save" : "Edit"}
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Email</Label>
                  <Input value={userEmail} disabled />
                </div>
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={formData.full_name}
                    disabled={!editMode}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    disabled={!editMode}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    disabled={!editMode}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input
                    value={formData.pincode}
                    disabled={!editMode}
                    onChange={(e) =>
                      setFormData({ ...formData, pincode: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleNavigation("/my-orders")}
            >
              <Package className="w-4 h-4 mr-2" />
              My Orders
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleNavigation("/my-sales")}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              My Sales
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start relative"
              onClick={() => handleNavigation("/achievements")}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Achievements
              {userAchievements.length > 0 && (
                <span className="absolute right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {userAchievements.length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleNavigation("/expenditure")}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Expenditure Tracking
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleNavigation("/analytics/consumption")}
            >
              <PieChart className="w-4 h-4 mr-2" />
              Consumption Analysis
            </Button>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Appearance</Label>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">Account</Label>
              <div className="space-y-2 mt-3">
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
