import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import Tesseract from "tesseract.js";
import { ArrowLeft } from "lucide-react";

type PantryCategory =
  | "Dairy Products"
  | "Vegetables"
  | "Fruits"
  | "Grains"
  | "Meat & Poultry"
  | "Beverages"
  | "Snacks"
  | "Other";

interface ParsedItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  category: PantryCategory;
}

interface PantryInsertPayload {
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  expiry_date: string | null;
}

interface ExpenditureInsertPayload {
  user_id: string;
  category: PantryCategory;
  amount: number;
  transaction_type: string;
  item_name: string;
  quantity: number;
  unit: string;
  description: string;
  order_id: string | null;
  marketplace_item_id: string | null;
  transaction_date: string;
}

const CATEGORY_KEYWORDS: Record<PantryCategory, string[]> = {
  "Dairy Products": ["milk", "curd", "cheese", "butter", "paneer", "ghee", "yogurt"],
  Vegetables: ["tomato", "onion", "potato", "carrot", "spinach", "cabbage"],
  Fruits: ["apple", "banana", "mango", "orange", "grape", "watermelon"],
  Grains: ["rice", "wheat", "atta", "flour", "dal", "lentil"],
  "Meat & Poultry": ["chicken", "mutton", "egg", "fish"],
  Beverages: ["tea", "coffee", "juice", "soda", "cola"],
  Snacks: ["chips", "biscuit", "cookie", "namkeen", "chocolate"],
  Other: [],
};

const UNIT_OPTIONS = [
  { label: "Kilograms (kg)", value: "kg" },
  { label: "Grams (g)", value: "g" },
  { label: "Liters (L)", value: "L" },
  { label: "Milliliters (mL)", value: "mL" },
  { label: "Pieces", value: "pieces" },
];

const detectCategory = (name: string): PantryCategory => {
  const lower = name.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return cat as PantryCategory;
  }
  return "Other";
};

const parseLine = (line: string): ParsedItem | null => {
  const clean = line.trim();
  if (!clean) return null;

  const priceMatch = clean.match(/(\d+(\.\d{1,2})?)\s*$/);
  if (!priceMatch) return null;

  const price = parseFloat(priceMatch[1]);
  const beforePrice = clean.slice(0, priceMatch.index).trim();

  const parts = beforePrice.split(/\s+/);
  if (parts.length === 0) return null;

  let quantity: number | null = null;
  let unit: string | null = null;
  const nameParts: string[] = [];

  for (const p of parts) {
    if (/^\d+(\.\d+)?$/.test(p) && quantity === null) {
      quantity = parseFloat(p);
    } else if (quantity !== null && !unit) {
      unit = p;
    } else {
      nameParts.push(p);
    }
  }

  const name = nameParts.join(" ") || beforePrice;
  const category = detectCategory(name);

  return { name, quantity, unit, price, category };
};

export default function BillUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<(ParsedItem & { expiry_date?: string })[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUploadAndParse = async () => {
    if (!file) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", variant: "destructive" });
        return;
      }

      setParsing(true);
      const result = await Tesseract.recognize(file, "eng");
      const text = result.data.text || "";

      const lines = text.split(/\r?\n/);
      const parsed: ParsedItem[] = [];

      for (const line of lines) {
        const item = parseLine(line);
        if (item && item.name && item.price !== null) {
          parsed.push(item);
        }
      }

      if (parsed.length === 0) {
        toast({ title: "No items detected", description: "Check bill clarity or fill manually." });
      } else {
        toast({ title: "OCR complete", description: `Detected ${parsed.length} items` });
      }

      setItems(parsed.map((i) => ({ ...i, expiry_date: "" })));
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error processing bill",
        description: err.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const handleExpiryChange = (index: number, value: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, expiry_date: value } : it))
    );
  };

  const handleUnitChange = (index: number, value: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, unit: value } : it))
    );
  };

  const handleQuantityChange = (index: number, value: string) => {
    const num = value === "" ? null : Number(value);
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity: isNaN(num as number) ? null : (num as number) } : it))
    );
  };

  const handleCategoryChange = (index: number, value: PantryCategory) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, category: value } : it))
    );
  };

  const handleConfirm = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", variant: "destructive" });
        return;
      }

      const pantryInserts: PantryInsertPayload[] = items.map((it) => ({
        user_id: user.id,
        name: it.name,
        quantity: it.quantity ?? 1,
        unit: it.unit ?? "pieces",
        category: it.category as any,
        expiry_date: it.expiry_date || null,
      }));

      const expenditureInserts: ExpenditureInsertPayload[] = items.map((it) => ({
        user_id: user.id,
        category: it.category as any,
        amount: it.price ?? 0,
        transaction_type: "purchase",
        item_name: it.name,
        quantity: it.quantity ?? 1,
        unit: it.unit ?? "pcs",
        description: "Bill upload import",
        order_id: null,
        marketplace_item_id: null,
        transaction_date: format(new Date(), "yyyy-MM-dd"),
      }));

      const { error: pantryError } = await supabase
        .from("pantry_items")
        .insert(pantryInserts);
      if (pantryError) throw pantryError;

      const { error: expError } = await supabase
        .from("expenditures" as any)
        .insert(expenditureInserts as any);
      if (expError) throw expError;

      toast({ title: "Items added", description: "Pantry and expenses updated." });
      setItems([]);
      setFile(null);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error saving items",
        description: err.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">Upload Grocery Bill</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bill File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
          <Button
            onClick={handleUploadAndParse}
            disabled={!file || uploading || parsing}
          >
            {uploading || parsing ? "Processing..." : "Upload & Extract Items"}
          </Button>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Items (add expiry dates)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-muted-foreground">
              <div>Name</div>
              <div>Qty</div>
              <div>Unit</div>
              <div>Category</div>
              <div>Expiry Date</div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-5 gap-2 items-center text-sm"
                >
                  <div>{item.name}</div>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity ?? ""}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      className="border rounded px-2 py-1 bg-background"
                      value={item.unit ?? ""}
                      onChange={(e) => handleUnitChange(idx, e.target.value)}
                    >
                      <option value="">Select unit</option>
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      className="border rounded px-2 py-1 bg-background"
                      value={item.category}
                      onChange={(e) => handleCategoryChange(idx, e.target.value as PantryCategory)}
                    >
                      <option value="Dairy Products">Dairy Products</option>
                      <option value="Vegetables">Vegetables</option>
                      <option value="Fruits">Fruits</option>
                      <option value="Grains">Grains</option>
                      <option value="Meat & Poultry">Meat & Poultry</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={item.expiry_date || ""}
                      onChange={(e) => handleExpiryChange(idx, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleConfirm} className="mt-4">
              Confirm & Add to Pantry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
