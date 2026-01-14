
import { GoogleGenAI } from "@google/genai";

// Safely access process.env to prevent crashes in environments where process is not defined (e.g. pure browser)
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // console.warn("Environment variable access failed", e);
  }
  return "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() || "" });

export interface AnalysisStats {
  perfects: number;
  misses: number;
  averageAccuracy: number;
  earlyRate: number; // Percentage of hits that were early
  lateRate: number; // Percentage of hits that were late
  offbeatMisses: number;
  downbeatMisses: number;
  trend: 'improving' | 'degrading' | 'stable';
}

export const getAICommentary = async (stats: AnalysisStats) => {
  try {
    let roleDescription = "";
    let taskDescription = "";

    // Dynamic Persona based on performance - Relaxed Thresholds for Beginners
    if (stats.averageAccuracy >= 90) {
      roleDescription = "You are a master musician completely impressed by a virtuoso performance.";
      taskDescription = `
      Write a short, enthusiastic message of high praise (2 sentences max).
      1. Acknowledge their incredible precision and professional feel.
      2. Do NOT give advice or corrections. Just celebrate the mastery.
      `;
    } else if (stats.averageAccuracy >= 80) {
      roleDescription = "You are a senior music producer very happy with a great take.";
      taskDescription = `
      Write a short, positive message (2 sentences max).
      1. Praise the solid groove and consistency.
      2. You can casually mention their slight tendency (${stats.earlyRate > stats.lateRate ? 'a tiny bit rushing' : 'a tiny bit dragging'}) ONLY as a minor polish for perfection, but emphasize that it was an excellent run.
      `;
    } else {
      roleDescription = "You are a kind, encouraging elementary music teacher.";
      taskDescription = `
      Write a short, very gentle and supportive feedback message (2 sentences max).
      1. Find something good to say first (e.g., "Good effort," "Nice flow").
      2. Give ONE simple tip to help them improve (e.g., "Listen to the kick drum," "Try counting out loud").
      3. Never be harsh. Always be encouraging.
      `;
    }

    const prompt = `${roleDescription}

    Stats:
    - Accuracy: ${stats.averageAccuracy.toFixed(1)}%
    - Timing: ${stats.earlyRate.toFixed(1)}% Early, ${stats.lateRate.toFixed(1)}% Late
    - Misses: ${stats.misses}
    - Trend: ${stats.trend}

    ${taskDescription}
    
    Tone: Warm, friendly, and accessible. Avoid technical jargon unless necessary.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "Great job! Keep the rhythm going.";
  } catch (error) {
    console.error("Gemini Commentary Error:", error);
    return "Great job! Keep the rhythm going.";
  }
};
