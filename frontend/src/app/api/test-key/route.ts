import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

export async function GET() {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Make a simple models list request - this will validate the API key
    const models = await openai.models.list();
    
    return NextResponse.json({
      success: true,
      message: 'API key is valid',
      modelCount: models.data.length
    });
  } catch (error: any) {
    console.error('API key test failed:', error);
    return NextResponse.json({
      success: false,
      message: error.message,
      error
    }, { status: 500 });
  }
} 