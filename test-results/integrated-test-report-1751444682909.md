# Engineer Cafe Navigator - Integrated Test Report

**Date**: 2025-07-02T08:24:42.908Z
**Total Tests**: 26
**Passed**: 5 (19.2%)
**Failed**: 21

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
- Passed: 0 (0.0%)
- Failed: 3

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
- **Found**: 
- **Response**: コワーキングスペースのエンジニアカフェのことですか、それとも併設のカフェ＆バーのsainoカフェのことですか？...

### Basic Information - Location query
- **Query**: エンジニアカフェの場所はどこですか？
- **Language**: ja
- **Expected**: 日進市, 愛知県, 竹の山
- **Found**: 
- **Response**: コワーキングスペースのエンジニアカフェのことですか、それとも併設のカフェ＆バーのsainoカフェのことですか？...

### Basic Information - Access information
- **Query**: エンジニアカフェへのアクセス方法を教えて
- **Language**: ja
- **Expected**: 赤池駅, バス, 竹の山
- **Found**: 
- **Response**: コワーキングスペースのエンジニアカフェのことですか、それとも併設のカフェ＆バーのsainoカフェのことですか？...

### Basic Information - Pricing information
- **Query**: エンジニアカフェの利用料金は？
- **Language**: ja
- **Expected**: 無料, 会員
- **Found**: 
- **Response**: [neutral]エンジニアカフェの利用料金については、現在具体的な情報が見つかりませんでした。[/neutral]...

### Basic Information - Closed days query
- **Query**: エンジニアカフェの定休日は？
- **Language**: ja
- **Expected**: 月曜, 休
- **Found**: 
- **Response**: [neutral]エンジニアカフェの営業時間ですね。コワーキングスペースのエンジニアカフェと、併設のカフェ＆バーsainoカフェでは営業時間が異なります。どちらの営業時間をお知りになりたいですか？[/neutral]...

### Facility Navigation - Basement meeting spaces
- **Query**: 地下の会議室について教えて
- **Language**: ja
- **Expected**: 地下, 会議, ミーティング
- **Found**: 地下, 会議
- **Response**: [neutral]エンジニアカフェ（コワーキングスペース）は年中無休です。
地下には貸し会議室があり、予約してご利用いただけます。[/neutral]...

### Facility Navigation - Saino cafe information
- **Query**: sainoの営業時間は？
- **Language**: ja
- **Expected**: 11:00, 14:00, saino
- **Found**: 11:00, saino
- **Response**: [neutral]sainoカフェの営業時間は、月曜日から土曜日の11:00から22:00までです。日曜日は定休日です。[/neutral]...

### Facility Navigation - Specific facility - Focus Space
- **Query**: 地下のフォーカススペースの利用方法
- **Language**: ja
- **Expected**: 地下, フォーカス, 予約
- **Found**: 地下, フォーカス
- **Response**: [neutral]地下のフォーカススペースは9:00から22:00までご利用いただけます。[/neutral]...

### Facility Navigation - Aka-Renga information
- **Query**: 赤レンガについて教えて
- **Language**: ja
- **Expected**: 赤レンガ, 文化
- **Found**: 赤レンガ
- **Response**: [neutral]赤レンガについては、現在情報が見つかりませんでした。[/neutral]...

### Facility Navigation - Facility comparison
- **Query**: エンジニアカフェとsainoの違いは？
- **Language**: ja
- **Expected**: エンジニアカフェ, saino
- **Found**: saino
- **Response**: [neutral]sainoカフェの営業時間は、月曜日から土曜日が11:00～22:00、日曜日と祝日が11:00～20:00です。[/neutral]...

### Memory Context - Previous question recall
- **Query**: さっき僕が何を聞いたか覚えてる？ (sessionId: memory-test-1751444631965)
- **Language**: ja
- **Expected**: 営業時間, エンジニアカフェ
- **Found**: 
- **Response**: [neutral]申し訳ありませんが、以前の会話の履歴が提供されていないため、直前の質問が何だったか分かりません。もう一度質問していただけますか？[/neutral]...

### Memory Context - Context-based follow-up
- **Query**: 土曜日は開いてる？ (sessionId: memory-test-1751444631965)
- **Language**: ja
- **Expected**: 土曜, 開い, 営業
- **Found**: 土曜, 営業
- **Response**: [neutral]はい、エンジニアカフェは年中無休で、sainoカフェは月曜日から土曜日の11:00から22:00まで営業していますので、どちらも土曜日はご利用いただけます。[/neutral]...

### Memory Context - Entity-only query with context
- **Query**: sainoの方は？ (sessionId: memory-test-1751444631965)
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
- **Response**: Are you asking about Engineer Cafe (the coworking space) or Saino Cafe (the attached cafe & bar)?...

### Multi-language - Cross-language understanding
- **Query**: Engineer Cafe hours?
- **Language**: en
- **Expected**: 9:00, 22:00
- **Found**: 
- **Response**: Are you asking about Engineer Cafe (the coworking space) or Saino Cafe (the attached cafe & bar)?...

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
- **Found**: エンジニアカフェ, saino
- **Response**: コワーキングスペースのエンジニアカフェのことですか、それとも併設のカフェ＆バーのsainoカフェのことですか？...

### Edge Cases - Out of scope query
- **Query**: 今日の天気は？
- **Language**: ja
- **Expected**: エンジニアカフェ
- **Found**: 
- **Response**: [neutral]今日の天気については、現在情報が見つかりませんでした。[/neutral]...

### Edge Cases - Very long query
- **Query**: エンジニアカフェの営業時間と場所とアクセス方法と利用料金と施設の詳細と予約方法とイベント情報と地下の会議室の情報を全部詳しく教えてください
- **Language**: ja
- **Expected**: 営業時間, 場所
- **Found**: 場所
- **Response**: [neutral]エンジニアカフェは年中無休で9:00から22:00まで営業しており、地下には予約可能な貸し会議室と9:00から22:00まで利用できるフォーカススペースがあります。併設のsainoカフェは月～土が11:00～22:00、日祝が11:00～20:00ですが、利用料金、場所、アクセス方法、イベント情報、具体的な予約方法については現在情報が見つかりません。[/neutral]...

## Performance Metrics

- **Average Response Time**: 3493ms
- **Min Response Time**: 102ms
- **Max Response Time**: 18759ms
