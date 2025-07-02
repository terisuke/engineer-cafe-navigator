import { z } from 'zod';
import { SupportedLanguage } from '@/types';

const contextFilterSchema = z.object({
  context: z.string().describe('The context to filter'),
  requestType: z.string().describe('The type of information requested'),
  language: z.enum(['ja', 'en']).describe('Language for filtering')
});

/**
 * Filter context content based on the request type to ensure only relevant information is returned
 */
function filterByRequestType(context: string, requestType: string, language: SupportedLanguage): string {
  if (!context || !requestType) {
    console.log(`[ContextFilterTool] Early return - context empty: ${!context}, requestType empty: ${!requestType}`);
    return context;
  }
  
  console.log(`[ContextFilterTool] filterByRequestType START:`, {
    requestType,
    language,
    contextLength: context.length,
    contextPreview: context.substring(0, 100) + '...'
  });
  
  // Define keywords for each request type
  const requestTypeKeywords: Record<string, { include: string[], exclude: string[] }> = {
    'hours': {
      include: language === 'ja' 
        ? ['営業時間', '時間', 'ランチタイム', 'ディナータイム', '午前', '午後', '曜日', '定休日', '休業日', '休館日', 'オープン', 'クローズ', '開店', '閉店', '時から', '時まで']
        : ['hours', 'time', 'lunch', 'dinner', 'open', 'close', 'closed', 'holiday', 'day off', 'from', 'until', 'to', 'am', 'pm'],
      exclude: language === 'ja'
        ? ['メニュー', '席数', '設備', '電話', 'TEL', '住所', 'アクセス', '予約', '料金', '価格', 'Wi-Fi', 'WiFi']
        : ['menu', 'seats', 'facilities', 'phone', 'tel', 'address', 'access', 'reservation', 'price', 'fee', 'wifi']
    },
    'price': {
      include: language === 'ja'
        ? ['料金', '価格', '円', '無料', 'メニュー', 'ドリンク', 'フード', 'コース', 'セット', '値段', '費用', 'チャージ']
        : ['price', 'cost', 'fee', 'charge', 'yen', 'free', 'menu', 'drink', 'food', 'course', 'set'],
      exclude: language === 'ja'
        ? ['営業時間', '時間', '定休日', '席数', '設備', '電話', '住所', 'アクセス', '予約方法', '有料会議室', '2階会議室', '会議室料金', '有料スペース', '会議室利用料金', '1室あたり', '有料', '990円', '1,980円', '平日', '土日祝']
        : ['hours', 'time', 'closed', 'seats', 'facilities', 'phone', 'address', 'access', 'how to book', 'paid meeting room', '2f meeting room', 'meeting room fee', 'paid space', 'meeting room usage fee', 'per room', 'paid', '990 yen', '1,980 yen']
    },
    'location': {
      include: language === 'ja'
        ? ['場所', '住所', 'アクセス', '階', '天神', '福岡市', '中央区', 'ビル', 'フロア', '併設', '隣接', 'エンジニアカフェ内']
        : ['location', 'address', 'access', 'floor', 'tenjin', 'fukuoka', 'building', 'inside', 'adjacent', 'attached'],
      exclude: language === 'ja'
        ? ['営業時間', '料金', 'メニュー', '設備詳細', '予約']
        : ['hours', 'price', 'menu', 'facility details', 'reservation']
    },
    'booking': {
      include: language === 'ja'
        ? ['予約', '申し込み', '申込', 'Web', 'オンライン', '当日', '事前', '必要', '不要', '方法', '手続き']
        : ['booking', 'reservation', 'reserve', 'apply', 'online', 'web', 'advance', 'required', 'method', 'how to'],
      exclude: language === 'ja'
        ? ['営業時間', '料金詳細', 'メニュー', '設備一覧']
        : ['hours', 'price details', 'menu', 'facility list']
    },
    'facility': {
      include: language === 'ja'
        ? ['設備', '施設', 'Wi-Fi', 'WiFi', '電源', 'コンセント', '席', 'スペース', '会議室', 'テーブル', 'カウンター', '個室', '利用できる', '完備']
        : ['facility', 'facilities', 'equipment', 'wifi', 'power', 'outlet', 'seats', 'space', 'room', 'table', 'counter', 'private', 'available'],
      exclude: language === 'ja'
        ? ['営業時間', '料金表', '予約手順', '住所']
        : ['hours', 'price list', 'booking process', 'address']
    },
    'access': {
      include: language === 'ja'
        ? ['アクセス', '行き方', '道順', '最寄り', '駅', '徒歩', '分', '出口', '地下鉄', 'バス', '天神', '場所', '住所']
        : ['access', 'directions', 'how to get', 'nearest', 'station', 'walk', 'minutes', 'exit', 'subway', 'bus', 'location', 'address'],
      exclude: language === 'ja'
        ? ['営業時間', '料金', 'メニュー', '設備', '予約']
        : ['hours', 'price', 'menu', 'facilities', 'reservation']
    },
    'wifi': {
      include: language === 'ja'
        ? ['Wi-Fi', 'WiFi', 'wi-fi', 'wifi', 'インターネット', 'ネット', '無線', '接続', 'ワイファイ', '通信', '電波']
        : ['wi-fi', 'wifi', 'internet', 'wireless', 'connection', 'network', 'online', 'connectivity'],
      exclude: language === 'ja'
        ? ['営業時間', '料金表', 'メニュー', '予約', '場所', '住所', '席数', '定休日']
        : ['hours', 'price list', 'menu', 'reservation', 'location', 'address', 'seats', 'closed days']
    }
  };
  
  const keywords = requestTypeKeywords[requestType];
  if (!keywords) {
    console.log(`[ContextFilterTool] No filter keywords defined for requestType: ${requestType}`);
    return context;
  }
  
  // Split context into sections (by sentence or paragraph)
  const sections = context.split(/[。\n]+/).filter(s => s.trim());
  
  console.log(`[ContextFilterTool] Found ${sections.length} sections to filter`);
  
  // Filter sections based on keywords
  const filteredSections = sections.filter((section, index) => {
    const sectionLower = section.toLowerCase();
    
    // Check if section contains at least one include keyword
    const matchedIncludeKeywords = keywords.include.filter(keyword => 
      sectionLower.includes(keyword.toLowerCase())
    );
    const hasIncludeKeyword = matchedIncludeKeywords.length > 0;
    
    // Check if section contains any exclude keyword
    const matchedExcludeKeywords = keywords.exclude.filter(keyword => 
      sectionLower.includes(keyword.toLowerCase())
    );
    const hasExcludeKeyword = matchedExcludeKeywords.length > 0;
    
    // Include section if it has include keywords and no exclude keywords
    // OR if it's very short and likely important (e.g., "11:30-15:00")
    const isTimeFormat = /\d{1,2}:\d{2}/.test(section);
    const isPriceFormat = /\d+円/.test(section) || /¥\d+/.test(section);
    
    // For price requests, be more restrictive - require include keywords, don't just rely on price format
    const shouldInclude = (hasIncludeKeyword && !hasExcludeKeyword) || 
           (requestType === 'hours' && isTimeFormat && !hasExcludeKeyword);
    
    // Log detailed filtering decision for first few sections
    if (index < 5) {
      console.log(`[ContextFilterTool] Section ${index + 1} filtering:`, {
        section: section.substring(0, 50) + '...',
        hasIncludeKeyword,
        matchedIncludeKeywords: matchedIncludeKeywords.slice(0, 3),
        hasExcludeKeyword,
        matchedExcludeKeywords: matchedExcludeKeywords.slice(0, 3),
        isTimeFormat,
        isPriceFormat,
        shouldInclude
      });
    }
    
    return shouldInclude;
  });
  
  // If no sections match, return a subset of the original context
  // to avoid completely empty results
  if (filteredSections.length === 0) {
    console.log(`[ContextFilterTool] No sections matched filter for ${requestType}, returning first relevant section`);
    // Try to find the most relevant section
    const relevantSection = sections.find(section => 
      keywords.include.some(keyword => 
        section.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    return relevantSection || sections[0] || context;
  }
  
  const filteredContext = filteredSections.join('。');
  console.log(`[ContextFilterTool] filterByRequestType RESULT:`, {
    originalSections: sections.length,
    filteredSections: filteredSections.length,
    originalLength: context.length,
    filteredLength: filteredContext.length,
    filteredPreview: filteredContext.substring(0, 200) + '...'
  });
  
  return filteredContext;
}

export const contextFilterTool = {
  name: 'contextFilter',
  description: 'Filters context based on specific request types',
  schema: contextFilterSchema,
  
  execute: async ({ context, requestType, language }: z.infer<typeof contextFilterSchema>) => {
    const filteredContext = filterByRequestType(context, requestType, language);
    
    return {
      success: true,
      data: {
        filteredContext,
        originalLength: context.length,
        filteredLength: filteredContext.length
      }
    };
  }
};