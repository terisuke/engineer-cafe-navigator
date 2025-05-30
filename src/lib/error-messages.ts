/**
 * Bilingual error messages for user-friendly error handling
 */

export interface ErrorMessage {
  ja: string;
  en: string;
}

export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Voice Processing Errors
  MICROPHONE_PERMISSION_DENIED: {
    ja: 'マイクへのアクセスが拒否されました。ブラウザの設定でマイクへのアクセスを許可してください。',
    en: 'Microphone access was denied. Please allow microphone access in your browser settings.',
  },
  MICROPHONE_NOT_FOUND: {
    ja: 'マイクが検出されませんでした。マイクが正しく接続されているか確認してください。',
    en: 'No microphone was detected. Please check that your microphone is properly connected.',
  },
  VOICE_PROCESSING_ERROR: {
    ja: '音声の処理中にエラーが発生しました。もう一度お試しください。',
    en: 'An error occurred while processing your voice. Please try again.',
  },
  SPEECH_RECOGNITION_ERROR: {
    ja: '音声認識に失敗しました。もう一度はっきりと話してください。',
    en: 'Speech recognition failed. Please speak clearly and try again.',
  },
  
  // Network Errors
  NETWORK_ERROR: {
    ja: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
    en: 'There is a network connection problem. Please check your internet connection.',
  },
  SERVER_ERROR: {
    ja: 'サーバーエラーが発生しました。しばらくしてからもう一度お試しください。',
    en: 'A server error occurred. Please try again later.',
  },
  SERVICE_UNAVAILABLE: {
    ja: 'サービスが一時的に利用できません。しばらくしてからもう一度お試しください。',
    en: 'Service is temporarily unavailable. Please try again later.',
  },
  
  // Session Errors
  SESSION_EXPIRED: {
    ja: 'セッションの有効期限が切れました。ページを更新してください。',
    en: 'Your session has expired. Please refresh the page.',
  },
  SESSION_NOT_FOUND: {
    ja: 'セッションが見つかりません。ページを更新してください。',
    en: 'Session not found. Please refresh the page.',
  },
  
  // Character/Model Errors
  CHARACTER_LOAD_ERROR: {
    ja: 'キャラクターの読み込みに失敗しました。ページを更新してください。',
    en: 'Failed to load character. Please refresh the page.',
  },
  WEBGL_NOT_SUPPORTED: {
    ja: 'お使いのブラウザはWebGLをサポートしていません。最新のブラウザをご利用ください。',
    en: 'Your browser does not support WebGL. Please use a modern browser.',
  },
  
  // Slide Errors
  SLIDE_NOT_FOUND: {
    ja: 'スライドが見つかりませんでした。',
    en: 'Slide not found.',
  },
  SLIDE_LOAD_ERROR: {
    ja: 'スライドの読み込みに失敗しました。',
    en: 'Failed to load slide.',
  },
  
  // API Errors
  API_KEY_INVALID: {
    ja: 'APIキーが無効です。設定を確認してください。',
    en: 'Invalid API key. Please check your configuration.',
  },
  RATE_LIMIT_EXCEEDED: {
    ja: '利用制限に達しました。しばらくしてからもう一度お試しください。',
    en: 'Rate limit exceeded. Please try again later.',
  },
  
  // Generic Errors
  UNKNOWN_ERROR: {
    ja: '予期しないエラーが発生しました。もう一度お試しください。',
    en: 'An unexpected error occurred. Please try again.',
  },
  NOT_SUPPORTED: {
    ja: 'この機能はお使いのブラウザではサポートされていません。',
    en: 'This feature is not supported in your browser.',
  },
};

/**
 * Get error message in specified language
 */
export function getErrorMessage(
  errorCode: string,
  language: 'ja' | 'en' = 'ja'
): string {
  const message = ERROR_MESSAGES[errorCode];
  if (!message) {
    return ERROR_MESSAGES.UNKNOWN_ERROR[language];
  }
  return message[language];
}

/**
 * Format error for display
 */
export function formatError(
  error: any,
  language: 'ja' | 'en' = 'ja'
): string {
  // Check for known error codes
  if (error.code && ERROR_MESSAGES[error.code]) {
    return getErrorMessage(error.code, language);
  }
  
  // Check for specific error messages
  if (error.message) {
    if (error.message.includes('microphone')) {
      return getErrorMessage('MICROPHONE_PERMISSION_DENIED', language);
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return getErrorMessage('NETWORK_ERROR', language);
    }
    if (error.message.includes('rate limit')) {
      return getErrorMessage('RATE_LIMIT_EXCEEDED', language);
    }
  }
  
  // Check for HTTP status codes
  if (error.status) {
    if (error.status >= 500) {
      return getErrorMessage('SERVER_ERROR', language);
    }
    if (error.status === 429) {
      return getErrorMessage('RATE_LIMIT_EXCEEDED', language);
    }
    if (error.status === 403) {
      return getErrorMessage('API_KEY_INVALID', language);
    }
  }
  
  // Default to unknown error
  return getErrorMessage('UNKNOWN_ERROR', language);
}

/**
 * Error notification component props
 */
export interface ErrorNotificationProps {
  error: any;
  language: 'ja' | 'en';
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}