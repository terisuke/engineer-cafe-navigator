/**
 * Google Cloud Voice Service - Simple Implementation
 * Handles speech-to-text and text-to-speech operations
 */

import { GoogleAuth } from 'google-auth-library';
import { Buffer } from 'buffer';

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

export class GoogleCloudVoiceSimple {
  private auth: GoogleAuth;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private currentSettings: VoiceSettings;

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      keyFile: 'config/service-account-key.json'
    });
    
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
      
      if (result.results && result.results.length > 0) {
        const transcript = result.results[0].alternatives[0].transcript;
        const confidence = result.results[0].alternatives[0].confidence || 0;
        
        console.log(`Speech-to-Text successful: "${transcript}" (confidence: ${confidence})`);
        
        return {
          success: true,
          transcript: transcript.trim(),
          confidence
        };
      } else {
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
      
      if (result.audioContent) {
        console.log(`Text-to-Speech successful for: "${text.substring(0, 50)}..."`);
        return {
          success: true,
          audioBase64: result.audioContent
        };
      } else {
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
    // Keep the original base settings regardless of emotion for better clarity
    if (this.currentSettings.language === 'ja') {
      this.currentSettings.speaker = 'ja-JP-Wavenet-B';
      this.currentSettings.speed = 1.3;
      this.currentSettings.pitch = 2.5;
      this.currentSettings.volumeGainDb = 2.0;
      
      // Apply emotion-specific adjustments
      switch (emotion) {
        case 'excited':
          this.currentSettings.speed *= 1.1;
          this.currentSettings.pitch += 0.3;
          break;
        case 'sad':
          this.currentSettings.speed *= 0.9;
          this.currentSettings.pitch -= 0.5;
          break;
        case 'angry':
          this.currentSettings.speed *= 1.05;
          this.currentSettings.pitch += 0.2;
          break;
        case 'calm':
          this.currentSettings.speed *= 0.95;
          this.currentSettings.pitch -= 0.2;
          break;
        default:
          // Keep base settings for 'happy' and others
          break;
      }
    } else {
      // 英語の場合も同様の調整を追加
      this.currentSettings.speaker = 'en-GB-Standard-F';
      this.currentSettings.speed = 1.05;
      this.currentSettings.pitch = 0.3;
      this.currentSettings.volumeGainDb = 2.5;
    }
    
    console.log(`[Voice] Using base voice settings for emotion "${emotion}" (${this.currentSettings.language})`);
  }

  // Stub for streaming - not implemented in simple version
  async *streamingSpeechToText(audioStream: ReadableStream<Uint8Array>): AsyncIterable<string> {
    throw new Error('Streaming not supported in simple implementation');
  }
}