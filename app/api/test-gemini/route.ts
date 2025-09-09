import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  try {
    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'GEMINI_API_KEY not found in environment variables',
        suggestion: 'Add GEMINI_API_KEY to your .env.local file'
      }, { status: 400 });
    }
    
    // Test the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Test different models
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
    const results: any = {};
    
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Return a JSON object with a key "test" and value "success"');
        const response = result.response.text();
        results[modelName] = { 
          success: true, 
          response: response.substring(0, 200) 
        };
      } catch (error: any) {
        results[modelName] = { 
          success: false, 
          error: error.message,
          status: error.status
        };
      }
    }
    
    return NextResponse.json({
      apiKeyExists: true,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      modelTests: results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}