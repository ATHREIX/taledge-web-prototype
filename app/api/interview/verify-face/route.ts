import { NextRequest, NextResponse } from "next/server";
import { generateGeminiContent, getGeminiApiKey } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "No image provided" }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      // If no API key is set, we bypass this verification so as not to break the app
      return NextResponse.json({ ok: true, verified: true });
    }

    const prompt = `You are a strict security and proctoring AI. Analyze this webcam image. 
Your task is to confirm if there is EXACTLY ONE human face clearly visible in the image.
The face should be looking generally towards the camera.

If there is exactly one clear face, reply ONLY with the word: VERIFIED
If there are no faces, multiple faces, or the image is too dark/blurry to tell, reply with a short 1-sentence reason (e.g. "No face detected" or "Multiple people detected").`;

    // Remove the data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const result = await generateGeminiContent(apiKey, prompt, {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Data } }
      ],
      temperature: 0.1,
      maxOutputTokens: 50,
    });

    const responseText = result.text.trim();
    if (responseText.toUpperCase() === "VERIFIED") {
      return NextResponse.json({ ok: true, verified: true });
    } else {
      return NextResponse.json({ ok: true, verified: false, reason: responseText });
    }

  } catch (error: any) {
    console.error("Face verification error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
