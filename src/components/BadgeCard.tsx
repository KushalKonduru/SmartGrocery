import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Achievement, UserAchievement } from '@/types/achievements';
import { CheckCircle2, Lock } from 'lucide-react';

interface BadgeCardProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  currentProgress?: number;
}

export const BadgeCard = ({ achievement, userAchievement, currentProgress = 0 }: BadgeCardProps) => {
  const isUnlocked = !!userAchievement;
  const progress = isUnlocked ? 100 : (currentProgress / achievement.requirement) * 100;

  return (
    <Card className={`relative overflow-hidden transition-all ${isUnlocked ? 'border-primary shadow-lg' : 'opacity-70'}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="text-4xl p-3 rounded-full"
              style={{ backgroundColor: `${achievement.color}15` }}
            >
              {achievement.icon}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {achievement.title}
                {isUnlocked && <CheckCircle2 className="h-5 w-5 text-primary" />}
                {!isUnlocked && <Lock className="h-5 w-5 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>{achievement.description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {isUnlocked ? achievement.requirement : currentProgress} / {achievement.requirement}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {isUnlocked && (
            <Badge variant="default" className="mt-2">
              Unlocked {new Date(userAchievement.earned_at).toLocaleDateString()}
            </Badge>
          )}
          {!isUnlocked && progress > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {achievement.requirement - currentProgress} more to unlock!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
