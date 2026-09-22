export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          name: string
          pantry_item_id: string | null
          quantity: number
          unit: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          pantry_item_id?: string | null
          quantity: number
          unit: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          pantry_item_id?: string | null
          quantity?: number
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_pantry_item_id_fkey"
            columns: ["pantry_item_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          charity_name: string | null
          created_at: string
          expiry_date: string | null
          id: string
          image_url: string | null
          name: string
          pantry_item_id: string | null
          pickup_date: string | null
          quantity: number
          status: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          charity_name?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          name: string
          pantry_item_id?: string | null
          pickup_date?: string | null
          quantity: number
          status?: string
          unit: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          charity_name?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          name?: string
          pantry_item_id?: string | null
          pickup_date?: string | null
          quantity?: number
          status?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          created_at: string
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          name: string
          original_price: number | null
          pantry_item_id: string | null
          pickup_location: string | null
          pincode: string | null
          quantity: number
          sale_price: number
          status: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          name: string
          original_price?: number | null
          pantry_item_id?: string | null
          pickup_location?: string | null
          pincode?: string | null
          quantity: number
          sale_price: number
          status?: string
          unit: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          name?: string
          original_price?: number | null
          pantry_item_id?: string | null
          pickup_location?: string | null
          pincode?: string | null
          quantity?: number
          sale_price?: number
          status?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_items_pantry_item_id_fkey"
            columns: ["pantry_item_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          delivery_address: string
          delivery_partner: string | null
          delivery_status: string
          id: string
          item_id: string
          item_name: string
          item_price: number
          order_date: string
          payment_id: string | null
          payment_status: string
          pickup_address: string
          seller_id: string
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          delivery_address: string
          delivery_partner?: string | null
          delivery_status?: string
          id?: string
          item_id: string
          item_name: string
          item_price: number
          order_date?: string
          payment_id?: string | null
          payment_status?: string
          pickup_address: string
          seller_id: string
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          delivery_address?: string
          delivery_partner?: string | null
          delivery_status?: string
          id?: string
          item_id?: string
          item_name?: string
          item_price?: number
          order_date?: string
          payment_id?: string | null
          payment_status?: string
          pickup_address?: string
          seller_id?: string
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_items: {
        Row: {
          barcode: string | null
          brand: string | null
          category: Database["public"]["Enums"]["item_category"]
          created_at: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_favorite: boolean | null
          name: string
          quantity: number
          unit: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          name: string
          quantity?: number
          unit: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          name?: string
          quantity?: number
          unit?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string
          created_at: string
          full_name: string
          id: string
          phone: string
          pincode: string
          profile_picture_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          full_name: string
          id?: string
          phone: string
          pincode: string
          profile_picture_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          pincode?: string
          profile_picture_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_type: string
          earned_at: string | null
          id: string
          progress: number | null
          user_id: string
        }
        Insert: {
          achievement_type: string
          earned_at?: string | null
          id?: string
          progress?: number | null
          user_id: string
        }
        Update: {
          achievement_type?: string
          earned_at?: string | null
          id?: string
          progress?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      item_category:
        | "Dairy Products"
        | "Vegetables"
        | "Fruits"
        | "Grains"
        | "Meat & Poultry"
        | "Beverages"
        | "Snacks"
        | "Other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      item_category: [
        "Dairy Products",
        "Vegetables",
        "Fruits",
        "Grains",
        "Meat & Poultry",
        "Beverages",
        "Snacks",
        "Other",
      ],
    },
  },
} as const
