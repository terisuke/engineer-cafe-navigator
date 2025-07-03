#!/usr/bin/env tsx

/**
 * 完全統合テスト - すべての問題が修正されていることを証明
 */

async function runCompleteIntegrationTest() {
  console.log('🔍 完全統合テスト');
  console.log('================================================================================');
  console.log('ユーザーが報告した4つの問題すべてを検証します');
  console.log('================================================================================\n');

  const issues = {
    sttCorrection: false,
    surprisedExpression: false,
    unnecessaryClarification: false,
    contextMemory: false,
    correctEntity: false
  };

  // 1. STT補正テスト
  console.log('1️⃣ STT補正テスト - "才能 cafe" → "サイノカフェ"');
  try {
    const response = await fetch('http://localhost:3000/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_text',
        text: 'じゃ 才能 cafeの方で。',
        sessionId: 'test_stt_' + Date.now(),
        language: 'ja'
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.response && data.response.includes('サイノカフェ')) {
        console.log('  ✅ STT補正が正常に動作');
        console.log('  Response preview:', data.response.substring(0, 100) + '...');
        issues.sttCorrection = true;
      } else {
        console.log('  ❌ STT補正が機能していません');
      }
    } else {
      console.log('  ❌ APIエラー:', response.status);
    }
  } catch (error) {
    console.log('  ❌ エラー:', error.message);
  }

  // 2. Surprised表情テスト
  console.log('\n2️⃣ Surprised表情エラーテスト');
  try {
    const response = await fetch('http://localhost:3000/api/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setExpression',
        expression: 'surprised',
        transitionDuration: 0.5
      })
    });

    if (response.ok) {
      console.log('  ✅ Surprised表情が正常に設定可能');
      console.log('  （CharacterAvatarで surprised → curious にマッピング）');
      issues.surprisedExpression = true;
    } else {
      console.log('  ❌ Surprised表情エラーが残っています');
    }
  } catch (error) {
    console.log('  ❌ エラー:', error.message);
  }

  // 3. 不必要な聞き返しテスト
  console.log('\n3️⃣ 不必要な聞き返しテスト');
  const sessionId = 'test_context_' + Date.now();
  
  try {
    // Step 1: カフェの営業時間について聞く
    console.log('  Step 1: "カフェの営業時間について教えて。"');
    const response1 = await fetch('http://localhost:3000/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ask_question',
        question: 'カフェの営業時間について教えて。',
        sessionId: sessionId,
        language: 'ja'
      })
    });

    if (response1.ok) {
      const data1 = await response1.json();
      console.log('    Agent:', data1.agentName);
      console.log('    Response preview:', data1.answer?.substring(0, 100) + '...');
      
      // ClarificationAgentが適切に応答することを確認
      if (data1.agentName === 'ClarificationAgent') {
        console.log('    ✅ 曖昧なカフェクエリで適切に確認');
      }
    }

    // Step 2: サイノカフェを選択
    console.log('\n  Step 2: "サイノカフェの方で。"');
    const response2 = await fetch('http://localhost:3000/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ask_question',
        question: 'サイノカフェの方で。',
        sessionId: sessionId,
        language: 'ja'
      })
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('    Agent:', data2.agentName);
      console.log('    Response preview:', data2.answer?.substring(0, 100) + '...');
      
      if (data2.agentName !== 'ClarificationAgent') {
        console.log('    ✅ 不必要な聞き返しを回避');
        issues.unnecessaryClarification = true;
      } else {
        console.log('    ❌ まだ不必要な聞き返しが発生');
      }
    }

    // Step 3: 営業時間の質問（文脈テスト）
    console.log('\n  Step 3: "営業時間は？"（文脈保持テスト）');
    const response3 = await fetch('http://localhost:3000/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ask_question',
        question: '営業時間は？',
        sessionId: sessionId,
        language: 'ja'
      })
    });

    if (response3.ok) {
      const data3 = await response3.json();
      console.log('    Agent:', data3.agentName);
      console.log('    Response:', data3.answer);
      
      // サイノカフェの営業時間が返されているか確認
      if (data3.answer && (data3.answer.includes('サイノ') || data3.answer.includes('saino'))) {
        console.log('    ✅ サイノカフェの文脈を正しく保持');
        issues.contextMemory = true;
        issues.correctEntity = true;
      } else if (data3.answer && data3.answer.includes('9:00') && data3.answer.includes('22:00')) {
        console.log('    ❌ エンジニアカフェの営業時間を返しています（文脈喪失）');
      } else {
        console.log('    ❌ 予期しない応答');
      }
    }
  } catch (error) {
    console.log('  ❌ エラー:', error.message);
  }

  // 結果サマリー
  console.log('\n================================================================================');
  console.log('📊 テスト結果サマリー');
  console.log('================================================================================');
  
  const results = [
    { name: 'STT補正（才能→サイノ）', passed: issues.sttCorrection },
    { name: 'Surprised表情エラー修正', passed: issues.surprisedExpression },
    { name: '不必要な聞き返し防止', passed: issues.unnecessaryClarification },
    { name: '文脈の保持', passed: issues.contextMemory },
    { name: '正しいエンティティの返答', passed: issues.correctEntity }
  ];

  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const passRate = Math.round(passedCount / totalCount * 100);

  console.log(`\n成功率: ${passedCount}/${totalCount} (${passRate}%)`);

  if (passedCount === totalCount) {
    console.log('\n🎉 すべての問題が解決されました！');
    console.log('\n実装された修正:');
    console.log('1. CharacterAvatar: surprised → curious マッピング');
    console.log('2. STTCorrection: 包括的な日本語誤認識対応');
    console.log('3. QueryClassifier: サイノカフェの明示的な分類');
    console.log('4. BusinessInfoAgent: 文脈エンティティの継承');
  } else {
    console.log('\n⚠️  まだ解決されていない問題があります');
  }

  console.log('\n================================================================================');
}

// テスト実行
runCompleteIntegrationTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});