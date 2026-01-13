import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function generateDocs(functionName: string, code: string): Promise<string> {
    const prompt = `
        Describe what this function does in one short sentence. 
        Focus on its responsibility in the codebase.
        Function Name: ${functionName}
        Code:
        ${code}
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error('Gemini Error:', error);
        return 'No description available.';
    }
}

export async function explainFailure(staticContext: string, runtimeTrace: string): Promise<string> {
    const prompt = `
        You are WhyFlow, an AI debugger. 
        Compare the expected behavior (static analysis) with what actually happened (runtime trace).
        Explain why the code failed in 2-3 sentences.
        
        Static Context (Functions and their relations):
        ${staticContext}
        
        Runtime Trace (Last events):
        ${runtimeTrace}
        
        Output format:
        "According to the codebase design, [expected]. At runtime, [actual] happened instead. This caused [result]."
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        return 'Failed to generate explanation.';
    }
}
