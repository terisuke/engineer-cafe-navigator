/**
 * Expression controller for VRM characters
 * Manages facial expressions based on conversation context
 */

export interface ExpressionData {
  neutral: number;
  happy: number;
  sad: number;
  surprised: number;
  angry: number;
  blink: number;
  blinkLeft: number;
  blinkRight: number;
}

export interface ExpressionFrame {
  time: number;
  expression: Partial<ExpressionData>;
  duration: number;
}

export class ExpressionController {
  private currentExpression: ExpressionData;
  private targetExpression: ExpressionData;
  private animationFrame: number | null = null;
  private isAnimating = false;

  constructor() {
    this.currentExpression = this.getBaseExpression();
    this.targetExpression = this.getBaseExpression();
  }

  private getBaseExpression(): ExpressionData {
    return {
      neutral: 1.0,
      happy: 0.0,
      sad: 0.0,
      surprised: 0.0,
      angry: 0.0,
      blink: 0.0,
      blinkLeft: 0.0,
      blinkRight: 0.0,
    };
  }

  /**
   * Analyze text and determine appropriate expression
   */
  analyzeTextEmotion(text: string): Partial<ExpressionData> {
    const lowerText = text.toLowerCase();
    
    // Simple keyword-based emotion detection
    const happyWords = ['嬉しい', '楽しい', '素晴らしい', 'happy', 'great', 'wonderful', 'excellent', 'amazing', '！', '!'];
    const sadWords = ['悲しい', '残念', '申し訳', 'sad', 'sorry', 'unfortunately', 'disappointed'];
    const surprisedWords = ['驚き', 'びっくり', 'wow', 'amazing', 'incredible', 'really', '？', '?'];
    const angryWords = ['怒り', '腹立つ', 'angry', 'frustrated', 'annoying'];
    
    let happyScore = 0;
    let sadScore = 0;
    let surprisedScore = 0;
    let angryScore = 0;
    
    // Count emotion keywords
    happyWords.forEach(word => {
      if (lowerText.includes(word)) happyScore++;
    });
    sadWords.forEach(word => {
      if (lowerText.includes(word)) sadScore++;
    });
    surprisedWords.forEach(word => {
      if (lowerText.includes(word)) surprisedScore++;
    });
    angryWords.forEach(word => {
      if (lowerText.includes(word)) angryScore++;
    });
    
    // Determine dominant emotion
    const maxScore = Math.max(happyScore, sadScore, surprisedScore, angryScore);
    
    if (maxScore === 0) {
      return { neutral: 1.0 };
    }
    
    const intensity = Math.min(maxScore * 0.3, 0.8); // Cap at 0.8
    
    if (happyScore === maxScore) {
      return { happy: intensity, neutral: 1.0 - intensity };
    } else if (sadScore === maxScore) {
      return { sad: intensity, neutral: 1.0 - intensity };
    } else if (surprisedScore === maxScore) {
      return { surprised: intensity, neutral: 1.0 - intensity };
    } else if (angryScore === maxScore) {
      return { angry: intensity, neutral: 1.0 - intensity };
    }
    
    return { neutral: 1.0 };
  }

  /**
   * Set target expression with smooth transition
   */
  setExpression(expression: Partial<ExpressionData>, duration = 1000) {
    // Update target expression
    this.targetExpression = {
      ...this.getBaseExpression(),
      ...expression
    };
    
    // Start smooth animation
    this.animateToTarget(duration);
  }

  /**
   * Add a temporary expression overlay
   */
  addExpressionOverlay(expression: Partial<ExpressionData>, duration = 2000) {
    const originalTarget = { ...this.targetExpression };
    
    // Apply overlay
    this.setExpression(expression, 500);
    
    // Return to original after duration
    setTimeout(() => {
      this.setExpression(originalTarget, 1000);
    }, duration);
  }

  /**
   * Generate automatic blinking
   */
  startAutoBlink() {
    const blink = () => {
      if (!this.isAnimating) {
        this.addBlinkAnimation();
      }
      
      // Random interval between 2-6 seconds
      const nextBlink = 2000 + Math.random() * 4000;
      setTimeout(blink, nextBlink);
    };
    
    // Start first blink after random delay
    setTimeout(blink, Math.random() * 3000);
  }

  private addBlinkAnimation() {
    const originalBlink = this.currentExpression.blink;
    
    // Quick blink animation
    this.currentExpression.blink = 1.0;
    
    setTimeout(() => {
      this.currentExpression.blink = originalBlink;
    }, 150);
  }

  /**
   * Animate to target expression
   */
  private animateToTarget(duration: number) {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.isAnimating = true;
    const startTime = Date.now();
    const startExpression = { ...this.currentExpression };
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate between start and target
      Object.keys(this.currentExpression).forEach(key => {
        const k = key as keyof ExpressionData;
        this.currentExpression[k] = this.lerp(
          startExpression[k],
          this.targetExpression[k],
          easeProgress
        );
      });
      
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.animationFrame = null;
      }
    };
    
    animate();
  }

  private lerp(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  /**
   * Get current expression values
   */
  getCurrentExpression(): ExpressionData {
    return { ...this.currentExpression };
  }

  /**
   * Generate expression sequence for conversation
   */
  generateExpressionSequence(text: string, duration: number): ExpressionFrame[] {
    const frames: ExpressionFrame[] = [];
    const sentences = text.split(/[.!?。！？]/);
    
    let currentTime = 0;
    const sentenceDuration = duration / sentences.length;
    
    sentences.forEach((sentence, index) => {
      if (sentence.trim().length === 0) return;
      
      const emotion = this.analyzeTextEmotion(sentence);
      
      frames.push({
        time: currentTime,
        expression: emotion,
        duration: sentenceDuration
      });
      
      currentTime += sentenceDuration;
    });
    
    return frames;
  }

  /**
   * Create speaking expression with mouth movement
   */
  createSpeakingExpression(baseEmotion: Partial<ExpressionData> = {}): Partial<ExpressionData> {
    return {
      ...baseEmotion,
      // Slightly more alert expression when speaking
      neutral: (baseEmotion.neutral || 1.0) * 0.9,
    };
  }

  /**
   * Create listening expression
   */
  createListeningExpression(): Partial<ExpressionData> {
    return {
      neutral: 0.8,
      surprised: 0.2, // Slightly attentive
    };
  }

  /**
   * Create thinking expression
   */
  createThinkingExpression(): Partial<ExpressionData> {
    return {
      neutral: 0.7,
      surprised: 0.1,
      // Could add subtle eye movement here
    };
  }

  /**
   * Reset to neutral expression
   */
  resetToNeutral(duration = 1000) {
    this.setExpression(this.getBaseExpression(), duration);
  }

  dispose() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.isAnimating = false;
  }
}