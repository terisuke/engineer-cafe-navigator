import { VoiceSettings } from '../types/config';
import { GoogleAuth } from 'google-auth-library';
import * as path from 'path';
import * as fs from 'fs';

export class GoogleCloudVoiceService {
  private config: any;
  private currentSettings: VoiceSettings;
  private auth: GoogleAuth;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: any) {
    this.config = config;
    this.currentSettings = {
      language: 'ja',
      speaker: 'ja-JP-Neural2-B',
      speed: 1.0,
      pitch: 0,
      volumeGainDb: 0,
    };
    
    // Initialize Google Auth with service account
    const keyFilePath = path.resolve(process.cwd(), config.credentials);
    console.log('Initializing GoogleAuth with keyFile:', keyFilePath);
    console.log('Current working directory:', process.cwd());
    
    // In Next.js, we need to handle the service account differently
    try {
      // Read the service account key file
      const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
      const serviceAccountKey = JSON.parse(keyFileContent);
      
      this.auth = new GoogleAuth({
        credentials: serviceAccountKey,
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/speech',
        ],
      });
      console.log('GoogleAuth initialized with service account:', serviceAccountKey.client_email);
    } catch (error) {
      console.error('Failed to initialize GoogleAuth:', error);
      throw error;
    }
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Get new access token
      const client = await this.auth.getClient();
      const tokenResponse = await client.getAccessToken();
      
      if (!tokenResponse.token) {
        throw new Error('Failed to get access token: No token returned');
      }
      
      this.accessToken = tokenResponse.token;
      // Set expiry to 50 minutes from now (tokens typically last 60 minutes)
      this.tokenExpiry = Date.now() + 50 * 60 * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
      throw error;
    }
  }

  async speechToText(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 16000,
            languageCode: this.currentSettings.language === 'ja' ? 'ja-JP' : 'en-US',
            enableAutomaticPunctuation: true,
            model: 'latest_short', // 短い音声に最適なモデル
          },
          audio: {
            content: Buffer.from(audioBuffer).toString('base64'),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Speech-to-Text API error: ${response.status}`);
      }

      const result = await response.json();
      return result.results?.[0]?.alternatives?.[0]?.transcript || '';
    } catch (error) {
      console.error('Speech-to-Text error:', error);
      throw error;
    }
  }

  async textToSpeech(text: string, settings?: Partial<VoiceSettings>): Promise<ArrayBuffer> {
    const currentSettings = { ...this.currentSettings, ...settings };
    
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: currentSettings.language === 'ja' ? 'ja-JP' : 'en-US',
            name: currentSettings.speaker,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: currentSettings.speed,
            pitch: currentSettings.pitch,
            volumeGainDb: currentSettings.volumeGainDb,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Text-to-Speech API error: ${response.status}`);
      }

      const result = await response.json();
      const audioContent = result.audioContent;
      
      if (!audioContent) {
        throw new Error('No audio content received');
      }

      return Buffer.from(audioContent, 'base64').buffer;
    } catch (error) {
      console.error('Text-to-Speech error:', error);
      throw error;
    }
  }

  async streamingSpeechToText(audioStream: ReadableStream<Uint8Array>): Promise<AsyncIterable<string>> {
    // Google Cloud Speech-to-Text ストリーミング実装
    const reader = audioStream.getReader();
    const self = this;
    
    // WebSocketまたはServer-Sent Eventsを使用してストリーミング実装
    async function* generateTranscripts() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // ここで実際のストリーミング処理を実装
          // 現在は簡単なポーリング形式で実装
          const transcript = await self.speechToText(value.buffer as ArrayBuffer);
          if (transcript) {
            yield transcript;
          }
        }
      } catch (error) {
        console.error('Streaming speech-to-text error:', error);
        throw error;
      } finally {
        reader.releaseLock();
      }
    }

    return generateTranscripts.call(this);
  }

  updateSettings(settings: Partial<VoiceSettings>) {
    this.currentSettings = { ...this.currentSettings, ...settings };
  }

  getSettings(): VoiceSettings {
    return { ...this.currentSettings };
  }

  // 言語に応じたデフォルトスピーカーを設定
  setLanguage(language: 'ja' | 'en') {
    this.currentSettings.language = language;
    this.currentSettings.speaker = language === 'ja' 
      ? 'ja-JP-Neural2-B' 
      : 'en-US-Neural2-F';
  }

  // 感情に応じたスピーカー設定
  setSpeakerByEmotion(emotion: 'neutral' | 'friendly' | 'explaining') {
    if (this.currentSettings.language === 'ja') {
      switch (emotion) {
        case 'neutral':
          this.currentSettings.speaker = 'ja-JP-Neural2-B';
          break;
        case 'friendly':
          this.currentSettings.speaker = 'ja-JP-Neural2-C';
          break;
        case 'explaining':
          this.currentSettings.speaker = 'ja-JP-Neural2-A';
          break;
      }
    } else {
      switch (emotion) {
        case 'neutral':
          this.currentSettings.speaker = 'en-US-Neural2-F';
          break;
        case 'friendly':
          this.currentSettings.speaker = 'en-US-Neural2-H';
          break;
        case 'explaining':
          this.currentSettings.speaker = 'en-US-Neural2-G';
          break;
      }
    }
  }
}
