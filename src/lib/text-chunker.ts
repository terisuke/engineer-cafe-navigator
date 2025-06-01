/**
 * Text chunking utility for streaming TTS
 * Splits text into natural sentence breaks for smoother voice output
 */

export interface TextChunk {
  text: string;
  index: number;
  isLast: boolean;
  emotion?: string;
}

export class TextChunker {
  // Japanese sentence endings
  private static readonly JP_SENTENCE_ENDINGS = ['。', '！', '？', '…', '♪', '～', '\n'];
  private static readonly JP_CLAUSE_ENDINGS = ['、', 'ね', 'よ', 'から', 'けど', 'が', 'で', 'し'];
  
  // English sentence endings
  private static readonly EN_SENTENCE_ENDINGS = ['.', '!', '?', '...', '\n'];
  private static readonly EN_CLAUSE_ENDINGS = [',', ';', ':', ' and ', ' but ', ' so '];
  
  // Maximum chunk size (characters)
  private static readonly MAX_CHUNK_SIZE = 100;
  private static readonly MIN_CHUNK_SIZE = 20;

  /**
   * Split text into chunks suitable for streaming TTS
   */
  static chunkText(text: string, language: 'ja' | 'en' = 'ja'): TextChunk[] {
    // Remove emotion tags first but remember their positions
    const emotionPattern = /\[(happy|sad|angry|surprised|neutral|relaxed|excited|gentle|supportive|confused|apologetic|curious|thoughtful|warm|grateful|knowledgeable|analytical|energetic|confident)\]/g;
    const emotions: { originalPosition: number; cleanPosition: number; emotion: string }[] = [];

    // 感情タグを見つけて、クリーンテキストでの位置を計算
    let cleanOffset = 0;
    let match;
    const matches = [];
    while ((match = emotionPattern.exec(text)) !== null) {
      matches.push(match);
    }

    for (const match of matches) {
      const matchIndex = match.index;
      if (matchIndex !== undefined) {
        emotions.push({
          originalPosition: matchIndex,
          cleanPosition: matchIndex - cleanOffset,
          emotion: match[1]
        });
        cleanOffset += match[0].length;
      }
    }
    
    // Clean text for chunking
    const cleanText = text.replace(emotionPattern, '');
    
    const chunks: TextChunk[] = [];
    const sentenceEndings = language === 'ja' ? this.JP_SENTENCE_ENDINGS : this.EN_SENTENCE_ENDINGS;
    const clauseEndings = language === 'ja' ? this.JP_CLAUSE_ENDINGS : this.EN_CLAUSE_ENDINGS;
    
    let currentChunk = '';
    let chunkStart = 0;
    let currentEmotion: string | undefined;
    let emotionIdx = 0;
    // emotions配列はcleanPosition順に並んでいる前提
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      currentChunk += char;
      // 2ポインタ法で感情タグを反映
      while (emotionIdx < emotions.length && emotions[emotionIdx].cleanPosition === i) {
        currentEmotion = emotions[emotionIdx].emotion;
        emotionIdx++;
      }
      
      // Check if we should split here
      let shouldSplit = false;
      let splitPriority = 0;
      
      // Priority 1: Sentence endings
      if (sentenceEndings.some(ending => cleanText.slice(i - ending.length + 1, i + 1) === ending)) {
        shouldSplit = true;
        splitPriority = 3;
      }
      // Priority 2: Clause endings (if chunk is getting long)
      else if (currentChunk.length > this.MIN_CHUNK_SIZE) {
        for (const ending of clauseEndings) {
          if (language === 'ja' && cleanText.slice(i - ending.length + 1, i + 1) === ending) {
            shouldSplit = true;
            splitPriority = 2;
            break;
          } else if (language === 'en' && cleanText.slice(i - ending.length + 1, i + 1) === ending) {
            shouldSplit = true;
            splitPriority = 2;
            break;
          }
        }
      }
      // Priority 3: Force split if too long
      else if (currentChunk.length >= this.MAX_CHUNK_SIZE) {
        shouldSplit = true;
        splitPriority = 1;
        
        // Try to find a word boundary for English
        if (language === 'en') {
          const lastSpace = currentChunk.lastIndexOf(' ');
          if (lastSpace > this.MIN_CHUNK_SIZE) {
            // チャンクを単語境界で分割
            const splitChunk = currentChunk.slice(0, lastSpace);
            chunks.push({
              text: splitChunk.trim(),
              index: chunks.length,
              isLast: false,
              emotion: currentEmotion
            });
            
            // 残りの部分から続行
            currentChunk = currentChunk.slice(lastSpace + 1);
            chunkStart = chunkStart + lastSpace + 1;
            shouldSplit = false; // 既に分割したのでスキップ
          }
        }
      }
      
      // Split if needed
      if (shouldSplit && currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length,
          isLast: false,
          emotion: currentEmotion
        });
        currentChunk = '';
        chunkStart = i + 1;
        
        // Add a small pause after high-priority splits
        if (splitPriority >= 2 && i < cleanText.length - 1) {
          // Natural pause after sentences
        }
      }
    }
    
    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunks.length,
        isLast: true,
        emotion: currentEmotion
      });
    }
    
    // Mark the last chunk
    if (chunks.length > 0) {
      chunks[chunks.length - 1].isLast = true;
    }
    
    return chunks;
  }

  /**
   * Estimate speaking duration for a chunk (rough approximation)
   */
  static estimateDuration(text: string, language: 'ja' | 'en' = 'ja'): number {
    // Rough estimates: 
    // Japanese: ~6 characters per second
    // English: ~15 characters per second (including spaces)
    const charsPerSecond = language === 'ja' ? 6 : 15;
    return (text.length / charsPerSecond) * 1000; // Return in milliseconds
  }

  /**
   * Check if text needs chunking
   */
  static needsChunking(text: string, threshold: number = 50): boolean {
    return text.length > threshold;
  }
}