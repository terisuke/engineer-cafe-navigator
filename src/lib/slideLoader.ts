import fs from 'fs';
import path from 'path';

/**
 * Load a slide deck and its narration in the selected language.
 */
export function loadSlides(lang: 'ja' | 'en', deckName = 'engineer-cafe') {
  const base = path.resolve(
    __dirname,
    '..',
    'slides',
    lang,
    `${deckName}.md`,
  );
  const narration = path.resolve(
    __dirname,
    '..',
    'slides',
    'narration',
    `${deckName}-${lang}.txt`,
  );

  return {
    markdown: fs.readFileSync(base, 'utf-8'),
    narration: fs
      .readFileSync(narration, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace(/^\d+\s/, '')), // strip line numbers
  };
}