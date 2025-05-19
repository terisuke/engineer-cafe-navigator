import { VoiceSettings } from '../types/config';

export class GoogleCloudVoiceService {
  private config: any;
  private currentSettings: VoiceSettings;

  constructor(config: any) {
    this.config = config;
    this.currentSettings = {
      language: 'ja',
      speaker: 'ja-JP-Neural2-B',
      speed: 1.0,
      pitch: 0,
      volumeGainDb: 0,
    };
  }

  async speechToText(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${this.config.speechApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.config.speechApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    
    // WebSocketまたはServer-Sent Eventsを使用してストリーミング実装
    async function* generateTranscripts() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // ここで実際のストリーミング処理を実装
          // 現在は簡単なポーリング形式で実装
          const transcript = await this.speechToText(value.buffer);
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
