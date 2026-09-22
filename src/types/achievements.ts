export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  requirement: number;
  checkProgress: (userId: string) => Promise<number>;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: string;
  earned_at: string;
  progress: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'zero_waste_hero',
    title: 'Zero Waste Hero',
    description: 'Keep 20+ items in your pantry without letting any expire',
    icon: '🥗',
    color: 'hsl(var(--chart-1))',
    requirement: 20,
    checkProgress: async (userId: string) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { count } = await supabase
        .from('pantry_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('expiry_date', new Date().toISOString());
      return count || 0;
    },
  },
  {
    id: 'smart_organizer',
    title: 'Smart Organizer',
    description: 'Add 15+ items to your pantry',
    icon: '📦',
    color: 'hsl(var(--chart-2))',
    requirement: 15,
    checkProgress: async (userId: string) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { count } = await supabase
        .from('pantry_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count || 0;
    },
  },
  {
    id: 'cart_master',
    title: 'Shopping List Master',
    description: 'Add 10+ categorized items to your shopping list',
    icon: '🛒',
    color: 'hsl(var(--chart-3))',
    requirement: 10,
    checkProgress: async (userId: string) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { count } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count || 0;
    },
  },
  {
    id: 'marketplace_pro',
    title: 'Marketplace Pro',
    description: 'List 5 items on the marketplace',
    icon: '💰',
    color: 'hsl(var(--chart-4))',
    requirement: 5,
    checkProgress: async (userId: string) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { count } = await supabase
        .from('marketplace_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count || 0;
    },
  },
  {
    id: 'favorite_keeper',
    title: 'Favorite Keeper',
    description: 'Mark 5 items as favorites',
    icon: '⭐',
    color: 'hsl(var(--chart-5))',
    requirement: 5,
    checkProgress: async (userId: string) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { count } = await supabase
        .from('pantry_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_favorite', true);
      return count || 0;
    },
  },
  {
    id: 'eco_contributor',
    title: 'Eco Contributor',
    description: 'Make 3 donations to help the community',
    icon: '♻️',
    color: 'hsl(var(--accent))',
    requirement: 3,
    checkProgress: async (userId: string) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { count } = await supabase
        .from('donations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count || 0;
    },
  },
];
