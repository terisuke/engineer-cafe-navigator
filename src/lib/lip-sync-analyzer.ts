/**
 * Lip-sync analyzer for VRM characters
 * Analyzes audio data to generate mouth shape animations
 * Now with intelligent caching for faster repeated analysis
 */

import { lipSyncCache } from './lip-sync-cache';

export interface LipSyncFrame {
  time: number;
  volume: number;
  mouthOpen: number;  // 0-1
  mouthShape: 'A' | 'I' | 'U' | 'E' | 'O' | 'Closed';
}

export interface LipSyncData {
  frames: LipSyncFrame[];
  duration: number;
}

export class LipSyncAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isInitialized = false;

  constructor() {
    // Don't initialize AudioContext immediately - wait for user interaction
  }

  private async initializeAudioContext(): Promise<void> {
    if (this.isInitialized && this.audioContext && this.audioContext.state !== 'closed') {
      return;
    }

    // Check if we're in a server environment
    if (typeof window === 'undefined') {
      throw new Error('AudioContext not available in server environment');
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume suspended AudioContext
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.isInitialized = true;
      
    } catch (error) {
      console.error('[LipSyncAnalyzer] Failed to initialize AudioContext:', error);
      throw new Error(`AudioContext initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze audio blob and generate lip-sync data with intelligent caching and timeout protection
   */
  async analyzeLipSync(audioBlob: Blob, timeoutMs: number = 10000): Promise<LipSyncData> {
    // Inner async function to handle the actual analysis
    const performAnalysis = async (): Promise<LipSyncData> => {
      // Check cache first
      const cachedResult = await lipSyncCache.instance.getCachedLipSync(audioBlob);
      
      if (cachedResult) {
        return cachedResult;
      }

      // Initialize AudioContext if needed
      await this.initializeAudioContext();
      
      if (!this.audioContext) {
        throw new Error('AudioContext is not available');
      }
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;
      
      // Optimize frame interval based on audio duration
      const frameInterval = duration > 10 ? 0.1 : 0.05; // Use larger intervals for long audio
      const frameCount = Math.floor(duration / frameInterval);
      const frames: LipSyncFrame[] = [];

      // Process frames in batches to prevent blocking
      const batchSize = 10;
      for (let batchStart = 0; batchStart < frameCount; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, frameCount);
        
        // Process batch
        for (let i = batchStart; i < batchEnd; i++) {
          const startSample = Math.floor(i * frameInterval * sampleRate);
          const endSample = Math.floor((i + 1) * frameInterval * sampleRate);
          
          // Calculate RMS volume for this frame (optimized)
          let sum = 0;
          const sampleCount = Math.min(endSample - startSample, 1024); // Limit samples for performance
          const step = Math.max(1, Math.floor((endSample - startSample) / sampleCount));
          
          for (let j = startSample; j < endSample && j < channelData.length; j += step) {
            sum += channelData[j] * channelData[j];
          }
          const rms = Math.sqrt(sum / sampleCount);
          
          // Simplified mouth shape determination for performance
          const mouthShape = this.determineMouthShapeSimplified(rms, channelData, startSample, endSample);
          
          frames.push({
            time: i * frameInterval,
            volume: Math.min(rms * 10, 1),
            mouthOpen: Math.min(rms * 15, 1),
            mouthShape
          });
        }
        
        // Yield control to prevent blocking (only for large batches)
        if (frameCount > 100) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const lipSyncData: LipSyncData = {
        frames,
        duration
      };

      // Cache the results for future use
      await lipSyncCache.instance.cacheLipSync(audioBlob, lipSyncData);

      return lipSyncData;
    };

    // Use Promise.race for timeout handling without async Promise executor
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Lip-sync analysis timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([performAnalysis(), timeoutPromise]);
    } catch (error) {
      console.error('Error analyzing lip-sync:', error);
      throw error;
    }
  }

  /**
   * Real-time lip-sync analysis from audio stream
   */
  analyzeRealTimeLipSync(audioStream: MediaStream, callback: (frame: LipSyncFrame) => void): (() => void) | null {
    try {
      // AudioContext must be initialized before calling this method
      if (!this.audioContext || !this.analyserNode) {
        console.error('[LipSyncAnalyzer] AudioContext not initialized. Call initializeAudioContext() first.');
        return null;
      }

      const source = this.audioContext.createMediaStreamSource(audioStream);
      source.connect(this.analyserNode);
      
      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      let animationFrame: number;
      
      const analyze = () => {
        if (!this.analyserNode || !this.audioContext) return;
        
        this.analyserNode.getByteFrequencyData(dataArray);
        
        // Calculate volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const volume = sum / (dataArray.length * 255);
        
        // Determine mouth shape based on frequency distribution
        const mouthShape = this.determineMouthShapeFromFrequencyData(dataArray);
        
        const frame: LipSyncFrame = {
          time: this.audioContext.currentTime,
          volume,
          mouthOpen: Math.min(volume * 2, 1),
          mouthShape
        };
        
        callback(frame);
        animationFrame = requestAnimationFrame(analyze);
      };
      
      analyze();
      
      // Return cleanup function
      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        source.disconnect();
      };
    } catch (error) {
      console.error('[LipSyncAnalyzer] Real-time analysis failed:', error);
      return null;
    }
  }

  /**
   * Async version of real-time lip-sync analysis (for backward compatibility)
   * @deprecated Use analyzeRealTimeLipSync instead for better performance
   */
  async analyzeRealTimeLipSyncAsync(audioStream: MediaStream, callback: (frame: LipSyncFrame) => void): Promise<() => void> {
    // Initialize AudioContext if needed
    await this.initializeAudioContext();
    
    const cleanup = this.analyzeRealTimeLipSync(audioStream, callback);
    if (!cleanup) {
      throw new Error('Failed to start real-time lip-sync analysis');
    }
    
    return cleanup;
  }

  private determineMouthShape(
    channelData: Float32Array, 
    startSample: number, 
    endSample: number, 
    sampleRate: number
  ): LipSyncFrame['mouthShape'] {
    // Simple frequency analysis to determine vowel sounds
    const frameData = channelData.slice(startSample, endSample);
    
    // Perform basic frequency analysis
    const frequencies = this.performFFT(frameData);
    const dominantFreq = this.findDominantFrequency(frequencies, sampleRate);
    
    // Map frequencies to vowel sounds (simplified)
    if (dominantFreq < 400) return 'U';
    if (dominantFreq < 800) return 'O';
    if (dominantFreq < 1200) return 'A';
    if (dominantFreq < 2000) return 'E';
    return 'I';
  }

  private determineMouthShapeSimplified(
    rms: number,
    channelData: Float32Array, 
    startSample: number, 
    endSample: number
  ): LipSyncFrame['mouthShape'] {
    // Ultra-fast mouth shape determination based on volume and basic audio characteristics
    if (rms < 0.01) return 'Closed';
    
    // Sample only a few points for basic frequency estimation
    const samplePoints = 4;
    const step = Math.floor((endSample - startSample) / samplePoints);
    let avgValue = 0;
    let variance = 0;
    
    for (let i = 0; i < samplePoints; i++) {
      const idx = startSample + i * step;
      if (idx < channelData.length) {
        avgValue += Math.abs(channelData[idx]);
      }
    }
    avgValue /= samplePoints;
    
    // Calculate simple variance
    for (let i = 0; i < samplePoints; i++) {
      const idx = startSample + i * step;
      if (idx < channelData.length) {
        const diff = Math.abs(channelData[idx]) - avgValue;
        variance += diff * diff;
      }
    }
    variance /= samplePoints;
    
    // Simple heuristic based on volume and variance
    if (rms > 0.1) {
      if (variance > 0.05) return 'A'; // High energy, high variance
      if (variance > 0.02) return 'E'; // High energy, medium variance
      return 'I'; // High energy, low variance
    } else {
      if (variance > 0.02) return 'O'; // Medium energy, high variance
      return 'U'; // Medium energy, low variance
    }
  }

  private determineMouthShapeFromFrequencyData(frequencyData: Uint8Array): LipSyncFrame['mouthShape'] {
    // Analyze frequency bins to determine vowel sound
    const lowFreq = this.getFrequencyBandAverage(frequencyData, 0, 10);   // Low frequencies
    const midFreq = this.getFrequencyBandAverage(frequencyData, 10, 25);  // Mid frequencies
    const highFreq = this.getFrequencyBandAverage(frequencyData, 25, 40); // High frequencies
    
    const total = lowFreq + midFreq + highFreq;
    if (total < 20) return 'Closed';
    
    // Simple heuristic for vowel detection
    if (lowFreq > midFreq && lowFreq > highFreq) return 'U';
    if (midFreq > lowFreq && midFreq > highFreq) return 'O';
    if (highFreq > lowFreq && highFreq > midFreq) return 'I';
    if (midFreq > lowFreq) return 'A';
    return 'E';
  }

  private getFrequencyBandAverage(frequencyData: Uint8Array, startBin: number, endBin: number): number {
    let sum = 0;
    for (let i = startBin; i < endBin && i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    return sum / (endBin - startBin);
  }

  private performFFT(data: Float32Array): number[] {
    // Highly optimized frequency analysis using Web Audio API approach
    // This is much faster than manual DFT calculation
    const N = Math.min(data.length, 256); // Limit data size for performance
    const frequencies: number[] = [];
    
    // Use a simplified approach focused on frequency bands we care about
    // This is much faster than full FFT for lip-sync purposes
    const stepSize = Math.max(1, Math.floor(data.length / N));
    
    for (let i = 0; i < N / 2; i++) {
      let magnitude = 0;
      const startIdx = i * stepSize;
      const endIdx = Math.min(startIdx + stepSize, data.length);
      
      // Calculate average magnitude for this frequency band
      for (let j = startIdx; j < endIdx; j++) {
        magnitude += Math.abs(data[j]);
      }
      
      frequencies.push(magnitude / stepSize);
    }
    
    return frequencies;
  }

  private findDominantFrequency(frequencies: number[], sampleRate: number): number {
    let maxMagnitude = 0;
    let dominantIndex = 0;
    
    for (let i = 1; i < frequencies.length; i++) {
      if (frequencies[i] > maxMagnitude) {
        maxMagnitude = frequencies[i];
        dominantIndex = i;
      }
    }
    
    // Convert bin index to frequency
    return (dominantIndex * sampleRate) / (frequencies.length * 2);
  }

  /**
   * Generate visemes (mouth shapes) for text
   * This is a simplified approach - in practice you'd use phoneme analysis
   */
  static generateVisemesFromText(text: string, duration: number): LipSyncData {
    const frames: LipSyncFrame[] = [];
    const frameInterval = 0.05; // 50ms
    const frameCount = Math.floor(duration / frameInterval);
    
    // Simple text-to-viseme mapping
    const words = text.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < frameCount; i++) {
      const time = i * frameInterval;
      const progress = time / duration;
      
      // Determine current word
      const currentWordIndex = Math.floor(progress * words.length);
      const currentWord = words[currentWordIndex] || '';
      
      // Simple vowel detection in current word
      let mouthShape: LipSyncFrame['mouthShape'] = 'Closed';
      if (currentWord.includes('a')) mouthShape = 'A';
      else if (currentWord.includes('i')) mouthShape = 'I';
      else if (currentWord.includes('u')) mouthShape = 'U';
      else if (currentWord.includes('e')) mouthShape = 'E';
      else if (currentWord.includes('o')) mouthShape = 'O';
      
      // Add some randomness to make it more natural
      const volume = currentWord.length > 0 ? 0.3 + Math.random() * 0.4 : 0;
      
      frames.push({
        time,
        volume,
        mouthOpen: volume,
        mouthShape
      });
    }
    
    return {
      frames,
      duration
    };
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return lipSyncCache.instance.getCacheStats();
  }

  /**
   * Clear all cached lip-sync data
   */
  clearCache() {
    lipSyncCache.instance.clearCache();
  }

  /**
   * Get cache instance for advanced operations
   */
  getCache() {
    return lipSyncCache.instance;
  }

  dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyserNode = null;
    this.isInitialized = false;
  }

  /**
   * Check if AudioContext is available and ready
   */
  isAudioContextReady(): boolean {
    return this.isInitialized && 
           this.audioContext !== null && 
           this.audioContext.state === 'running';
  }

  /**
   * Manually initialize AudioContext after user interaction
   */
  async initialize(): Promise<void> {
    await this.initializeAudioContext();
  }
}