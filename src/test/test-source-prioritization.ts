import { EngineerCafeWebSearchTool } from '../mastra/tools/company-web-search';
import { EnhancedQAAgent } from '../mastra/agents/enhanced-qa-agent';

interface TestResult {
  query: string;
  category: string;
  passed: boolean;
  details: {
    sources: Array<{ uri: string; title: string; priority: number }>;
    responseText: string;
    correctPriority: boolean;
    correctFacilityInfo: boolean;
    sourcesClearlyIndicated: boolean;
  };
  errors?: string[];
}

class SourcePrioritizationTest {
  private webSearchTool: EngineerCafeWebSearchTool;
  private qaAgent: EnhancedQAAgent;
  private testResults: TestResult[] = [];

  constructor() {
    this.webSearchTool = new EngineerCafeWebSearchTool();
    // Initialize QA agent with mock config
    this.qaAgent = new EnhancedQAAgent({
      llm: { model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp' }
    });
    // Add the web search tool to the agent
    this.qaAgent.addTool('engineerCafeWebSearch', this.webSearchTool);
  }

  // Test queries for different categories
  private getTestQueries() {
    return [
      // Basic facility information queries
      {
        query: 'エンジニアカフェとは何ですか？',
        category: 'basic-info-ja',
        expectedInfo: ['福岡市', '公共施設', '無料']
      },
      {
        query: 'What is Engineer Cafe?',
        category: 'basic-info-en',
        expectedInfo: ['Fukuoka City', 'public facility', 'free']
      },
      // Specific facility queries
      {
        query: 'エンジニアカフェの営業時間は？',
        category: 'hours-ja',
        expectedInfo: ['9:00', '22:00']
      },
      {
        query: 'Engineer Cafe official website',
        category: 'website-en',
        expectedInfo: ['engineercafe.jp']
      },
      // Social media queries
      {
        query: 'エンジニアカフェのTwitterアカウントは？',
        category: 'social-ja',
        expectedInfo: ['@EngineerCafeJP', 'x.com']
      },
      // Location queries
      {
        query: 'エンジニアカフェの場所はどこですか？',
        category: 'location-ja',
        expectedInfo: ['福岡市中央区天神', '天神']
      },
      // Fee information
      {
        query: 'Is Engineer Cafe free to use?',
        category: 'fee-en',
        expectedInfo: ['free', 'no charge', 'completely free']
      },
      // Facility type confirmation
      {
        query: 'エンジニアカフェは民間企業ですか？',
        category: 'facility-type-ja',
        expectedInfo: ['公共施設', '福岡市']
      },
      // Complex queries
      {
        query: 'エンジニアカフェでイベントを開催できますか？',
        category: 'events-ja',
        expectedInfo: ['イベント']
      },
      {
        query: 'What services does Engineer Cafe offer?',
        category: 'services-en',
        expectedInfo: ['coworking', 'meeting rooms', 'events']
      }
    ];
  }

  // Analyze source priority
  private analyzeSourcePriority(sources: Array<{ uri: string; title: string }>): {
    prioritizedSources: Array<{ uri: string; title: string; priority: number }>;
    correctPriority: boolean;
  } {
    const prioritizedSources = sources.map(source => {
      let priority = 3; // Default lowest priority
      
      // Check both URI and title for domain information
      const sourceInfo = source.uri.toLowerCase() + ' ' + source.title.toLowerCase();
      
      // Check for official website (highest priority)
      if (sourceInfo.includes('engineercafe.jp')) {
        priority = 1;
      }
      // Check for official Twitter/X (second priority)
      else if (sourceInfo.includes('x.com/engineercafejp') || 
               sourceInfo.includes('twitter.com/engineercafejp') ||
               sourceInfo.includes('@engineercafejp')) {
        priority = 2;
      }
      
      return { ...source, priority };
    });

    // Sort by priority
    prioritizedSources.sort((a, b) => a.priority - b.priority);

    // Check if priority is correct
    let correctPriority = true;
    
    // If we have sources, check that engineercafe.jp appears first if present
    const officialSiteIndex = prioritizedSources.findIndex(s => s.uri.includes('engineercafe.jp'));
    const twitterIndex = prioritizedSources.findIndex(s => 
      s.uri.includes('x.com/EngineerCafeJP') || s.uri.includes('twitter.com/EngineerCafeJP')
    );
    
    if (officialSiteIndex > -1 && officialSiteIndex !== 0) {
      correctPriority = false;
    }
    
    if (twitterIndex > -1 && officialSiteIndex === -1 && twitterIndex !== 0) {
      correctPriority = false;
    }
    
    if (officialSiteIndex > -1 && twitterIndex > -1 && twitterIndex < officialSiteIndex) {
      correctPriority = false;
    }

    return { prioritizedSources, correctPriority };
  }

  // Check if facility information is correct
  private checkFacilityInfo(text: string, language: string): boolean {
    const requiredInfo = language === 'ja' 
      ? ['福岡市', '公共施設', '無料']
      : ['Fukuoka City', 'public facility', 'free'];
    
    const lowerText = text.toLowerCase();
    
    // Check that it's identified as a public facility, not a private company
    if (language === 'ja') {
      if (lowerText.includes('民間') || lowerText.includes('企業') || lowerText.includes('会社')) {
        return false;
      }
    } else {
      if (lowerText.includes('private') || lowerText.includes('company') || lowerText.includes('corporation')) {
        return false;
      }
    }
    
    // Check that key information is present
    return requiredInfo.some(info => lowerText.includes(info.toLowerCase()));
  }

  // Check if sources are clearly indicated
  private checkSourcesIndicated(text: string, sources: Array<{ uri: string; title: string }>): boolean {
    if (sources.length === 0) return true; // No sources to indicate
    
    // Check if there's a sources section
    const hasSourcesSection = text.includes('情報源:') || text.includes('Sources:') || 
                             text.includes('Source:') || text.includes('参考:');
    
    // Check if at least one source URL is mentioned
    const hasSourceUrl = sources.some(source => 
      text.includes(source.uri) || text.includes(source.title)
    );
    
    return hasSourcesSection || hasSourceUrl;
  }

  // Run a single test
  private async runSingleTest(testCase: { query: string; category: string; expectedInfo?: string[] }): Promise<TestResult> {
    try {
      console.log(`\nTesting: ${testCase.query}`);
      
      // Determine language
      const language = testCase.category.endsWith('-ja') ? 'ja' : 'en';
      
      // Execute web search
      const searchResult = await this.webSearchTool.execute({
        query: testCase.query,
        language: language
      });
      
      if (!searchResult.success) {
        return {
          query: testCase.query,
          category: testCase.category,
          passed: false,
          details: {
            sources: [],
            responseText: '',
            correctPriority: false,
            correctFacilityInfo: false,
            sourcesClearlyIndicated: false
          },
          errors: [searchResult.error || 'Search failed']
        };
      }
      
      // Analyze sources
      const { prioritizedSources, correctPriority } = this.analyzeSourcePriority(searchResult.sources);
      
      // Check facility information
      const correctFacilityInfo = this.checkFacilityInfo(searchResult.text, language);
      
      // Format response with sources
      const formattedResponse = this.webSearchTool.formatSearchResultsWithSources(
        searchResult.text, 
        searchResult.sources, 
        language
      );
      
      // Check if sources are clearly indicated
      const sourcesClearlyIndicated = this.checkSourcesIndicated(formattedResponse, searchResult.sources);
      
      // Check if expected information is present
      let hasExpectedInfo = true;
      if (testCase.expectedInfo) {
        hasExpectedInfo = testCase.expectedInfo.some(info => 
          searchResult.text.toLowerCase().includes(info.toLowerCase())
        );
      }
      
      const passed = correctPriority && correctFacilityInfo && sourcesClearlyIndicated && hasExpectedInfo;
      
      return {
        query: testCase.query,
        category: testCase.category,
        passed: passed,
        details: {
          sources: prioritizedSources,
          responseText: formattedResponse,
          correctPriority: correctPriority,
          correctFacilityInfo: correctFacilityInfo,
          sourcesClearlyIndicated: sourcesClearlyIndicated
        }
      };
      
    } catch (error) {
      return {
        query: testCase.query,
        category: testCase.category,
        passed: false,
        details: {
          sources: [],
          responseText: '',
          correctPriority: false,
          correctFacilityInfo: false,
          sourcesClearlyIndicated: false
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Run all tests
  async runAllTests(): Promise<void> {
    console.log('Starting Engineer Cafe Source Prioritization Tests');
    console.log('='.repeat(50));
    
    const testQueries = this.getTestQueries();
    
    for (const testCase of testQueries) {
      const result = await this.runSingleTest(testCase);
      this.testResults.push(result);
      
      // Display result
      console.log(`\nTest: ${result.category}`);
      console.log(`Query: ${result.query}`);
      console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (result.details.sources.length > 0) {
        console.log('\nSources (in priority order):');
        result.details.sources.forEach((source, index) => {
          console.log(`  ${index + 1}. [Priority ${source.priority}] ${source.title}: ${source.uri}`);
        });
      }
      
      console.log('\nChecks:');
      console.log(`  - Source Priority: ${result.details.correctPriority ? '✅' : '❌'}`);
      console.log(`  - Facility Info Correct: ${result.details.correctFacilityInfo ? '✅' : '❌'}`);
      console.log(`  - Sources Clearly Indicated: ${result.details.sourcesClearlyIndicated ? '✅' : '❌'}`);
      
      if (!result.passed) {
        console.log('\nResponse Text:');
        console.log(result.details.responseText);
        
        if (result.errors) {
          console.log('\nErrors:');
          result.errors.forEach(error => console.log(`  - ${error}`));
        }
      }
      
      console.log('-'.repeat(50));
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    this.printSummary();
  }

  // Print test summary
  private printSummary(): void {
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
    
    // Detailed failure analysis
    if (failedTests > 0) {
      console.log('\nFailed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`\n- ${result.category}: ${result.query}`);
        if (!result.details.correctPriority) {
          console.log('  ❌ Incorrect source priority');
        }
        if (!result.details.correctFacilityInfo) {
          console.log('  ❌ Incorrect facility information');
        }
        if (!result.details.sourcesClearlyIndicated) {
          console.log('  ❌ Sources not clearly indicated');
        }
      });
    }
    
    // Source analysis
    console.log('\n' + '='.repeat(50));
    console.log('SOURCE ANALYSIS');
    console.log('='.repeat(50));
    
    const allSources = this.testResults.flatMap(r => r.details.sources);
    const sourceFrequency = new Map<string, number>();
    
    allSources.forEach(source => {
      // Try to extract domain from title first, then from URI
      let domain = source.title;
      
      // If title contains a domain pattern, use it
      const domainMatch = source.title.match(/([a-z0-9-]+\.[a-z]+)/i);
      if (domainMatch) {
        domain = domainMatch[1];
      } else {
        // Otherwise try to parse URI
        try {
          domain = new URL(source.uri).hostname;
        } catch {
          domain = source.title;
        }
      }
      
      sourceFrequency.set(domain, (sourceFrequency.get(domain) || 0) + 1);
    });
    
    console.log('\nSource Frequency:');
    Array.from(sourceFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count} times`);
      });
    
    // Priority compliance
    const testsWithSources = this.testResults.filter(r => r.details.sources.length > 0);
    const correctPriorityCount = testsWithSources.filter(r => r.details.correctPriority).length;
    
    console.log(`\nSource Priority Compliance: ${correctPriorityCount}/${testsWithSources.length} (${((correctPriorityCount/testsWithSources.length)*100).toFixed(1)}%)`);
    
    // Key requirements check
    console.log('\n' + '='.repeat(50));
    console.log('KEY REQUIREMENTS CHECK');
    console.log('='.repeat(50));
    
    const hasEngineerCafeJp = allSources.some(s => 
      s.uri.includes('engineercafe.jp') || s.title.toLowerCase().includes('engineercafe.jp')
    );
    const hasTwitter = allSources.some(s => 
      s.uri.includes('x.com/EngineerCafeJP') || 
      s.uri.includes('twitter.com/EngineerCafeJP') ||
      s.title.toLowerCase().includes('x.com') ||
      s.title.toLowerCase().includes('@engineercafejp')
    );
    const publicFacilityCorrect = this.testResults.every(r => r.details.correctFacilityInfo);
    
    console.log(`✓ engineercafe.jp used as source: ${hasEngineerCafeJp ? '✅' : '❌'}`);
    console.log(`✓ @EngineerCafeJP (X/Twitter) used as source: ${hasTwitter ? '✅' : '❌'}`);
    console.log(`✓ Correctly identified as public facility: ${publicFacilityCorrect ? '✅' : '❌'}`);
    console.log(`✓ Sources clearly indicated in responses: ${this.testResults.every(r => r.details.sourcesClearlyIndicated) ? '✅' : '❌'}`);
  }
}

// Main execution
async function main() {
  // Check if we have the required environment variables
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('Error: Gemini API key not configured');
    console.error('Please set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY environment variable');
    process.exit(1);
  }
  
  const tester = new SourcePrioritizationTest();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);