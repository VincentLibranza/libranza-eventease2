import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function predictAttendance(eventDetails: any, pastEvents: any[]) {
  const prompt = `Based on the following past event data: ${JSON.stringify(pastEvents)}. Predict the attendance for this new event: ${JSON.stringify(eventDetails)}. Provide a predicted number and a brief reasoning.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          predictedCount: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["predictedCount", "reasoning"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeTrends(stats: any) {
  const prompt = `Analyze the following event and participant statistics: ${JSON.stringify(stats)}. 
  Identify the most active departments, trends in attendance over time, and provide 3 actionable recommendations for future events.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          activeDepartments: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          trends: { type: Type.STRING },
          recommendations: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        },
        required: ["activeDepartments", "trends", "recommendations"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function getChatbotResponse(message: string, context: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: message,
    config: {
      systemInstruction: `You are EventEase Assistant. Help users with event registration and info. Context: ${context}`
    }
  });

  return response.text;
}
