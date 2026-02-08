const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const fetchSpeech = async (text: string, language: string): Promise<Blob> => {
  const response = await fetch(`${API_BASE_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate audio.");
  }

  return await response.blob();
};
