/**
 * Google Cloud Voice Service - Simple Implementation
 * Handles speech-to-text and text-to-speech operations
 */

import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import { applySttCorrections, adjustConfidenceAfterCorrection } from '@/utils/stt-corrections';

interface VoiceSettings {
  language: string;
  speaker: string;
  speed: number;
  pitch: number;
  volumeGainDb: number;
}

interface SpeechToTextResult {
  success: boolean;
  transcript?: string;
  confidence?: number;
  error?: string;
}

interface TextToSpeechResult {
  success: boolean;
  audioBase64?: string;
  error?: string;
}

// 感情ごとの音声パラメータ調整マップ（クラス外に定義）
const EMOTION_VOICE_PARAMS: Record<string, { speed: number; pitch: number; volumeGainDb: number; speaker: string; adjust?: (settings: VoiceSettings) => void }> = {
  // 日本語
  'ja:excited':   { speed: 1.3 * 1.1, pitch: 2.5 + 0.3, volumeGainDb: 2.0, speaker: 'ja-JP-Wavenet-B' },
  'ja:sad':       { speed: 1.3 * 0.9, pitch: 2.5 - 0.5, volumeGainDb: 2.0, speaker: 'ja-JP-Wavenet-B' },
  'ja:angry':     { speed: 1.3 * 1.05, pitch: 2.5 + 0.2, volumeGainDb: 2.0, speaker: 'ja-JP-Wavenet-B' },
  'ja:calm':      { speed: 1.3 * 0.95, pitch: 2.5 - 0.2, volumeGainDb: 2.0, speaker: 'ja-JP-Wavenet-B' },
  'ja:happy':     { speed: 1.3, pitch: 2.5, volumeGainDb: 2.0, speaker: 'ja-JP-Wavenet-B' },
  // 英語
  'en:excited':   { speed: 1.05 * 1.1, pitch: 0.3 + 0.3, volumeGainDb: 2.5, speaker: 'en-GB-Standard-F' },
  'en:sad':       { speed: 1.05 * 0.9, pitch: 0.3 - 0.5, volumeGainDb: 2.5, speaker: 'en-GB-Standard-F' },
  'en:angry':     { speed: 1.05 * 1.05, pitch: 0.3 + 0.2, volumeGainDb: 2.5, speaker: 'en-GB-Standard-F' },
  'en:calm':      { speed: 1.05 * 0.95, pitch: 0.3 - 0.2, volumeGainDb: 2.5, speaker: 'en-GB-Standard-F' },
  'en:happy':     { speed: 1.05, pitch: 0.3, volumeGainDb: 2.5, speaker: 'en-GB-Standard-F' },
};

export class GoogleCloudVoiceSimple {
  private auth: GoogleAuth;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private currentSettings: VoiceSettings;

  constructor() {
    // Check if credentials are provided as a path or JSON string
    const credentialsPath = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    };
    
    if (credentialsPath) {
      // Server-side only: Check if it's a file path by checking if file exists
      if (typeof window === 'undefined' && fs.existsSync(credentialsPath)) {
        // It's a file path (server-side only)
        authOptions.keyFile = credentialsPath;
      } else {
        // Try to parse as JSON
        try {
          authOptions.credentials = JSON.parse(credentialsPath);
        } catch (error) {
          console.error('Failed to parse Google Cloud credentials from environment variable:', error);
          // Fallback to default file path (server-side only)
          if (typeof window === 'undefined') {
            const defaultKeyPath = 'config/service-account-key.json';
            if (fs.existsSync(defaultKeyPath)) {
              authOptions.keyFile = defaultKeyPath;
            } else {
              throw new Error(`Service account key file not found at ${defaultKeyPath}. Please provide valid credentials.`);
            }
          }
        }
      }
    } else if (typeof window === 'undefined') {
      // No credentials provided, use default file path (server-side only)
      const defaultKeyPath = 'config/service-account-key.json';
      if (fs.existsSync(defaultKeyPath)) {
        authOptions.keyFile = defaultKeyPath;
      } else {
        throw new Error(`Service account key file not found at ${defaultKeyPath}. Please set GOOGLE_CLOUD_CREDENTIALS environment variable.`);
      }
    }
    
    this.auth = new GoogleAuth(authOptions);
    
    // Default settings
    this.currentSettings = {
      language: 'ja',
      speaker: 'ja-JP-Wavenet-B',
      speed: 1.3,
      pitch: 2.5,
      volumeGainDb: 2.0
    };
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const authClient = await this.auth.getClient();
      const accessToken = await authClient.getAccessToken();
      
      // Handle both old (object) and new (string/null) return formats
      const token = typeof accessToken === 'string' ? accessToken : accessToken?.token;
      
      if (!token) {
        throw new Error('Failed to get access token');
      }
      
      this.accessToken = token;
      this.tokenExpiry = now + 3300 * 1000; // 55 minutes
      
