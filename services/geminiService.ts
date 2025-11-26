import { GoogleGenAI } from "@google/genai";

// Safely access environment variables
const getApiKey = () => {
  try {
    // Vite / Modern Browsers
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        return (import.meta as any).env.VITE_API_KEY;
    }
    // Webpack / Node
    if (typeof process !== 'undefined' && process.env) {
        return process.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore errors
  }
  return undefined;
};

const apiKey = getApiKey();

// Initialize Gemini AI
// We use a fallback "dummy" key if none is found to prevent initialization errors.
// The actual API call will check for a valid key before proceeding.
const ai = new GoogleGenAI({ apiKey: apiKey || "dummy-key" });

export const analyzePackageImage = async (base64Image: string): Promise<string> => {
  try {
    if (!apiKey) {
        console.warn("Gemini API Key is missing. Check VITE_API_KEY.");
        return "AI Analysis skipped (No API Key).";
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "You are a Quality Assurance bot for a packing station. Analyze this image of a packed box. Briefly describe if the box looks sealed, if a shipping label is visible, and if there are any obvious damages. Keep it under 30 words."
          }
        ]
      },
      config: {
        temperature: 0.2, // Low temperature for factual observation
      }
    });
    
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return "AI Analysis unavailable.";
  }
};