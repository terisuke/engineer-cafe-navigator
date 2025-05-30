import { EmotionManager } from '../src/lib/emotion-manager';

async function testEmotionSystem() {
  console.log('🎭 Testing Emotion Detection and VRM Mapping System\n');

  // Test 1: Basic emotion detection (Japanese)
  console.log('1️⃣ Testing Japanese emotion detection...');
  const testTextsJa = [
    'こんにちは、エンジニアカフェへようこそ！とても嬉しいです。',
    '困ったことがあります。悲しいです。',
    '本当に腹立つなあ。こんなことは許せない！',
    'びっくりしました！信じられないことです。',
    'うーん、どうしよう。よく考えてみます。',
    'つまり、これについて説明させていただきます。',
  ];

  testTextsJa.forEach((text, index) => {
    const emotion = EmotionManager.detectEmotion(text, 'ja');
    const mapping = EmotionManager.mapEmotionToVRM(emotion);
    console.log(`   Text ${index + 1}: "${text.substring(0, 30)}..."`);
    console.log(`   Emotion: ${emotion.emotion} (intensity: ${emotion.intensity.toFixed(2)}, confidence: ${emotion.confidence.toFixed(2)})`);
    console.log(`   VRM Expression: ${mapping.primary}${mapping.secondary ? ` + ${mapping.secondary}` : ''} (weight: ${mapping.weight.toFixed(2)})`);
    console.log();
  });

  // Test 2: Basic emotion detection (English)
  console.log('2️⃣ Testing English emotion detection...');
  const testTextsEn = [
    'Hello! Welcome to Engineer Cafe! I am so happy to see you.',
    'I am really sad about this situation. This is troubling.',
    'This makes me really angry! I cannot forgive this behavior.',
    'Wow, that is really surprising! I cannot believe it.',
    'Hmm, let me think about this carefully.',
    'Let me explain this concept to you in detail.',
  ];

  testTextsEn.forEach((text, index) => {
    const emotion = EmotionManager.detectEmotion(text, 'en');
    const mapping = EmotionManager.mapEmotionToVRM(emotion);
    console.log(`   Text ${index + 1}: "${text.substring(0, 40)}..."`);
    console.log(`   Emotion: ${emotion.emotion} (intensity: ${emotion.intensity.toFixed(2)}, confidence: ${emotion.confidence.toFixed(2)})`);
    console.log(`   VRM Expression: ${mapping.primary}${mapping.secondary ? ` + ${mapping.secondary}` : ''} (weight: ${mapping.weight.toFixed(2)})`);
    console.log();
  });

  // Test 3: Conversation context emotion detection
  console.log('3️⃣ Testing conversation context emotion detection...');
  const userInput = 'こんにちは！今日はいい天気ですね。';
  const aiResponse = 'はい、本当にそうですね！とても気持ちの良い日です。';
  const context = ['昨日は雨でした', '今日は晴れて嬉しいです', '散歩に行きたいと思います'];

  const contextEmotion = EmotionManager.detectConversationEmotion(userInput, aiResponse, context, 'ja');
  const contextMapping = EmotionManager.mapEmotionToVRM(contextEmotion);

  console.log(`   User: "${userInput}"`);
  console.log(`   AI: "${aiResponse}"`);
  console.log(`   Context: ${context.join(' | ')}`);
  console.log(`   Detected emotion: ${contextEmotion.emotion} (intensity: ${contextEmotion.intensity.toFixed(2)}, confidence: ${contextEmotion.confidence.toFixed(2)})`);
  console.log(`   VRM mapping: ${contextMapping.primary}${contextMapping.secondary ? ` + ${contextMapping.secondary}` : ''}`);
  console.log();

  // Test 4: Interaction-specific emotions
  console.log('4️⃣ Testing interaction-specific emotions...');
  const interactions = ['welcome', 'question', 'explanation', 'goodbye', 'error', 'thinking'] as const;
  
  interactions.forEach(interaction => {
    const emotion = EmotionManager.getEmotionForInteraction(interaction);
    const mapping = EmotionManager.mapEmotionToVRM(emotion);
    console.log(`   ${interaction}: ${emotion.emotion} → ${mapping.primary} (weight: ${mapping.weight.toFixed(2)})`);
  });
  console.log();

  // Test 5: Emotion transition
  console.log('5️⃣ Testing emotion transitions...');
  const fromEmotion = EmotionManager.detectEmotion('とても悲しいです', 'ja');
  const toEmotion = EmotionManager.detectEmotion('今は嬉しいです', 'ja');
  
  console.log(`   From: ${fromEmotion.emotion} → To: ${toEmotion.emotion}`);
  [0, 0.25, 0.5, 0.75, 1.0].forEach(progress => {
    const transition = EmotionManager.createEmotionTransition(fromEmotion, toEmotion, progress);
    console.log(`   Progress ${(progress * 100).toFixed(0)}%: ${transition.primary}${transition.secondary ? ` + ${transition.secondary}` : ''} (weight: ${transition.weight.toFixed(2)})`);
  });
  console.log();

  // Test 6: Available features
  console.log('6️⃣ Testing available features...');
  const availableExpressions = EmotionManager.getAvailableExpressions();
  console.log(`   Available expressions: ${availableExpressions.join(', ')}`);
  
  const supportedCheck = ['happy', 'sad', 'unknown_emotion'];
  supportedCheck.forEach(emotion => {
    console.log(`   Is "${emotion}" supported? ${EmotionManager.isEmotionSupported(emotion)}`);
  });

  console.log('\n✨ Emotion system tests completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Test with real VRM character in browser');
  console.log('   2. Test with voice conversation flow');
  console.log('   3. Verify smooth expression transitions');
}

testEmotionSystem().catch(console.error);