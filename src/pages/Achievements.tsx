import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAchievements } from '@/hooks/useAchievements';
import { ACHIEVEMENTS } from '@/types/achievements';
import { BadgeCard } from '@/components/BadgeCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Achievements = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const { userAchievements, loading, checkAndAwardAchievements, getAchievementProgress } = useAchievements(user?.id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/auth');
      } else {
        setUser(user);
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user, userAchievements]);

  const loadProgress = async () => {
    const progress: Record<string, number> = {};
    for (const achievement of ACHIEVEMENTS) {
      progress[achievement.id] = await getAchievementProgress(achievement.id);
    }
    setProgressData(progress);
  };

  const handleRefresh = async () => {
    toast.info('Checking for new achievements...');
    await checkAndAwardAchievements();
    await loadProgress();
  };

  const unlockedCount = userAchievements.length;
  const totalCount = ACHIEVEMENTS.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                Achievements
              </h1>
              <p className="text-muted-foreground mt-1">
                Unlocked {unlockedCount} of {totalCount} badges
              </p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ACHIEVEMENTS.map((achievement) => {
            const userAchievement = userAchievements.find(
              (ua) => ua.achievement_type === achievement.id
            );
            return (
              <BadgeCard
                key={achievement.id}
                achievement={achievement}
                userAchievement={userAchievement}
                currentProgress={progressData[achievement.id] || 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Achievements;
