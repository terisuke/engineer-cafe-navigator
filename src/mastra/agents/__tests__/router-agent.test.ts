import { RouterAgent } from '../router-agent';

describe('RouterAgent', () => {
  let routerAgent: RouterAgent;
  
  beforeEach(() => {
    const mockConfig = {
      llm: {
        model: 'mock-model'
      }
    };
    routerAgent = new RouterAgent(mockConfig);
  });

  describe('routeQuery', () => {
    describe('営業時間関連のクエリ', () => {
      test('「エンジニアカフェの営業時間は？」をBusinessInfoAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('エンジニアカフェの営業時間は？', 'session_123');
        expect(result.agent).toBe('BusinessInfoAgent');
        expect(result.requestType).toBe('hours');
        expect(result.language).toBe('ja');
      });

      test('「What time does Engineer Cafe open?」をBusinessInfoAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('What time does Engineer Cafe open?', 'session_123');
        expect(result.agent).toBe('BusinessInfoAgent');
        expect(result.requestType).toBe('hours');
        expect(result.language).toBe('en');
      });
    });

    describe('Wi-Fi関連のクエリ', () => {
      test('「Engineer Cafeの無料Wi-Fiはありますか？」をFacilityAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('Engineer Cafeの無料Wi-Fiはありますか？', 'session_123');
        expect(result.agent).toBe('FacilityAgent');
        expect(result.requestType).toBe('wifi');
        expect(result.language).toBe('ja');
      });

      test('「Is there wifi in the basement?」をFacilityAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('Is there wifi in the basement?', 'session_123');
        expect(result.agent).toBe('FacilityAgent');
        expect(result.requestType).toBe('wifi');
        expect(result.language).toBe('en');
      });
    });

    describe('料金関連のクエリ', () => {
      test('「sainoカフェの料金を教えて」をBusinessInfoAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('sainoカフェの料金を教えて', 'session_123');
        expect(result.agent).toBe('BusinessInfoAgent');
        expect(result.requestType).toBe('price');
        expect(result.category).toBe('saino-cafe');
      });

      test('「How much does it cost?」をBusinessInfoAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('How much does it cost?', 'session_123');
        expect(result.agent).toBe('BusinessInfoAgent');
        expect(result.requestType).toBe('price');
      });
    });

    describe('場所関連のクエリ', () => {
      test('「Where is Engineer Cafe located?」をBusinessInfoAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('Where is Engineer Cafe located?', 'session_123');
        expect(result.agent).toBe('BusinessInfoAgent');
        expect(result.requestType).toBe('location');
        expect(result.language).toBe('en');
      });

      test('「エンジニアカフェへのアクセス方法」をBusinessInfoAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('エンジニアカフェへのアクセス方法', 'session_123');
        expect(result.agent).toBe('BusinessInfoAgent');
        expect(result.requestType).toBe('location');
      });
    });

    describe('施設関連のクエリ', () => {
      test('「地下のスペースについて教えて」をBusinessInfoAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('地下のスペースについて教えて', 'session_123');
        expect(result.agent).toBe('BusinessInfoAgent');
        expect(result.requestType).toBe('basement');
      });

      test('「会議室の予約方法は？」をGeneralKnowledgeAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('会議室の予約方法は？', 'session_123');
        expect(result.agent).toBe('GeneralKnowledgeAgent');
        expect(result.requestType).toBe('meeting-room');
      });
    });

    describe('イベント関連のクエリ', () => {
      test('「今日のエンジニアカフェのイベントは？」をEventAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('今日のエンジニアカフェのイベントは？', 'session_123');
        expect(result.agent).toBe('EventAgent');
        expect(result.category).toBe('events');
        expect(result.requestType).toBe('event');
      });

      test('「今週の勉強会の予定を教えて」をEventAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('今週の勉強会の予定を教えて', 'session_123');
        expect(result.agent).toBe('EventAgent');
        expect(result.requestType).toBe('event');
      });
    });

    describe('メモリー関連のクエリ', () => {
      test('「さっき何を聞いた？」をMemoryAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('さっき何を聞いた？', 'session_123');
        expect(result.agent).toBe('MemoryAgent');
        expect(result.category).toBe('memory');
      });

      test('「What did I ask earlier?」をMemoryAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('What did I ask earlier?', 'session_123');
        expect(result.agent).toBe('MemoryAgent');
        expect(result.category).toBe('memory');
      });
    });

    describe('一般的なクエリ', () => {
      test('「最新のAI開発について教えて」をGeneralKnowledgeAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('最新のAI開発について教えて', 'session_123');
        expect(result.agent).toBe('GeneralKnowledgeAgent');
        expect(result.category).toBe('general');
      });

      test('「福岡のスタートアップ情報」をGeneralKnowledgeAgentにルーティング', async () => {
        const result = await routerAgent.routeQuery('福岡のスタートアップ情報', 'session_123');
        expect(result.agent).toBe('GeneralKnowledgeAgent');
        expect(result.category).toBe('general');
      });
    });
  });
});