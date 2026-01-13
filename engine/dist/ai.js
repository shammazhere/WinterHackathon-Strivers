"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainFailure = exports.generateDocs = void 0;
const generative_ai_1 = require("@google/generative-ai");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
async function generateDocs(functionName, code) {
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
    }
    catch (error) {
        console.error('Gemini Error:', error);
        return 'No description available.';
    }
}
exports.generateDocs = generateDocs;
async function explainFailure(staticContext, runtimeTrace) {
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
    }
    catch (error) {
        return 'Failed to generate explanation.';
    }
}
exports.explainFailure = explainFailure;
//# sourceMappingURL=ai.js.map