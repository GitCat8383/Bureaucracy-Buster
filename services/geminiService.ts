import { DocumentAnalysis } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const analyzeDocument = async (
  fileContent: string, 
  isImage: boolean, 
  mimeType: string = 'text/plain'
): Promise<DocumentAnalysis> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: fileContent,
        is_image: isImage,
        mime_type: mimeType,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to analyze document.");
    }

    return await response.json();
  } catch (error) {
    console.error("Analysis Error:", error);
    throw new Error("Failed to analyze document. Please try again.");
  }
};

export const simplifyText = async (
  selectedText: string, 
  analysis: DocumentAnalysis
): Promise<{ explanation: string, keyTerms: string[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selected_text: selectedText,
        analysis,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to simplify text.");
    }

    return await response.json();
  } catch (error) {
    console.error("Simplification Error:", error);
    return {
      explanation: "We couldn't simplify this text right now. It might be too fragmented.",
      keyTerms: []
    };
  }
};
