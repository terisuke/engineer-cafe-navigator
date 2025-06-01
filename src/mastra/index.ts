import { Mastra } from '@mastra/core';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Config } from './types/config';
import { GoogleCloudVoiceSimple } from './voice/google-cloud-voice-simple';
import { WelcomeAgent } from './agents/welcome-agent';
import { QAAgent } from './agents/qa-agent';
import { RealtimeAgent } from './agents/realtime-agent';
import { SlideNarrator } from './agents/slide-narrator';
import { SupabaseMemoryAdapter } from '@/lib/supabase-memory';

// Import tools
import { SlideControlTool } from './tools/slide-control';
import { MarpRendererTool } from './tools/marp-renderer';
import { NarrationLoaderTool } from './tools/narration-loader';
import { CharacterControlTool } from './tools/character-control';
import { ExternalApiTool } from './tools/external-api';
import { LanguageSwitchTool } from './tools/language-switch';
import { PageTransitionTool } from './tools/page-transition';

export class EngineerCafeNavigator {
  private mastra: Mastra;
  private config: Config;
  private agents: Map<string, any> = new Map();
  private tools: Map<string, any> = new Map();
  private voiceService!: GoogleCloudVoiceSimple;

  constructor(config: Config) {
    this.config = config;
    this.mastra = new Mastra({
      agents: {},
    });

    this.initializeServices();
    this.initializeAgents();
    this.initializeTools();
  }

  private initializeServices() {
    // Initialize Google Cloud Voice Service
    this.voiceService = new GoogleCloudVoiceSimple();
  }

  private initializeAgents() {
    // Initialize agents with model configuration
    const google = createGoogleGenerativeAI({
      apiKey: this.config.gemini.apiKey,
    });
    
    const model = google(this.config.gemini.model);
    
    const modelConfig = {
      llm: {
        model,
      },
      memory: this.mastra.memory,
    };
    
    const welcomeAgent = new WelcomeAgent(modelConfig);
    const qaAgent = new QAAgent(modelConfig);
    const realtimeAgent = new RealtimeAgent(modelConfig, this.voiceService);
    const slideNarrator = new SlideNarrator(modelConfig);

    this.agents.set('welcome', welcomeAgent);
    this.agents.set('qa', qaAgent);
    this.agents.set('realtime', realtimeAgent);
    this.agents.set('narrator', slideNarrator);
  }

  private initializeTools() {
    // Initialize tools
    const slideControlTool = new SlideControlTool();
    const marpRendererTool = new MarpRendererTool();
    const narrationLoaderTool = new NarrationLoaderTool();
    const characterControlTool = new CharacterControlTool();
    const externalApiTool = new ExternalApiTool(this.config.external);
    const languageSwitchTool = new LanguageSwitchTool();
    const pageTransitionTool = new PageTransitionTool();

    this.tools.set('slideControl', slideControlTool);
    this.tools.set('marpRenderer', marpRendererTool);
    this.tools.set('narrationLoader', narrationLoaderTool);
    this.tools.set('characterControl', characterControlTool);
    this.tools.set('externalApi', externalApiTool);
    this.tools.set('languageSwitch', languageSwitchTool);
    this.tools.set('pageTransition', pageTransitionTool);
    this.tools.set('voiceService', this.voiceService);

    // Register tools with agents
    this.agents.forEach((agent) => {
      if (agent.addTool) {
        this.tools.forEach((tool, name) => {
          agent.addTool(name, tool);
        });
      }
    });
  }

  public getAgent(name: string) {
    return this.agents.get(name);
  }

  public getTool(name: string) {
    return this.tools.get(name);
  }

  public getMastra() {
    return this.mastra;
  }

  public getVoiceService() {
    return this.voiceService;
  }
}

// Singleton instance
let navigatorInstance: EngineerCafeNavigator;

export function getEngineerCafeNavigator(config?: Config) {
  if (!navigatorInstance && config) {
    navigatorInstance = new EngineerCafeNavigator(config);
  }
  return navigatorInstance;
}
