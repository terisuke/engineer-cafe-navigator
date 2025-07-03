import { Mastra } from '@mastra/core';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Config } from './types/config';
import { GoogleCloudVoiceSimple } from './voice/google-cloud-voice-simple';
import { WelcomeAgent } from './agents/welcome-agent';
import { RealtimeAgent } from './agents/realtime-agent';
import { SlideNarrator } from './agents/slide-narrator';
import { MainQAWorkflow } from './workflows/main-qa-workflow';
import { SupabaseMemoryAdapter } from '@/lib/supabase-memory';
import { getSharedMemoryService } from '@/lib/shared-memory-service';
import { VoiceOutputAgent } from './agents/voice-output-agent';
import { CharacterControlAgent } from './agents/character-control-agent';

// Import tools
import { SlideControlTool } from './tools/slide-control';
import { MarpRendererTool } from './tools/marp-renderer';
import { NarrationLoaderTool } from './tools/narration-loader';
import { CharacterControlTool } from './tools/character-control';
import { ExternalApiTool } from './tools/external-api';
import { LanguageSwitchTool } from './tools/language-switch';
import { PageTransitionTool } from './tools/page-transition';
import { RAGSearchTool } from './tools/rag-search';
import { enhancedRagSearchTool } from './tools/enhanced-rag-search';
import { ExternalDataFetcherTool } from './tools/external-data-fetcher';
import { EngineerCafeWebSearchTool } from './tools/company-web-search';
import { GeneralWebSearchTool } from './tools/general-web-search';
import { CalendarServiceTool } from './tools/calendar-service';

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
    
    // Get shared memory service for all agents
    const sharedMemory = getSharedMemoryService();
    
    const modelConfig = {
      llm: {
        model,
      },
      // Removed mastra.memory as it's not used
      sharedMemory: sharedMemory,
    };
    
    const welcomeAgent = new WelcomeAgent(modelConfig);
    const realtimeAgent = new RealtimeAgent(modelConfig, this.voiceService);
    const slideNarrator = new SlideNarrator(modelConfig);
    const mainQAWorkflow = new MainQAWorkflow(modelConfig);
    
    // Voice output agent with voice service
    const voiceOutputAgent = new VoiceOutputAgent({
      ...modelConfig,
      tools: {
        voice: this.voiceService
      }
    });
    
    // Character control agent
    const characterControlAgent = new CharacterControlAgent(modelConfig);

    this.agents.set('welcome', welcomeAgent);
    this.agents.set('qa', mainQAWorkflow); // New architecture as primary QA
    this.agents.set('realtime', realtimeAgent);
    this.agents.set('narrator', slideNarrator);
    this.agents.set('voiceOutput', voiceOutputAgent); // Centralized voice output
    this.agents.set('characterControl', characterControlAgent); // Centralized character control
    
    // Connect agents for unified presentation layer
    realtimeAgent.setVoiceOutputAgent(voiceOutputAgent);
    realtimeAgent.setCharacterControlAgent(characterControlAgent);
    
    // Connect SlideNarrator to unified presentation layer
    slideNarrator.setVoiceOutputAgent(voiceOutputAgent);
    slideNarrator.setCharacterControlAgent(characterControlAgent);
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
    const ragSearchTool = new RAGSearchTool();
    const externalDataFetcherTool = new ExternalDataFetcherTool(this.config.external);
    const engineerCafeWebSearchTool = new EngineerCafeWebSearchTool();
    const calendarServiceTool = new CalendarServiceTool();
    
    // Initialize GeneralWebSearchTool with error handling
    let generalWebSearchTool: GeneralWebSearchTool | null = null;
    try {
      generalWebSearchTool = new GeneralWebSearchTool();
    } catch (error) {
      console.warn('Failed to initialize GeneralWebSearchTool:', error);
      console.warn('Web search functionality will be disabled. Check GoogleGenerativeAI environment variables.');
    }

    this.tools.set('slideControl', slideControlTool);
    this.tools.set('marpRenderer', marpRendererTool);
    this.tools.set('narrationLoader', narrationLoaderTool);
    this.tools.set('characterControl', characterControlTool);
    this.tools.set('externalApi', externalApiTool);
    this.tools.set('languageSwitch', languageSwitchTool);
    this.tools.set('pageTransition', pageTransitionTool);
    this.tools.set('ragSearch', ragSearchTool);
    this.tools.set('enhancedRagSearch', enhancedRagSearchTool);
    this.tools.set('externalDataFetcher', externalDataFetcherTool);
    this.tools.set('engineerCafeWebSearch', engineerCafeWebSearchTool);
    this.tools.set('calendarService', calendarServiceTool);
    
    // Only register GeneralWebSearchTool if it was successfully initialized
    if (generalWebSearchTool) {
      this.tools.set('generalWebSearch', generalWebSearchTool);
    }
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
