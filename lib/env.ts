import "server-only";
import { z } from "zod";

/**
 * Server environment validation. Import `serverEnv` where you need typed,
 * validated access. Required-ness is enforced only in production so local dev /
 * demo can run with partial config.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_TEXT_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_LIVE_MODEL: z.string().default("gemini-2.5-flash-native-audio-preview-12-2025"),
  // DNLA interview question API (licensed German provider). PLACEHOLDER for now —
  // until this is set, the DNLA interview reuses the same Gemini question
  // generation as the AI interview. See lib/dnla-questions.ts. TODO: swap to the
  // real DNLA endpoint when the provider ships it.
  DNLA_QUESTION_API_URL: z.string().optional(),
  DNLA_QUESTION_API_KEY: z.string().optional(),
  AUTH_ENFORCED: z.enum(["true", "false"]).optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("[env] invalid server environment:", parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid server environment configuration");
  }
}

export const serverEnv = parsed.success ? parsed.data : schema.parse({});

/** Assert a var is present at call time (use inside routes that truly need it). */
export function requireEnv(key: keyof typeof serverEnv): string {
  const v = serverEnv[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return String(v);
}
