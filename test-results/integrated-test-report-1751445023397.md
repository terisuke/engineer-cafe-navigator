# Engineer Cafe Navigator - Integrated Test Report

**Date**: 2025-07-02T08:30:23.396Z
**Total Tests**: 26
**Passed**: 6 (23.1%)
**Failed**: 20

## Summary by Category

### Basic Information
- Tests: 5
- Passed: 0 (0.0%)
- Failed: 5

### Facility Navigation
- Tests: 5
- Passed: 0 (0.0%)
- Failed: 5

### Memory Context
- Tests: 3
- Passed: 0 (0.0%)
- Failed: 3

### Multi-language
- Tests: 3
- Passed: 1 (33.3%)
- Failed: 2

### Edge Cases
- Tests: 5
- Passed: 0 (0.0%)
- Failed: 5

### Performance
- Tests: 5
- Passed: 5 (100.0%)
- Failed: 0

## Failed Test Details

### Basic Information - Operating hours query
- **Query**: エンジニアカフェの営業時間は？
- **Language**: ja
- **Expected**: 9:00, 22:00, 営業時間
- **Found**: 9:00, 22:00
- **Response**: [neutral]エンジニアカフェは9:00から22:00まで営業しています。

初めての方は受付で簡単な登録をお願いしています。[/neutral]...

### Basic Information - Location query
- **Query**: エンジニアカフェの場所はどこですか？
- **Language**: ja
- **Expected**: 日進市, 愛知県, 竹の山
- **Found**: 
- **Response**: [neutral]申し訳ございませんが、エンジニアカフェの場所に関する具体的な情報は見つかりませんでした。

初めての方は受付で簡単な登録をお願いしています。[/neutral]...

### Basic Information - Access information
- **Query**: エンジニアカフェへのアクセス方法を教えて
- **Language**: ja
- **Expected**: 赤池駅, バス, 竹の山
- **Found**: 
- **Response**: [neutral]申し訳ございませんが、エンジニアカフェへのアクセス方法に関する具体的な情報は見つかりませんでした。[/neutral]...

### Basic Information - Pricing information
- **Query**: エンジニアカフェの利用料金は？
- **Language**: ja
- **Expected**: 無料, 会員
- **Found**: 
- **Response**: [neutral]申し訳ございませんが、エンジニアカフェの利用料金に関する具体的な情報は見つかりませんでした。[/neutral]...

### Basic Information - Closed days query
- **Query**: エンジニアカフェの定休日は？
- **Language**: ja
- **Expected**: 月曜, 休
- **Found**: 
- **Response**: [neutral]エンジニアカフェは福岡県福岡市中央区天神1丁目10-13にございます。[/neutral]...

### Facility Navigation - Basement meeting spaces
- **Query**: 地下の会議室について教えて
- **Language**: ja
- **Expected**: 地下, 会議, ミーティング
- **Found**: 地下, 会議
- **Response**: [neutral]申し訳ございませんが、地下の会議室に関する具体的な情報は見つかりませんでした。[/neutral]...

### Facility Navigation - Saino cafe information
- **Query**: sainoの営業時間は？
- **Language**: ja
- **Expected**: 11:00, 14:00, saino
- **Found**: saino
- **Response**: [neutral]申し訳ございませんが、sainoカフェの営業時間に関する情報は見つかりませんでした。[/neutral]...

### Facility Navigation - Specific facility - Focus Space
- **Query**: 地下のフォーカススペースの利用方法
- **Language**: ja
- **Expected**: 地下, フォーカス, 予約
- **Found**: 地下, フォーカス
- **Response**: [neutral]申し訳ございませんが、地下のフォーカススペースの利用方法に関する具体的な情報は見つかりませんでした。[/neutral]...

### Facility Navigation - Aka-Renga information
- **Query**: 赤レンガについて教えて
- **Language**: ja
- **Expected**: 赤レンガ, 文化
- **Found**: 赤レンガ
- **Response**: [neutral]申し訳ございませんが、赤レンガに関する具体的な情報は見つかりませんでした。[/neutral]...

