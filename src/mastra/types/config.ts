export interface Config {
  googleCloud: {
    projectId: string;
    credentials: string;
    speechApiKey?: string; // Optional - not needed with service account
    translateApiKey?: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  database: {
    url: string;
  };
  nextAuth: {
    url: string;
    secret: string;
  };
  vercel?: {
    url: string;
  };
  external: {
    websocketUrl?: string;
    receptionApiUrl?: string;
  };
}

export interface SlideConfig {
  title: string;
  slideCount: number;
  currentSlide: number;
  language: 'ja' | 'en';
  autoPlay: boolean;
  transitions: boolean;
}

export interface NarrationConfig {
  metadata: {
    title: string;
    language: string;
    speaker: string;
    version: string;
  };
  slides: SlideNarration[];
}

export interface SlideNarration {
  slideNumber: number;
  narration: {
    auto: string;
    onEnter: string;
    onDemand: Record<string, string>;
  };
  transitions: {
    next: string | null;
    previous: string | null;
  };
}

export interface VoiceSettings {
  language: 'ja' | 'en';
  speaker: string;
  speed: number;
  pitch: number;
  volumeGainDb: number;
}

export interface CharacterSettings {
  modelPath: string;
  animations: string[];
  expressions: string[];
  defaultExpression: string;
  defaultAnimation: string;
}

export interface ExternalIntegration {
  enabled: boolean;
  websocketUrl?: string;
  apiEndpoints: Record<string, string>;
  messageTypes: string[];
}

export type SupportedLanguage = 'ja' | 'en';
export type AgentType = 'welcome' | 'qa' | 'realtime' | 'narrator';
export type ToolType = 'slideControl' | 'marpRenderer' | 'narrationLoader' | 'characterControl' | 'externalApi' | 'languageSwitch' | 'pageTransition';
