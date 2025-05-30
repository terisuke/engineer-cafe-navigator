/**
 * Lip-sync analyzer for VRM characters
 * Analyzes audio data to generate mouth shape animations
 */

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
  private audioContext: AudioContext;
  private analyserNode: AnalyserNode;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
  }

  /**
   * Analyze audio blob and generate lip-sync data
   */
  async analyzeLipSync(audioBlob: Blob): Promise<LipSyncData> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;
      
      // Analyze audio in 50ms intervals
      const frameInterval = 0.05; // 50ms
      const frameCount = Math.floor(duration / frameInterval);
      const frames: LipSyncFrame[] = [];

      for (let i = 0; i < frameCount; i++) {
        const startSample = Math.floor(i * frameInterval * sampleRate);
        const endSample = Math.floor((i + 1) * frameInterval * sampleRate);
        
        // Calculate RMS volume for this frame
        let sum = 0;
        for (let j = startSample; j < endSample && j < channelData.length; j++) {
          sum += channelData[j] * channelData[j];
        }
        const rms = Math.sqrt(sum / (endSample - startSample));
        
        // Generate mouth shape based on frequency analysis
        const mouthShape = this.determineMouthShape(channelData, startSample, endSample, sampleRate);
        
        frames.push({
          time: i * frameInterval,
          volume: Math.min(rms * 10, 1), // Normalize and amplify
          mouthOpen: Math.min(rms * 15, 1), // Mouth opening based on volume
          mouthShape
        });
      }

      return {
        frames,
        duration
      };
    } catch (error) {
      console.error('Error analyzing lip-sync:', error);
      throw error;
    }
  }

  /**
   * Real-time lip-sync analysis from audio stream
   */
  analyzeRealTimeLipSync(audioStream: MediaStream, callback: (frame: LipSyncFrame) => void): () => void {
    const source = this.audioContext.createMediaStreamSource(audioStream);
    source.connect(this.analyserNode);
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    let animationFrame: number;
    
    const analyze = () => {
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
    // Simplified FFT implementation for frequency analysis
    // In a real implementation, you'd use a proper FFT library
    const frequencies: number[] = [];
    const N = data.length;
    
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += data[n] * Math.cos(angle);
        imag += data[n] * Math.sin(angle);
      }
      
      frequencies.push(Math.sqrt(real * real + imag * imag));
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
    let wordIndex = 0;
    
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

  dispose() {
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}