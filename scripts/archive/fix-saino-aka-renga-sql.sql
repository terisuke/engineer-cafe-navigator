-- Fix Saino Cafe Knowledge Base Entries
-- Remove incorrect information and ensure accurate closing day info

-- First, let's check what we have
SELECT id, content, metadata->>'title' as title, language 
FROM knowledge_base 
WHERE content ILIKE '%saino%' OR content ILIKE '%才能%'
ORDER BY created_at DESC;

-- Update Japanese Saino entry (if it exists with wrong info)
UPDATE knowledge_base 
SET content = 'sainoカフェの営業時間：【平日】ランチ12:00〜17:00、ディナー18:00〜20:30（L.O.20:00）※17:00〜18:00は中休み【土日祝】11:00〜20:30（L.O.20:00）【金・土のみ】21:45まで営業（L.O.21:15）。定休日・休館日は毎月最終月曜日（エンジニアカフェと同じ）および年末年始。エンジニアカフェと同じフロア（1階）の階段手前に位置しており、コーヒー、軽食、デザートなどを提供しています。※L.O.はラストオーダー（Last Order）の略です。',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{last_updated}',
      to_jsonb(CURRENT_DATE::text)
    )
WHERE id = '8aa4bf78-8680-4ada-a062-54963d5933ab';

-- Update English Saino entry
UPDATE knowledge_base 
SET content = 'saino cafe operating hours: [Weekdays] Lunch 12:00-17:00, Dinner 18:00-20:30 (L.O.20:00) *Break time 17:00-18:00 [Weekends/Holidays] 11:00-20:30 (L.O.20:00) [Friday & Saturday only] Open until 21:45 (L.O.21:15). Closed on the last Monday of each month (same as Engineer Cafe) and during New Year holidays. Located on the same floor (1st floor) as Engineer Cafe near the stairs, offering coffee, light meals, and desserts. *L.O. stands for Last Order.',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{last_updated}',
      to_jsonb(CURRENT_DATE::text)
    )
WHERE id = '7755438e-ce50-49a1-b19d-811095f7aeaf';

-- Remove any entries with incorrect information
DELETE FROM knowledge_base 
WHERE content ILIKE '%土曜日はエンジニアカフェが休館日の場合のみ営業%'
   OR content ILIKE '%火曜日〜土曜日 10:00〜17:00%'
   OR content ILIKE '%Tuesday to Saturday%10:00%17:00%';

-- Insert Aka-Renga Cultural Center entries

-- Japanese entries
INSERT INTO knowledge_base (
  content,
  category,
  subcategory,
  language,
  metadata,
  content_embedding
) VALUES 
(
  '赤煉瓦文化会館（福岡市文学館）は福岡市中央区天神1-15-30に位置する文化施設です。明治時代の赤煉瓦建築を保存・活用した歴史的建造物で、福岡の文学・文化の発信拠点として親しまれています。',
  '基本情報',
  '概要',
  'ja',
  '{"title": "赤煉瓦文化会館とは", "tags": ["赤煉瓦文化会館", "福岡市文学館", "文化施設", "天神", "歴史的建造物"], "importance": "high"}'::jsonb,
  NULL
),
(
  '赤煉瓦文化会館の開館時間は9:00〜19:00です。ただし展示室は17:00までとなっています。休館日は毎週月曜日（祝日の場合は翌平日）および年末年始（12月28日〜1月4日）です。',
  '基本情報',
  '営業時間',
  'ja',
  '{"title": "赤煉瓦文化会館の営業時間と休館日", "tags": ["営業時間", "開館時間", "休館日", "定休日", "赤煉瓦文化会館"], "importance": "high"}'::jsonb,
  NULL
),
(
  '赤煉瓦文化会館への入館料は無料です。ただし、特別展示については有料の場合があります。どなたでも気軽に訪れることができる開かれた文化施設です。',
  '料金',
  '入館料',
  'ja',
  '{"title": "赤煉瓦文化会館の入館料", "tags": ["入館料", "料金", "無料", "赤煉瓦文化会館"], "importance": "medium"}'::jsonb,
  NULL
),
(
  '赤煉瓦文化会館には文学館、会議室、展示室があります。福岡ゆかりの文学者の資料展示や、定期的に文化イベント、講演会、ワークショップなどが開催されています。',
  '設備',
  '施設一覧',
  'ja',
  '{"title": "赤煉瓦文化会館の施設", "tags": ["施設", "文学館", "会議室", "展示室", "イベント", "赤煉瓦文化会館"], "importance": "medium"}'::jsonb,
  NULL
),
(
  '赤煉瓦文化会館はエンジニアカフェと徒歩圏内にあり、天神エリアの文化ゾーンを形成しています。エンジニアカフェでの作業の合間に、文化的な刺激を求めて訪れる方も多い施設です。',
  '連携情報',
  '施設間連携',
  'ja',
  '{"title": "赤煉瓦文化会館とエンジニアカフェの関係", "tags": ["赤煉瓦文化会館", "エンジニアカフェ", "連携", "天神", "文化施設"], "importance": "medium"}'::jsonb,
  NULL
);

-- English entries
INSERT INTO knowledge_base (
  content,
  category,
  subcategory,
  language,
  metadata,
  content_embedding
) VALUES 
(
  'Aka-Renga Cultural Center (Fukuoka City Literature Museum) is located at 1-15-30 Tenjin, Chuo-ku, Fukuoka. It is a historic red brick building from the Meiji era, preserved and utilized as a cultural hub for Fukuoka''s literature and culture.',
  'General',
  'Overview',
  'en',
  '{"title": "About Aka-Renga Cultural Center", "tags": ["aka-renga", "cultural-center", "fukuoka-literature-museum", "tenjin", "historic-building"], "importance": "high"}'::jsonb,
  NULL
),
(
  'Aka-Renga Cultural Center is open from 9:00 to 19:00, with exhibition rooms closing at 17:00. Closed on Mondays (or the following weekday if Monday is a holiday) and during New Year holidays (December 28 to January 4).',
  'General',
  'Hours',
  'en',
  '{"title": "Aka-Renga Cultural Center Hours", "tags": ["hours", "opening-hours", "closed-days", "aka-renga"], "importance": "high"}'::jsonb,
  NULL
),
(
  'Admission to Aka-Renga Cultural Center is free. However, special exhibitions may charge admission fees. It is an open cultural facility that anyone can visit freely.',
  'Pricing',
  'Admission',
  'en',
  '{"title": "Aka-Renga Cultural Center Admission", "tags": ["admission", "fee", "free", "aka-renga"], "importance": "medium"}'::jsonb,
  NULL
);

-- Note: After running this SQL, you need to regenerate embeddings for all entries with NULL content_embedding