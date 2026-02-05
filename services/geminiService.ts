import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language, QuizQuestion } from "../types";

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

export const generateExplanation = async (text: string, context: string = '', language: Language = 'ENGLISH'): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");
  
  let langInstruction = "Provide the explanation in simple English.";
  
  if (language === 'AMHARIC') {
    langInstruction = "Provide the explanation primarily in Amharic (using Ethiopic script), but keep technical terms in English. Ensure the tone is educational.";
  } else if (language === 'OROMO') {
    langInstruction = "Provide the explanation primarily in Afaan Oromo, but keep technical terms in English. Ensure the tone is educational.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Context: The user is a Grade 11 student in Ethiopia.
        Task: Explain the text simply. Use local Ethiopian analogies.
        Language: ${langInstruction}
        Text: "${text}"
        ${context ? `Subject Context: ${context}` : ''}
      `,
      config: {
        systemInstruction: "You are Empress Taytu. Concise, wise, helpful.",
        tools: [{ googleSearch: {} }] 
      }
    });

    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let finalText = response.text || "I couldn't generate an explanation.";
    
    if (grounding && grounding.length > 0) {
      finalText += "\n\n(Verified with Google Search)";
    }

    return finalText;
  } catch (error) {
    console.error("Gemini Explanation Error:", error);
    return "I am having trouble accessing the network.";
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

export const generateQuiz = async (text: string, language: Language): Promise<QuizQuestion[]> => {
  if (!apiKey) throw new Error("API Key Missing");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 3 multiple-choice questions based on this text: "${text}". The questions should test understanding, not just memory. Language: ${language}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER, description: "Index of correct answer (0-3)" },
              explanation: { type: Type.STRING, description: "Why is this correct?" }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Quiz Gen Error:", error);
    return [];
  }
};
