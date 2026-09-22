import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ACHIEVEMENTS, UserAchievement } from '@/types/achievements';
import { toast } from 'sonner';

export const useAchievements = (userId: string | undefined) => {
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    fetchUserAchievements();
  }, [userId]);

  const fetchUserAchievements = async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching achievements:', error);
    } else {
      setUserAchievements(data || []);
    }
    setLoading(false);
  };

  const checkAndAwardAchievements = async () => {
    if (!userId) return;

    for (const achievement of ACHIEVEMENTS) {
      const existing = userAchievements.find(
        (ua) => ua.achievement_type === achievement.id
      );

      const progress = await achievement.checkProgress(userId);

      if (!existing && progress >= achievement.requirement) {
        // Award new achievement
        const { error } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_type: achievement.id,
            progress: progress,
          });

        if (!error) {
          toast.success(`🎉 Achievement Unlocked: ${achievement.title}!`, {
            description: achievement.description,
            duration: 5000,
          });
          fetchUserAchievements();
        }
      } else if (existing && existing.progress !== progress) {
        // Update progress
        await supabase
          .from('user_achievements')
          .update({ progress })
          .eq('id', existing.id);
        
        fetchUserAchievements();
      }
    }
  };

  const getAchievementProgress = async (achievementId: string) => {
    if (!userId) return 0;
    
    const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!achievement) return 0;

    return await achievement.checkProgress(userId);
  };

  return {
    userAchievements,
    loading,
    checkAndAwardAchievements,
    getAchievementProgress,
    refetch: fetchUserAchievements,
  };
};
