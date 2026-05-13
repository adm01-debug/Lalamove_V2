import { useCallback, useRef } from 'react';
import { useApprovalActions as useBaseApprovalActions } from './usePendingApprovals';
import { useAchievementsSystem } from './useAchievementsSystem';
import { DriverApproval } from '@/types';

/**
 * Enhanced approval actions with achievements integration
 * Wraps the base approval mutations to trigger confetti and unlock achievements
 */
export function useApprovalActionsWithAchievements() {
  const baseActions = useBaseApprovalActions();
  const achievementsContext = useAchievementsContext();
  const actionStartTimeRef = useRef<number>(0);

  // Track when approval action starts
  const trackActionStart = useCallback(() => {
    actionStartTimeRef.current = Date.now();
  }, []);

  // Enhanced approve with achievements
  const approveWithCelebration = useCallback(async (approval: DriverApproval) => {
    trackActionStart();
    
    // Execute the base mutation
    baseActions.approveMutation.mutate(
      { approvalId: approval.id, driverId: approval.driverId },
      {
        onSuccess: () => {
          if (achievementsContext) {
            // Check for first approval
            if (!achievementsContext.hasAchievement('first_approval')) {
              achievementsContext.unlockAchievement('first_approval');
            }
            
            // Check for speed demon (under 5 seconds)
            const elapsed = Date.now() - actionStartTimeRef.current;
            if (elapsed < 5000 && !achievementsContext.hasAchievement('speed_demon')) {
              achievementsContext.unlockAchievement('speed_demon');
            }
            
            // Check time-based achievements
            const hour = new Date().getHours();
            if (hour < 7 && !achievementsContext.hasAchievement('early_bird')) {
              achievementsContext.unlockAchievement('early_bird');
            }
            if (hour >= 22 && !achievementsContext.hasAchievement('night_owl')) {
              achievementsContext.unlockAchievement('night_owl');
            }
            
            // Increment streak and trigger confetti
            achievementsContext.incrementStreak();
            achievementsContext.triggerConfetti();
          }
        }
      }
    );
  }, [baseActions, achievementsContext, trackActionStart]);

  // Enhanced reject with achievements
  const rejectWithTracking = useCallback(async (approval: DriverApproval) => {
    baseActions.rejectMutation.mutate(
      { approvalId: approval.id, driverId: approval.driverId },
      {
        onSuccess: () => {
          if (achievementsContext) {
            // Reset streak on rejection
            achievementsContext.resetStreak();
            
            // Check for risk master (correctly rejected high risk)
            if (approval.riskScore >= 7 && !achievementsContext.hasAchievement('risk_master')) {
              achievementsContext.unlockAchievement('risk_master');
            }
          }
        }
      }
    );
  }, [baseActions, achievementsContext]);

  return {
    ...baseActions,
    approveWithCelebration,
    rejectWithTracking,
  };
}

// Safe context access (won't throw if outside provider)
function useAchievementsContext() {
  try {
    return useAchievementsSystem();
  } catch {
    // Return null if not inside provider (for backwards compatibility)
    return null;
  }
}

// Re-export for convenience
export { useAchievementsSystem };
