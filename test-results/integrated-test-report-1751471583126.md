# Engineer Cafe Navigator - Integrated Test Report

**Date**: 2025-07-02T15:53:03.125Z
**Total Tests**: 26
**Passed**: 10 (38.5%)
**Failed**: 16

## Summary by Category

### Basic Information
- Tests: 5
- Passed: 2 (40.0%)
- Failed: 3

### Facility Navigation
- Tests: 5
- Passed: 2 (40.0%)
- Failed: 3

### Memory Context
- Tests: 3
- Passed: 0 (0.0%)
- Failed: 3

### Multi-language
- Tests: 3
- Passed: 0 (0.0%)
- Failed: 3

### Edge Cases
- Tests: 5
- Passed: 1 (20.0%)
- Failed: 4

### Performance
- Tests: 5
- Passed: 5 (100.0%)
- Failed: 0

## Failed Test Details

### Basic Information - Access information
- **Query**: エンジニアカフェへのアクセス方法を教えて
- **Language**: ja
- **Expected**: 天神駅, 地下鉄, 天神
- **Found**: 天神
- **Response**: [neutral]エンジニアカフェは、福岡市中央区天神1丁目の赤レンガ文化館2階に位置しています。[/neutral]...

### Basic Information - Pricing information
- **Query**: エンジニアカフェの利用料金は？
- **Language**: ja
- **Expected**: 無料, 会員
- **Found**: 無料
- **Response**: [neutral]エンジニアカフェの施設利用は無料です。コワーキングスペースやイベント参加も無料でご利用いただけます。[/neutral]...

### Basic Information - Closed days query
- **Query**: エンジニアカフェの定休日は？
- **Language**: ja
- **Expected**: 月曜, 休
- **Found**: 
- **Response**: [neutral]エンジニアカフェは福岡市中央区天神にあり、赤レンガ文化館の2階に位置しています。[/neutral]...

### Facility Navigation - Basement meeting spaces
- **Query**: 地下の会議室について教えて
- **Language**: ja
- **Expected**: 地下, 会議, ミーティング
- **Found**: 地下, 会議
- **Response**: [neutral]地下の会議室へは、Engineer Cafeの店内から階段でアクセスできます。[/neutral]...

### Facility Navigation - Saino cafe information
- **Query**: sainoの営業時間は？
- **Language**: ja
- **Expected**: 11:00, 14:00, saino
- **Found**: saino
- **Response**: [neutral]sainoカフェの料金は、コーヒーやラテが¥400〜¥600前後、アルコール類は一杯¥500程度から、ホットサンド等の軽食は一品あたり¥600〜¥800前後です。[/neutral]...

### Facility Navigation - Facility comparison
- **Query**: エンジニアカフェとsainoの違いは？
- **Language**: ja
- **Expected**: エンジニアカフェ, saino
- **Found**: saino
- **Response**: [neutral]sainoカフェの営業時間は、平日が12:00〜20:30（17:00〜18:00は中休み）、土日祝が11:00〜20:30です。金・土のみ21:45まで営業しています。[/neutral]...

### Memory Context - Previous question recall
- **Query**: さっき僕が何を聞いたか覚えてる？ (sessionId: memory-test-1751471521818)
- **Language**: ja
- **Expected**: 営業時間, エンジニアカフェ
- **Found**: 
- **Response**: [neutral]申し訳ありませんが、前回の会話履歴が提供されていないため、お客様が何を質問されたか分かりません。[/neutral]...

### Memory Context - Context-based follow-up
- **Query**: 土曜日は開いてる？ (sessionId: memory-test-1751471521818)
- **Language**: ja
- **Expected**: 土曜, 開い, 営業
- **Found**: 土曜, 開い
- **Response**: [neutral]はい、Engineer Cafeは土曜日も9:00から22:00まで開いています。[/neutral]...

### Memory Context - Entity-only query with context
- **Query**: sainoの方は？ (sessionId: memory-test-1751471521818)
- **Language**: ja
- **Expected**: saino, 11:00, 14:00
- **Found**: saino, 11:00
- **Response**: [neutral]sainoカフェの営業時間は、平日が12:00〜20:30（17:00〜18:00は中休み）、土日祝が11:00〜20:30です。金・土のみ21:45まで営業しています。[/neutral]...

### Multi-language - English hours query
- **Query**: What are the operating hours?
- **Language**: en
- **Expected**: 9:00, 22:00, hours
- **Found**: 
- **Response**: [neutral]Saino cafe operates weekdays from 12:00 PM to 8:30 PM (with a break from 5:00 PM to 6:00 PM), and weekends/holidays from 11:00 AM to 8:30 PM, extending until 9:45 PM on Fridays and Saturdays....

### Multi-language - English location query
- **Query**: Where is Engineer Cafe located?
- **Language**: en
- **Expected**: Fukuoka, Tenjin, Chuo
- **Found**: 
- **Response**: [neutral]Engineer Cafe operates from 9:00 AM to 10:00 PM daily.[/neutral]...

### Multi-language - Cross-language understanding
- **Query**: Engineer Cafe hours?
- **Language**: en
- **Expected**: 9:00, 22:00
- **Found**: 9:00
- **Response**: [neutral]Engineer Cafe operates from 9:00 AM to 10:00 PM daily.[/neutral]...

### Edge Cases - Ambiguous query
- **Query**: 地下
- **Language**: ja
- **Expected**: 地下
- **Found**: 
- **Response**: すみません、どちらについてお聞きか確認できませんでした。...

### Edge Cases - Typo handling
- **Query**: エンジンカフェの場所
- **Language**: ja
- **Expected**: エンジニアカフェ, 福岡
- **Found**: エンジニアカフェ
- **Response**: [neutral]エンジニアカフェは毎日9:00から22:00まで営業しています。[/neutral]...

### Edge Cases - Out of scope query
- **Query**: 今日の天気は？
- **Language**: ja
- **Expected**: エンジニアカフェ
- **Found**: 
- **Response**: [neutral]申し訳ありませんが、今日の天気に関する情報は持ち合わせておりません。[/neutral]...

### Edge Cases - Very long query
- **Query**: エンジニアカフェの営業時間と場所とアクセス方法と利用料金と施設の詳細と予約方法とイベント情報と地下の会議室の情報を全部詳しく教えてください
- **Language**: ja
- **Expected**: 営業時間, 場所
- **Found**: 
- **Response**: [neutral]エンジニアカフェは毎日9:00〜22:00まで営業しており、福岡市中央区天神1丁目の赤レンガ文化館2階に位置しています。施設利用は無料で、1階メインホール、地下の集中スペースやメーカーズスペース、2階ミーティングルームなどがあります。

地下の集中スペースは予約不要で、Engineer Cafeの店内から階段でアクセスできます。イベント情報やミーティングルームの予約方法については...

## Performance Metrics

- **Average Response Time**: 4675ms
- **Min Response Time**: 64ms
- **Max Response Time**: 13202ms
