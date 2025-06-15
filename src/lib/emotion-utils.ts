/**
 * Shared emotion utility functions for memory systems
 */

/**
 * Find the most frequently occurring emotion from an array of emotions
 */
export function getMostFrequentEmotion(emotions: string[]): string | null {
  if (emotions.length === 0) return null;

  const emotionCount: Record<string, number> = {};
  for (const emotion of emotions) {
    emotionCount[emotion] = (emotionCount[emotion] || 0) + 1;
  }

  let maxCount = 0;
  let dominantEmotion: string | null = null;
  
  for (const [emotion, count] of Object.entries(emotionCount)) {
    if (count > maxCount) {
      maxCount = count;
      dominantEmotion = emotion;
    }
  }

  return dominantEmotion;
}

/**
 * Calculate emotion statistics from an array of emotions
 */
export function getEmotionStats(emotions: string[]): {
  dominantEmotion: string | null;
  emotionCounts: Record<string, number>;
  totalEmotions: number;
} {
  const emotionCounts: Record<string, number> = {};
  
  for (const emotion of emotions) {
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
  }

  const dominantEmotion = getMostFrequentEmotion(emotions);

  return {
    dominantEmotion,
    emotionCounts,
    totalEmotions: emotions.length,
  };
}