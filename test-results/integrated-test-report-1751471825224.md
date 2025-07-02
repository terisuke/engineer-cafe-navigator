# Engineer Cafe Navigator - Integrated Test Report

**Date**: 2025-07-02T15:57:05.224Z
**Total Tests**: 26
**Passed**: 18 (69.2%)
**Failed**: 8

## Summary by Category

### Basic Information
- Tests: 5
- Passed: 3 (60.0%)
- Failed: 2

### Facility Navigation
- Tests: 5
- Passed: 3 (60.0%)
- Failed: 2

### Memory Context
- Tests: 3
- Passed: 1 (33.3%)
- Failed: 2

### Multi-language
- Tests: 3
- Passed: 2 (66.7%)
- Failed: 1

### Edge Cases
- Tests: 5
- Passed: 4 (80.0%)
- Failed: 1

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
- **Response**: エンジニアカフェは福岡市中央区天神にある赤レンガ文化館の2階に位置しています。...

### Basic Information - Pricing information
- **Query**: エンジニアカフェの利用料金は？
- **Language**: ja
- **Expected**: 無料, 会員
- **Found**: 無料
- **Response**: エンジニアカフェの施設利用料、コワーキングスペース利用、イベント参加・開催、デジタル工作機材の利用は無料です。ドリンクや軽食は有料で、コーヒーやラテが400円〜600円前後、軽食が600円〜800円前後です。...

### Facility Navigation - Basement meeting spaces
- **Query**: 地下の会議室について教えて
- **Language**: ja
- **Expected**: 地下, 会議, ミーティング
- **Found**: 
- **Response**: 申し訳ございません。お探しの情報が見つかりませんでした。質問を言い換えていただくか、スタッフにお問い合わせください。...

### Facility Navigation - Saino cafe information
- **Query**: sainoの営業時間は？
- **Language**: ja
- **Expected**: 11:00, 14:00, saino
- **Found**: 11:00, saino
- **Response**: sainoカフェの営業時間は、平日が12:00〜20:30（17:00〜18:00は中休み）、土日祝が11:00〜20:30です。金・土のみ21:45まで営業します。...

### Memory Context - Context-based follow-up
- **Query**: 土曜日は開いてる？ (sessionId: memory-test-1751471781593)
- **Language**: ja
- **Expected**: 土曜, 開い, 営業
- **Found**: 
- **Response**: 申し訳ございません。お探しの情報が見つかりませんでした。質問を言い換えていただくか、スタッフにお問い合わせください。...

### Memory Context - Entity-only query with context
- **Query**: sainoの方は？ (sessionId: memory-test-1751471781593)
- **Language**: ja
- **Expected**: saino, 11:00, 14:00
- **Found**: 
- **Response**: 申し訳ございません。お探しの情報が見つかりませんでした。質問を言い換えていただくか、スタッフにお問い合わせください。...

### Multi-language - English hours query
- **Query**: What are the operating hours?
- **Language**: en
- **Expected**: 9:00, 22:00, hours
- **Found**: 9:00, 22:00
- **Response**: 9:00 to 22:00 daily....

### Edge Cases - Very long query
- **Query**: エンジニアカフェの営業時間と場所とアクセス方法と利用料金と施設の詳細と予約方法とイベント情報と地下の会議室の情報を全部詳しく教えてください
- **Language**: ja
- **Expected**: 営業時間, 場所
- **Found**: 営業時間
- **Response**: エンジニアカフェの営業時間は9:00〜22:00です。休館日は毎月最終月曜日（祝日の場合は翌平日）と年末年始（12/29〜1/3）です。...

## Performance Metrics

- **Average Response Time**: 3958ms
- **Min Response Time**: 903ms
- **Max Response Time**: 14552ms