      console.log('Access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw new Error('Authentication failed');
    }
  }

  async speechToText(audioBase64: string, language: string = 'ja'): Promise<SpeechToTextResult> {
    try {
      const accessToken = await this.getAccessToken();
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      
      if (!projectId) {
        throw new Error('GOOGLE_CLOUD_PROJECT_ID is not configured');
      }

      const languageCode = language === 'ja' ? 'ja-JP' : 'en-US';
      
      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: {
              encoding: 'WEBM_OPUS',
              sampleRateHertz: 48000,
              languageCode: languageCode,
              model: 'latest_long',
              enableAutomaticPunctuation: true,
              enableWordTimeOffsets: false,
              audioChannelCount: 1,
            },
            audio: {
              content: audioBase64
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Speech-to-Text API error:', response.status, errorText);
        return {
          success: false,
          error: `API Error: ${response.status} - ${errorText}`
        };
      }

      const result = await response.json();
      
      console.log('Speech-to-Text API response:', JSON.stringify(result, null, 2));
      
      if (result.results && result.results.length > 0 && result.results[0].alternatives && result.results[0].alternatives.length > 0) {
        const transcript = result.results[0].alternatives[0].transcript;
        const confidence = result.results[0].alternatives[0].confidence || 0;
        
        console.log(`Raw transcript from API: "${transcript}" (type: ${typeof transcript})`);
        
        // Check if transcript is valid
        if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
          console.log('Speech-to-Text: Empty or invalid transcript');
          return {
            success: false,
            error: 'Empty or invalid transcript'
          };
        }
        
        const trimmedTranscript = transcript.trim();
        
        // Apply STT corrections for common misrecognitions
        const correctedTranscript = applySttCorrections(trimmedTranscript, language, confidence);
        
        // Adjust confidence if corrections were made
        const adjustedConfidence = adjustConfidenceAfterCorrection(
          trimmedTranscript,
          correctedTranscript,
          confidence
        );
        
        // Log the results
        if (trimmedTranscript !== correctedTranscript) {
          console.log(`Speech-to-Text correction applied:`);
          console.log(`  Original: "${trimmedTranscript}"`);
          console.log(`  Corrected: "${correctedTranscript}"`);
          console.log(`  Confidence: ${confidence} → ${adjustedConfidence}`);
        } else {
          console.log(`Speech-to-Text successful: "${correctedTranscript}" (confidence: ${adjustedConfidence})`);
        }
        
        return {
          success: true,
          transcript: correctedTranscript,
          confidence: adjustedConfidence
        };
      } else {
        console.log('No transcription results in API response:', result);
        return {
          success: false,
          error: 'No transcription results'
        };
      }
    } catch (error) {
      console.error('Speech-to-Text error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async textToSpeech(text: string, language: string = 'ja', emotion?: string): Promise<TextToSpeechResult> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Update settings based on language
      this.setLanguageSettings(language);
      
      // Apply emotion if provided
      if (emotion) {
        this.setSpeakerByEmotion(emotion as any);
      }
      
      const response = await fetch(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: this.currentSettings.language === 'ja' ? 'ja-JP' : 'en-GB',
              name: this.currentSettings.speaker
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: this.currentSettings.speed,
              pitch: this.currentSettings.pitch,
              volumeGainDb: this.currentSettings.volumeGainDb,
              effectsProfileId: ['telephony-class-application']
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Text-to-Speech API error:', response.status, errorText);
        return {
          success: false,
          error: `API Error: ${response.status} - ${errorText}`
        };
      }

      const result = await response.json();
      
      console.log('[GoogleCloudVoice] TTS API Response:', {
        hasAudioContent: !!result.audioContent,
        audioContentLength: result.audioContent ? result.audioContent.length : 0,
        audioContentPrefix: result.audioContent ? result.audioContent.substring(0, 50) : 'NO CONTENT',
        responseKeys: Object.keys(result)
      });
      
      if (result.audioContent) {
        console.log(`Text-to-Speech successful for: "${text.substring(0, 50)}..."`);
        return {
          success: true,
          audioBase64: result.audioContent
        };
      } else {
        console.error('[GoogleCloudVoice] No audio content in TTS response');
        return {
          success: false,
          error: 'No audio content in response'
        };
      }
    } catch (error) {
      console.error('Text-to-Speech error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Public method to set language (called by RealtimeAgent)
   */
  setLanguage(language: string): void {
    this.setLanguageSettings(language);
  }

  private setLanguageSettings(language: string): void {
    this.currentSettings.language = language;
    
    if (language === 'ja') {
      this.currentSettings.speaker = 'ja-JP-Wavenet-B';
      this.currentSettings.speed = 1.3;
      this.currentSettings.pitch = 2.5;
      this.currentSettings.volumeGainDb = 2.0;
    } else {
      this.currentSettings.speaker = 'en-GB-Standard-F';
      this.currentSettings.speed = 1.05;
      this.currentSettings.pitch = 0.3;
      this.currentSettings.volumeGainDb = 2.5;
    }
  }

  setSpeakerByEmotion(emotion: 'happy' | 'sad' | 'excited' | 'calm' | 'angry') {
    // 言語ごとに感情パラメータを外部マップから参照
    const lang = this.currentSettings.language === 'ja' ? 'ja' : 'en';
    const key = `${lang}:${emotion}`;
    const params = EMOTION_VOICE_PARAMS[key] || EMOTION_VOICE_PARAMS[`${lang}:happy`];
    this.currentSettings.speaker = params.speaker;
    this.currentSettings.speed = params.speed;
    this.currentSettings.pitch = params.pitch;
    this.currentSettings.volumeGainDb = params.volumeGainDb;
    
    console.log(`[Voice] Using base voice settings for emotion "${emotion}" (${this.currentSettings.language})`);
  }

  // Stub for streaming - not implemented in simple version
  async *streamingSpeechToText(audioStream: ReadableStream<Uint8Array>): AsyncIterable<string> {
    throw new Error('Streaming not supported in simple implementation');
  }
}