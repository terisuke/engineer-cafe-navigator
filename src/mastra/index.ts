import { Mastra } from '@mastra/core';
import { Config } from './types/config';
import { GoogleCloudVoiceService } from './voice/google-cloud-voice';
import { WelcomeAgent } from './agents/welcome-agent';
import { QAAgent } from './agents/qa-agent';
import { RealtimeAgent } from './agents/realtime-agent';
import { SlideNarrator } from './agents/slide-narrator';

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

  constructor(config: Config) {
    this.config = config;
    this.mastra = new Mastra({
      name: 'Engineer Cafe Navigator',
      version: '1.0.0',
      description: 'Multi-language voice AI agent for Engineer Cafe',
      memory: {
        type: 'postgres',
        url: config.database.url,
      },
      observability: {
        enabled: true,
        trace: true,
        metrics: true,
      },
    });

    this.initializeServices();
    this.initializeAgents();
    this.initializeTools();
  }

  private initializeServices() {
    // Initialize Google Cloud Voice Service
    const voiceService = new GoogleCloudVoiceService(this.config.googleCloud);
    this.mastra.addService('voice', voiceService);
  }

  private initializeAgents() {
    // Initialize agents
    const welcomeAgent = new WelcomeAgent(this.mastra);
    const qaAgent = new QAAgent(this.mastra);
    const realtimeAgent = new RealtimeAgent(this.mastra);
    const slideNarrator = new SlideNarrator(this.mastra);

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
}

// Singleton instance
let navigatorInstance: EngineerCafeNavigator;

export function getEngineerCafeNavigator(config?: Config) {
  if (!navigatorInstance && config) {
    navigatorInstance = new EngineerCafeNavigator(config);
  }
  return navigatorInstance;
}
