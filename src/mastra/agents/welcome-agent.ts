import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { SupportedLanguage } from '../types/config';

export class WelcomeAgent extends Agent {
  constructor(mastra: any) {
    super({
      name: 'WelcomeAgent',
      instructions: `You are a friendly welcome agent for Engineer Cafe in Fukuoka.
        Your role is to:
        1. Greet new visitors warmly
        2. Detect their preferred language (Japanese or English)
        3. Guide them through slide presentation about Engineer Cafe services
        4. Respond to questions about the presentation content
        5. Direct them to registration or Q&A as needed
        
        Always maintain a professional yet welcoming tone.
        Be concise but informative in your responses.
        Use the slide control tools to navigate presentations effectively.`,
      model: 'gemini-2.5-flash-preview-04-17',
      tools: [],
      memory: mastra.memory,
    });
  }

  async welcome(language?: SupportedLanguage): Promise<string> {
    const welcomeMessage = language === 'en' 
      ? "Welcome to Engineer Cafe! I'm here to guide you through our services. Would you like to start with our presentation?"
      : "エンジニアカフェへようこそ！サービスのご案内をさせていただきます。プレゼンテーションから始めませんか？";
    
    // Store language preference in memory
    await this.memory.store('language', language || 'ja');
    
    return welcomeMessage;
  }

  async handleLanguageSelection(userInput: string): Promise<{ language: SupportedLanguage; response: string }> {
    // Simple language detection based on input
    const isEnglish = /^(english|en|yes|hi|hello)/i.test(userInput.trim());
    const language: SupportedLanguage = isEnglish ? 'en' : 'ja';
    
    await this.memory.store('language', language);
    
    const response = language === 'en'
      ? "Great! I'll assist you in English. Let's begin with our service overview."
      : "ありがとうございます！日本語でご案内いたします。サービス概要から始めましょう。";
    
    return { language, response };
  }

  async handleSlideQuestion(question: string, slideNumber: number): Promise<string> {
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
    // Use the agent's reasoning to answer questions about slide content
    const prompt = language === 'en'
      ? `Answer this question about slide ${slideNumber} of Engineer Cafe presentation: ${question}`
      : `エンジニアカフェのプレゼンテーション${slideNumber}枚目のスライドについての質問に答えてください: ${question}`;
    
    const response = await this.run(prompt);
    return response;
  }

  async transitionToQA(): Promise<string> {
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
    const message = language === 'en'
      ? "I'd be happy to answer any specific questions you have about Engineer Cafe. What would you like to know?"
      : "エンジニアカフェについて、どのようなご質問がございますか？お気軽にお聞きください。";
    
    return message;
  }

  async transitionToRegistration(): Promise<string> {
    const language = await this.memory.get('language') as SupportedLanguage || 'ja';
    
    const message = language === 'en'
      ? "Great! Let me guide you through the registration process. First, you'll need to create an account..."
      : "ありがとうございます！新規登録のご案内をいたします。まず、アカウントの作成から始めましょう...";
    
    return message;
  }
}
