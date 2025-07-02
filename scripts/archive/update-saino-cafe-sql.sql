-- Update Saino Cafe knowledge base entry to include closing day information
-- Target entry ID: 8aa4bf78-8680-4ada-a062-54963d5933ab (Japanese entry)

-- Update the Japanese entry with closing day information
UPDATE knowledge_base
SET 
  content = 'sainoカフェの営業時間：【平日】ランチ12:00〜17:00、ディナー18:00〜20:30（L.O.20:00）※17:00〜18:00は中休み【土日祝】11:00〜20:30（L.O.20:00）【金・土のみ】21:45まで営業（L.O.21:15）。定休日・休館日は毎月最終月曜日（エンジニアカフェと同じ）および年末年始。エンジニアカフェと同じフロア（1階）の階段手前に位置しており、コーヒー、軽食、デザートなどを提供しています。※L.O.はラストオーダー（Last Order）の略です。',
  metadata = jsonb_build_object(
    'tags', ARRAY[
      'cafe',
      'hours',
      'business-days',
      'saino',
      '営業時間',
      '定休日',
      '休館日',
      'ランチ',
      'ディナー',
      'ラストオーダー'
    ],
    'title', 'sainoカフェの営業時間と定休日・休館日',
    'importance', 'high',
    'last_updated', to_char(CURRENT_DATE, 'YYYY-MM-DD')
  ),
  updated_at = NOW()
WHERE id = '8aa4bf78-8680-4ada-a062-54963d5933ab';

-- Verify the update
SELECT 
  id,
  content,
  metadata,
  updated_at
FROM knowledge_base
WHERE id = '8aa4bf78-8680-4ada-a062-54963d5933ab';

-- Optional: Update the English entry as well
-- UPDATE knowledge_base
-- SET 
--   content = 'saino cafe operating hours: [Weekdays] Lunch 12:00-17:00, Dinner 18:00-20:30 (L.O.20:00) *Break time 17:00-18:00 [Weekends/Holidays] 11:00-20:30 (L.O.20:00) [Friday & Saturday only] Open until 21:45 (L.O.21:15). Closed on the last Monday of each month (same as Engineer Cafe) and during New Year holidays. Located on the same floor (1st floor) as Engineer Cafe near the stairs, offering coffee, light meals, and desserts. *L.O. stands for Last Order.',
--   metadata = jsonb_build_object(
--     'tags', ARRAY[
--       'cafe',
--       'hours',
--       'business-days',
--       'saino',
--       'operating-hours',
--       'closed-days',
--       'lunch',
--       'dinner',
--       'last-order'
--     ],
--     'title', 'saino cafe operating hours and business days',
--     'importance', 'high',
--     'last_updated', to_char(CURRENT_DATE, 'YYYY-MM-DD')
--   ),
--   updated_at = NOW()
-- WHERE id = '7755438e-ce50-49a1-b19d-811095f7aeaf';