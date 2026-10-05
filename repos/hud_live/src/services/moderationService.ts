import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ModerationResult {
  isSafe: boolean;
  detectedItems: string[];
  explanation: string;
}

export const checkContentForContactInfo = async (content: string): Promise<ModerationResult> => {
  if (!content.trim()) return { isSafe: true, detectedItems: [], explanation: "" };

  // Normalize Arabic numerals to Western numerals
  const normalizedText = content.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  // Heuristic/Regex Check (Fast path for obvious items)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-z]{2,})/gi;
  const socialRegex = /(@[a-zA-Z0-9._-]+)/g;

  const detectedHeuristics: string[] = [];
  
  // Basic Regex
  if (urlRegex.test(normalizedText)) detectedHeuristics.push("Link/URL Pattern");
  if (socialRegex.test(normalizedText)) detectedHeuristics.push("Social Handle Pattern");

  // Numeric Check (catch 0 5 5 ... or 0-5-5 ... or any sequence of 8+ digits)
  const normalizedNumbers = normalizedText.replace(/\D/g, '');
  if (normalizedNumbers.length >= 8) {
      detectedHeuristics.push("Phone Number Pattern");
  }

  if (detectedHeuristics.length > 0) {
    return {
      isSafe: false,
      detectedItems: Array.from(new Set(detectedHeuristics)),
      explanation: "Detected potentially unsafe contact information using pattern matching."
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Analyze this content for THREE main categories of policy violations:
      
      1. Off-platform contact information:
         - Saudi/International phone numbers (e.g., 05XXXXXXXX, +966..., etc.)
         - Phone numbers written in words or mixed with characters
         - Links, websites, or emails
         - Instagram, Snapchat, TikTok handles
         
      2. Illegal and Prohibited Content:
         - Drugs and Narcotics (المخدرات)
         - Human or Organ Trafficking (الاتجار بالاعضاء والبشر)
         - Sales of Weapons and Explosives (بيع الاسلحة والمتفجرات)
         - Pornography and explicit content (الإباحية)
         - Anything illegal internationally or under the local laws of Saudi Arabia.
         
      3. Gibberish or Nonsensical Content:
         - Text that has no clear meaning, random letters, or keyboard smashes.
         - Text that does not describe a valid or logical service request.

      Content: "${content}"`,
      config: {
        systemInstruction: "Strict Content Moderator: You must detect ANY attempt to share contact info, mention prohibited content, or post nonsensical/gibberish text. Be extremely strict. Return JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: {
              type: Type.BOOLEAN,
              description: "False if ANY contact info or illegal content is found."
            },
            detectedItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of detected info types or illegal content."
            },
            explanation: {
              type: Type.STRING,
              description: "Reason for rejection."
            }
          },
          required: ["isSafe", "detectedItems", "explanation"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as ModerationResult;
  } catch (error) {
    console.error("Moderation Error:", JSON.stringify(error));
    // If AI fails, use a stricter heuristic fallback
    const strictFallbackRegex = /[0-9]{5,}|@[A-Za-z0-9_]+|https?:\/\//;
    const illegalRegex = /مخدرات|سلاح|اسلحة|متفجرات|دعارة|اباحي/i;
    
    if (strictFallbackRegex.test(normalizedText) || illegalRegex.test(normalizedText)) {
       return { 
         isSafe: false, 
         detectedItems: ["Unverified Suspected Violating Info"], 
         explanation: "Unable to verify content safety, and suspected patterns were found. Please remove any flagged info to proceed." 
       };
    }
    
    return { 
      isSafe: true, 
      detectedItems: [], 
      explanation: "Approve due to fallback on AI failure (no strict patterns detected)." 
    };
  }
};