### Facility Navigation - Facility comparison
- **Query**: エンジニアカフェとsainoの違いは？
- **Language**: ja
- **Expected**: エンジニアカフェ, saino
- **Found**: saino
- **Response**: [neutral]sainoカフェの営業時間は、月曜日から土曜日が11:00～22:00、日曜日と祝日が11:00～20:00です。[/neutral]...

### Memory Context - Previous question recall
- **Query**: さっき僕が何を聞いたか覚えてる？ (sessionId: memory-test-1751444959824)
- **Language**: ja
- **Expected**: 営業時間, エンジニアカフェ
- **Found**: 
- **Response**: [neutral]申し訳ありませんが、以前の会話の履歴が提供されていないため、直前の質問が何だったか分かりません。もう一度質問していただけますか？[/neutral]...

### Memory Context - Context-based follow-up
- **Query**: 土曜日は開いてる？ (sessionId: memory-test-1751444959824)
- **Language**: ja
- **Expected**: 土曜, 開い, 営業
- **Found**: 土曜, 営業
- **Response**: [neutral]sainoカフェは土曜日も11:00から22:00まで営業しています。[/neutral]...

### Memory Context - Entity-only query with context
- **Query**: sainoの方は？ (sessionId: memory-test-1751444959824)
- **Language**: ja
- **Expected**: saino, 11:00, 14:00
- **Found**: saino, 11:00
- **Response**: [neutral]sainoカフェの営業時間は、月曜日から土曜日が11:00～22:00、日曜日と祝日が11:00～20:00です。[/neutral]...

### Multi-language - English hours query
- **Query**: What are the operating hours?
- **Language**: en
- **Expected**: 9:00, 22:00, hours
- **Found**: 9:00, 22:00
- **Response**: I couldn't find specific information about that in my knowledge base. 
                Engineer Cafe is open from 9:00 to 22:00 daily, a coworking space in Fukuoka designed for IT engineers....

### Multi-language - English location query
- **Query**: Where is Engineer Cafe located?
- **Language**: en
- **Expected**: Nisshin, Aichi, Takenoyama
- **Found**: 
- **Response**: [neutral]エンジニアカフェは福岡県福岡市中央区天神1丁目10-13にございます。[/neutral]...

### Edge Cases - Ambiguous query
- **Query**: 地下
- **Language**: ja
- **Expected**: 地下
- **Found**: 
- **Response**: すみません、どちらについてお聞きか確認できませんでした。...

### Edge Cases - Typo handling
- **Query**: エンジンカフェの場所
- **Language**: ja
- **Expected**: エンジニアカフェ, 日進
- **Found**: エンジニアカフェ
- **Response**: コワーキングスペースのエンジニアカフェのことですか、それとも併設のカフェ＆バーのsainoカフェのことですか？...

### Edge Cases - Multiple entities query
- **Query**: エンジニアカフェとsainoと赤レンガの営業時間を全部教えて
- **Language**: ja
- **Expected**: エンジニアカフェ, saino, 赤レンガ
- **Found**: saino
- **Response**: [neutral]sainoカフェの営業時間は、月曜日から土曜日が11:00～22:00、日曜日と祝日が11:00～20:00です。[/neutral]...

### Edge Cases - Out of scope query
- **Query**: 今日の天気は？
- **Language**: ja
- **Expected**: エンジニアカフェ
- **Found**: 
- **Response**: [neutral]申し訳ございませんが、今日の天気に関する情報は見つかりませんでした。[/neutral]...

### Edge Cases - Very long query
- **Query**: エンジニアカフェの営業時間と場所とアクセス方法と利用料金と施設の詳細と予約方法とイベント情報と地下の会議室の情報を全部詳しく教えてください
- **Language**: ja
- **Expected**: 営業時間, 場所
- **Found**: 
- **Response**: [neutral]エンジニアカフェは9:00から22:00まで営業しており、福岡県福岡市中央区天神1丁目10-13にございます。ITエンジニア向けのコワーキングスペースですが、アクセス方法、利用料金、予約方法、イベント情報、地下の会議室に関する具体的な情報は提供されていません。[/neutral]...

## Performance Metrics

- **Average Response Time**: 4636ms
- **Min Response Time**: 76ms
- **Max Response Time**: 32305ms
