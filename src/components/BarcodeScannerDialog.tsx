import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Scan, Loader2, Keyboard } from "lucide-react";

interface BarcodeScannerDialogProps {
  onItemAdded: () => void;
}

export const BarcodeScannerDialog = ({ onItemAdded }: BarcodeScannerDialogProps) => {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [cameraError, setCameraError] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    category: "Other",
    quantity: 1,
    unit: "pieces",
    expiry_date: "",
    barcode: "",
    image_url: "",
  });
  
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = "barcode-reader";

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);
  const minDateString = minDate.toISOString().split('T')[0];

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setCameraError("");
    setScanning(true);
    
    try {
      // Check if we're in a secure context
      if (!window.isSecureContext) {
        throw new Error("Camera access requires HTTPS. Please use the manual barcode entry instead.");
      }

      // Request camera permissions explicitly
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permError: any) {
        if (permError.name === 'NotAllowedError') {
          throw new Error("Camera permission denied. Please allow camera access in your browser settings and try again.");
        } else if (permError.name === 'NotFoundError') {
          throw new Error("No camera found on this device. Please use manual barcode entry.");
        } else {
          throw new Error("Could not access camera. Please use manual barcode entry instead.");
        }
      }

      const scanner = new Html5Qrcode(readerElementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 20,
          qrbox: { width: 300, height: 150 },
          aspectRatio: 2.0,
          disableFlip: false,
        },
        async (decodedText) => {
          await stopScanner();
          setScanning(false);
          await lookupProduct(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors (they happen frequently during scanning)
        }
      );
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      const errorMsg = error.message || "Could not access camera. Please check permissions or use manual entry.";
      setCameraError(errorMsg);
      toast({
        title: "Camera Error",
        description: errorMsg,
        variant: "destructive",
      });
      setScanning(false);
    }
  };

  const handleManualLookup = async () => {
    if (!manualBarcode.trim()) {
      toast({
        title: "Invalid Barcode",
        description: "Please enter a barcode number",
        variant: "destructive",
      });
      return;
    }
    await lookupProduct(manualBarcode.trim());
    setManualBarcode("");
  };

  const lookupProduct = async (barcode: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-product', {
        body: { barcode }
      });

      if (error) throw error;

      if (data.found) {
        setScannedData(data);
        setFormData({
          name: data.name,
          brand: data.brand || "",
          category: mapCategory(data.category),
          quantity: 1,
          unit: "pieces",
          expiry_date: "",
          barcode: data.barcode,
          image_url: data.image_url || "",
        });
        toast({
          title: "Product Found!",
          description: `Found: ${data.name}`,
        });
      } else {
        setFormData({
          ...formData,
          barcode: barcode,
        });
        toast({
          title: "Product Not Found",
          description: "Please enter the product details manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error looking up product:", error);
      toast({
        title: "Lookup Failed",
        description: "Could not find product information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const mapCategory = (apiCategory: string): string => {
    const categoryMap: Record<string, string> = {
      'dairy': 'Dairy Products',
      'beverages': 'Beverages',
      'snacks': 'Snacks',
      'meat': 'Meat',
      'vegetables': 'Vegetables',
      'fruits': 'Fruits',
      'grains': 'Grains',
      'condiments': 'Condiments',
    };

    const normalized = apiCategory.toLowerCase();
    for (const [key, value] of Object.entries(categoryMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }
    return 'Other';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.expiry_date) {
      const expiryDate = new Date(formData.expiry_date);
      if (expiryDate < minDate) {
        toast({
          title: "Invalid expiry date",
          description: "Expiry date must be at least 7 days from now",
          variant: "destructive",
        });
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add items",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from('pantry_items').insert([{
      user_id: user.id,
      name: formData.name,
      category: formData.category as any,
      quantity: formData.quantity,
      unit: formData.unit,
      expiry_date: formData.expiry_date || null,
      barcode: formData.barcode || null,
      brand: formData.brand || null,
      image_url: formData.image_url || null,
    }]);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add item to pantry",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success!",
      description: `${formData.name} added to your pantry`,
    });

    setFormData({
      name: "",
      brand: "",
      category: "Other",
      quantity: 1,
      unit: "pieces",
      expiry_date: "",
      barcode: "",
      image_url: "",
    });
    setScannedData(null);
    setOpen(false);
    onItemAdded();
  };

  const handleClose = async () => {
    await stopScanner();
    setScanning(false);
    setScannedData(null);
    setCameraError("");
    setManualBarcode("");
    setFormData({
      name: "",
      brand: "",
      category: "Other",
      quantity: 1,
      unit: "pieces",
      expiry_date: "",
      barcode: "",
      image_url: "",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      } else {
        setOpen(true);
      }
    }}>
      <DialogTrigger asChild>
        <Button>
          <Scan className="w-4 h-4 mr-2" />
          Scan Barcode
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera">
                <Scan className="w-4 h-4 mr-2" />
                Camera Scan
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Keyboard className="w-4 h-4 mr-2" />
                Manual Entry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="space-y-4">
              {!scanning && !scannedData && !formData.barcode && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Scan className="w-16 h-16 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    Position a barcode in front of your camera
                  </p>
                  {cameraError && (
                    <div className="text-sm text-destructive text-center p-4 bg-destructive/10 rounded-md">
                      {cameraError}
                    </div>
                  )}
                  <Button onClick={startScanner} size="lg">
                    Start Camera Scanner
                  </Button>
                  <p className="text-xs text-muted-foreground text-center max-w-xs">
                    Note: Camera access requires HTTPS. If it doesn't work, use the Manual Entry tab.
                  </p>
                </div>
              )}

              {scanning && (
                <div className="space-y-4">
                  <div id={readerElementId} className="w-full"></div>
                  <Button onClick={async () => {
                    await stopScanner();
                    setScanning(false);
                    setCameraError("");
                  }} variant="outline" className="w-full">
                    Cancel Scanning
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-8">
                <Keyboard className="w-16 h-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Enter the barcode number manually
                </p>
                <div className="w-full space-y-4">
                  <Input
                    placeholder="Enter barcode number"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualLookup();
                      }
                    }}
                  />
                  <Button onClick={handleManualLookup} className="w-full" disabled={!manualBarcode.trim()}>
                    Look Up Product
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p>Looking up product...</p>
            </div>
          )}

          {(scannedData || formData.barcode) && !scanning && !loading && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formData.image_url && (
                <img src={formData.image_url} alt={formData.name} className="w-full h-40 object-contain rounded-lg" />
              )}

              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dairy Products">Dairy Products</SelectItem>
                    <SelectItem value="Vegetables">Vegetables</SelectItem>
                    <SelectItem value="Fruits">Fruits</SelectItem>
                    <SelectItem value="Meat">Meat</SelectItem>
                    <SelectItem value="Grains">Grains</SelectItem>
                    <SelectItem value="Beverages">Beverages</SelectItem>
                    <SelectItem value="Snacks">Snacks</SelectItem>
                    <SelectItem value="Condiments">Condiments</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="kg">Kilograms</SelectItem>
                      <SelectItem value="g">Grams</SelectItem>
                      <SelectItem value="L">Liters</SelectItem>
                      <SelectItem value="ml">Milliliters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  min={minDateString}
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Add to Pantry</Button>
                <Button type="button" variant="outline" onClick={() => {
                  setScannedData(null);
                  setCameraError("");
                  setManualBarcode("");
                  setFormData({
                    name: "",
                    brand: "",
                    category: "Other",
                    quantity: 1,
                    unit: "pieces",
                    expiry_date: "",
                    barcode: "",
                    image_url: "",
                  });
                }}>
                  Scan Again
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
