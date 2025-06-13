// Use native fetch in Node.js 18+

interface TestCase {
  question: string;
  language: 'ja' | 'en';
  expectedKeywords: string[];
}

async function testQAEndpoint() {
  const baseUrl = 'http://localhost:3000';
  
  const testCases: TestCase[] = [
    {
      question: 'エンジニアカフェの公式サイトは？',
      language: 'ja',
      expectedKeywords: ['engineercafe.jp', '公式']
    },
    {
      question: 'What is the official website of Engineer Cafe?',
      language: 'en',
      expectedKeywords: ['engineercafe.jp', 'official']
    },
    {
      question: 'エンジニアカフェのTwitterは？',
      language: 'ja',
      expectedKeywords: ['@EngineerCafeJP', 'X', 'Twitter']
    },
    {
      question: 'エンジニアカフェは誰が運営していますか？',
      language: 'ja',
      expectedKeywords: ['福岡市', '公共施設']
    },
    {
      question: 'Who operates Engineer Cafe?',
      language: 'en',
      expectedKeywords: ['Fukuoka City', 'public facility']
    }
  ];

  console.log('Testing Q&A API Endpoint for Source Prioritization');
  console.log('='.repeat(50));

  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.question}`);
    console.log(`Language: ${testCase.language}`);
    
    try {
      // First, set the language
      await fetch(`${baseUrl}/api/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'language',
          value: testCase.language
        })
      });

      // Then make the Q&A request
      const response = await fetch(`${baseUrl}/api/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: testCase.question,
          sessionId: `test-${Date.now()}`
        })
      });

      if (!response.ok) {
        console.log(`❌ API returned error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`Response: ${data.answer}`);
      
      // Check for expected keywords
      const foundKeywords = testCase.expectedKeywords.filter(keyword => 
        data.answer.toLowerCase().includes(keyword.toLowerCase())
      );
      
      console.log(`Expected keywords found: ${foundKeywords.length}/${testCase.expectedKeywords.length}`);
      foundKeywords.forEach(keyword => console.log(`  ✅ ${keyword}`));
      
      const missingKeywords = testCase.expectedKeywords.filter(keyword => 
        !data.answer.toLowerCase().includes(keyword.toLowerCase())
      );
      missingKeywords.forEach(keyword => console.log(`  ❌ ${keyword}`));
      
      // Check if sources are mentioned
      if (data.answer.includes('情報源:') || data.answer.includes('Sources:') || 
          data.answer.includes('Source:') || data.answer.includes('参考:')) {
        console.log('✅ Sources are indicated in response');
      } else {
        console.log('⚠️  No explicit source attribution found');
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('-'.repeat(50));
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Checking if development server is running...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Development server is not running!');
    console.error('Please run "pnpm dev" in another terminal first.');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  
  await testQAEndpoint();
}

main().catch(console.error);