import { GoogleAuth } from 'google-auth-library';
import * as path from 'path';

async function testAuth() {
  try {
    console.log('Testing Google Cloud authentication...\n');
    
    const keyFilePath = path.resolve(process.cwd(), './config/service-account-key.json');
    console.log('Key file path:', keyFilePath);
    
    const auth = new GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    console.log('Getting auth client...');
    const client = await auth.getClient();
    console.log('Client type:', client.constructor.name);

    console.log('\nGetting access token...');
    const tokenResponse = await client.getAccessToken();
    console.log('Token obtained:', tokenResponse.token ? '✅ Yes' : '❌ No');
    
    if (tokenResponse.token) {
      console.log('Token length:', tokenResponse.token.length);
      console.log('Token preview:', tokenResponse.token.substring(0, 20) + '...');
    }

    // Test a simple API call
    console.log('\nTesting API call to Text-to-Speech...');
    const response = await fetch('https://texttospeech.googleapis.com/v1/voices', {
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
      },
    });

    console.log('API Response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('Available voices:', data.voices?.length || 0);
    } else {
      console.log('API Error:', await response.text());
    }

  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

testAuth();