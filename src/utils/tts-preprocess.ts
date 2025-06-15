export const preprocessTTS = (text: string, lang: 'ja' | 'en'): string => {
  const replacement = lang === 'ja' ? 'ミーティング' : 'meeting';
  return text.replace(/\bMTG\b/gi, replacement);
}; 