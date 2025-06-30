import { SimplifiedMemorySystem } from '../lib/simplified-memory';
import { supabaseAdmin } from '../lib/supabase';

async function testMemoryStorage() {
  console.log('Testing Memory Storage for EnhancedQAAgent');
  console.log('='.repeat(50));

  const memory = new SimplifiedMemorySystem('EnhancedQAAgent', {
    ttlSeconds: 180, // 3 minutes
    maxEntries: 100
  });

  try {
    // Step 1: Clear any existing memory
    console.log('\n1. Clearing existing memory...');
    await supabaseAdmin
      .from('agent_memory')
      .delete()
      .eq('agent_name', 'EnhancedQAAgent');
    console.log('✅ Memory cleared');

    // Step 2: Add test messages
    console.log('\n2. Adding test messages...');
    await memory.addMessage('user', 'エンジニアカフェの営業時間は？', {
      emotion: 'curious',
      sessionId: 'test_session_123'
    });
    console.log('✅ Added user message');

    await memory.addMessage('assistant', 'エンジニアカフェの営業時間は9:00〜22:00です。', {
      emotion: 'helpful',
      sessionId: 'test_session_123'
    });
    console.log('✅ Added assistant message');

    // Step 3: Test getContext with a memory-related question
    console.log('\n3. Testing getContext with memory-related question...');
    const memoryContext = await memory.getContext('さっき僕が何を聞いた？', {
      includeKnowledgeBase: false,
      language: 'ja'
    });

    console.log('Memory context result:');
    console.log('- Recent messages count:', memoryContext.recentMessages.length);
    console.log('- Context string:', memoryContext.contextString);
    console.log('- Recent messages:', JSON.stringify(memoryContext.recentMessages, null, 2));

    // Step 4: Verify messages in database
    console.log('\n4. Verifying messages in database...');
    const { data: dbMessages, error } = await supabaseAdmin
      .from('agent_memory')
      .select('*')
      .eq('agent_name', 'EnhancedQAAgent')
      .like('key', 'message_%')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching from database:', error);
    } else {
      console.log('✅ Found', dbMessages?.length || 0, 'messages in database');
      if (dbMessages && dbMessages.length > 0) {
        dbMessages.forEach((msg, index) => {
          console.log(`\nMessage ${index + 1}:`);
          console.log('- Key:', msg.key);
          console.log('- Value:', JSON.stringify(msg.value, null, 2));
          console.log('- Expires at:', msg.expires_at);
        });
      }
    }

    // Step 5: Test with a follow-up question
    console.log('\n5. Testing follow-up question...');
    await memory.addMessage('user', 'じゃ、定休日はいつ？', {
      emotion: 'curious',
      sessionId: 'test_session_123'
    });

    const followUpContext = await memory.getContext('じゃ、定休日はいつ？', {
      includeKnowledgeBase: false,
      language: 'ja'
    });

    console.log('Follow-up context result:');
    console.log('- Recent messages count:', followUpContext.recentMessages.length);
    console.log('- Should contain 3 messages (2 previous + 1 new)');

    // Step 6: Test memory expiration
    console.log('\n6. Testing memory stats...');
    const stats = await memory.getMemoryStats();
    console.log('Memory stats:', JSON.stringify(stats, null, 2));

    // Step 7: Test isConversationActive
    console.log('\n7. Testing isConversationActive...');
    const isActive = await memory.isConversationActive();
    console.log('Is conversation active?', isActive);

    // Step 8: Test session summary
    console.log('\n8. Testing session summary...');
    const summary = await memory.getSessionSummary('ja');
    console.log('Session summary:', summary);

    console.log('\n✅ All memory storage tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testMemoryStorage().catch(console.error);