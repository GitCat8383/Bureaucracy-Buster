import { GoogleGenAI, Type } from "@google/genai";
import { DocumentAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeDocument = async (
  fileContent: string, 
  isImage: boolean, 
  mimeType: string = 'text/plain'
): Promise<DocumentAnalysis> => {
  
  const prompt = `
    You are an expert in simplifying bureaucratic, legal, and government forms.
    Analyze the following document content.
    
    Tasks:
    1. Transcribe the full text content accurately if it's an image. If it's already text, just use it.
    2. Provide a clear, "Plain English" summary of the document's main purpose.
    3. List the key requirements or action items for the user (e.g., "Submit by date X", "Attach ID").
    
    Return the response in JSON format.
  `;

  const contents = [];
  
  if (isImage) {
    // For images, we send the base64 data
    const base64Data = fileContent.split(',')[1]; // Remove data URL prefix if present
    contents.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
    contents.push({ text: prompt });
  } else {
    // For text, we send the text directly
    contents.push({ text: `${prompt}\n\nDOCUMENT CONTENT:\n${fileContent}` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: isImage ? { parts: contents } : contents[0].text,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            purpose: { type: Type.STRING, description: "A concise 1-sentence summary of what this form is for." },
            summary: { type: Type.STRING, description: "A paragraph explaining the document in simple terms." },
            transcribedText: { type: Type.STRING, description: "The full text content of the document." },
            requirements: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of specific requirements or actions."
            }
          },
          required: ["purpose", "summary", "transcribedText", "requirements"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DocumentAnalysis;
    }
    throw new Error("Empty response from Gemini");

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze document. Please try again.");
  }
};

export const simplifyText = async (
  selectedText: string, 
  documentContext: string
): Promise<{ explanation: string, keyTerms: string[] }> => {
  
  const prompt = `
    The user is reading a bureaucratic document and is confused by this specific text: "${selectedText}".
    
    Context of the document:
    ${documentContext.substring(0, 1000)}... (truncated for brevity)

    Task:
    1. Explain the selected text in extremely simple, "Plain English" terms (like you are explaining to a 5-year-old or non-native speaker).
    2. Identify 1-3 specific legal/complex terms in the selection and define them simply.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING, description: "Simple explanation of the selected text." },
            keyTerms: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Definitions of complex terms found in the selection." 
            }
          },
          required: ["explanation", "keyTerms"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Gemini Simplification Error:", error);
    return {
      explanation: "We couldn't simplify this text right now. It might be too fragmented.",
      keyTerms: []
    };
  }
};
