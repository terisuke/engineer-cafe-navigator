export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  protected stream: MediaStream | null = null;
  private isRecording = false;

  constructor(
    private onDataAvailable: (audioBlob: Blob) => void,
    private onError: (error: Error) => void
  ) {}

  async initialize(): Promise<void> {
    try {
      if (typeof navigator === 'undefined') {
        this.onError(new Error('navigator is undefined'));
        return;
      }

      // Normalize getUserMedia across browsers
      let getUserMediaFunc: ((c: MediaStreamConstraints) => Promise<MediaStream>) | null = null;

      if (navigator.mediaDevices?.getUserMedia) {
        getUserMediaFunc = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      } else {
        const legacy = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).msGetUserMedia;
        if (legacy) {
          getUserMediaFunc = (constraints: MediaStreamConstraints) => new Promise((res, rej) => legacy.call(navigator, constraints, res, rej));
        }
      }

      if (!getUserMediaFunc) {
        this.onError(new Error('getUserMedia API is not available'));
        return;
      }

      this.stream = await getUserMediaFunc({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        this.onDataAvailable(audioBlob);
        this.audioChunks = [];
      };

      this.mediaRecorder.onerror = (event) => {
        this.onError(new Error(`MediaRecorder error: ${event}`));
      };
    } catch (error) {
      this.onError(new Error(`Failed to initialize recorder: ${error}`));
    }
  }

  start(): void {
    if (!this.mediaRecorder) {
      this.onError(new Error('Recorder not initialized'));
      return;
    }

    if (this.isRecording || this.mediaRecorder.state === 'recording') {
      this.onError(new Error('Already recording'));
      return;
    }

    if (this.mediaRecorder.state === 'paused') {
      // Resume instead of start if paused
      this.resume();
      return;
    }

    try {
      this.audioChunks = [];
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (error) {
      this.isRecording = false;
      this.onError(new Error(`Failed to start recording: ${error}`));
    }
  }

  stop(): void {
    if (!this.mediaRecorder || !this.isRecording) {
      return;
    }

    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
    } catch (error) {
      this.onError(new Error(`Failed to stop recording: ${error}`));
    }
  }

  pause(): void {
    if (!this.mediaRecorder || !this.isRecording) {
      return;
    }

    try {
      this.mediaRecorder.pause();
    } catch (error) {
      this.onError(new Error(`Failed to pause recording: ${error}`));
    }
  }

  resume(): void {
    if (!this.mediaRecorder) {
      return;
    }

    try {
      this.mediaRecorder.resume();
    } catch (error) {
      this.onError(new Error(`Failed to resume recording: ${error}`));
    }
  }

  cleanup(): void {
    if (this.mediaRecorder) {
      if (this.isRecording) {
        this.stop();
      }
      this.mediaRecorder = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.audioChunks = [];
    this.isRecording = false;
  }

  getState(): RecordingState {
    if (!this.mediaRecorder) {
      return 'inactive';
    }
    return this.mediaRecorder.state;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isInitialized(): boolean {
    return this.mediaRecorder !== null && this.stream !== null;
  }

  private getSupportedMimeType(): string {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Fallback
    return 'audio/webm';
  }

  // Static utility methods
  static async convertBlobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Audio analysis utilities
  static async analyzeAudioLevel(blob: Blob): Promise<number> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await VoiceRecorder.convertBlobToArrayBuffer(blob);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      let sum = 0;
      
      for (let i = 0; i < channelData.length; i++) {
        sum += Math.abs(channelData[i]);
      }
      
      const average = sum / channelData.length;
      audioContext.close();
      
      return average;
    } catch (error) {
      console.error('Error analyzing audio level:', error);
      return 0;
    }
  }

  static async detectSilence(blob: Blob, threshold = 0.01): Promise<boolean> {
    const level = await VoiceRecorder.analyzeAudioLevel(blob);
    return level < threshold;
  }

  // Duration utilities
  static async getAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
      audio.onerror = reject;
      audio.src = URL.createObjectURL(blob);
    });
  }

  // Format utilities
  static formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Types
export type RecordingState = 'inactive' | 'recording' | 'paused';

export interface RecordingOptions {
  channelCount?: number;
  sampleRate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  mimeType?: string;
}

export interface AnalysisResult {
  level: number;
  duration: number;
  fileSize: number;
  isSilent: boolean;
}

// Advanced recorder with real-time analysis
export class AdvancedVoiceRecorder extends VoiceRecorder {
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrame: number | null = null;

  constructor(
    onDataAvailable: (audioBlob: Blob) => void,
    onError: (error: Error) => void,
    private onLevelUpdate?: (level: number) => void
  ) {
    super(onDataAvailable, onError);
  }

  async initialize(): Promise<void> {
    await super.initialize();

    if (this.stream) {
      this.setupRealTimeAnalysis();
    }
  }

  private setupRealTimeAnalysis(): void {
    if (!this.stream) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      source.connect(this.analyser);
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.startAnalysis();
    } catch (error) {
      console.error('Failed to setup real-time analysis:', error);
    }
  }

  private startAnalysis(): void {
    if (!this.analyser || !this.dataArray) return;

    const analyze = () => {
      if (!this.analyser || !this.dataArray) return;

      this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>);
      
      // Calculate average level
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;
      const level = average / 255; // Normalize to 0-1
      
      this.onLevelUpdate?.(level);
      
      if (this.isCurrentlyRecording()) {
        this.animationFrame = requestAnimationFrame(analyze);
      }
    };

    analyze();
  }

  start(): void {
    super.start();
    this.startAnalysis();
  }

  stop(): void {
    super.stop();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  cleanup(): void {
    super.cleanup();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
  }

  getCurrentLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;

    this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>);
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    return average / 255;
  }
}
