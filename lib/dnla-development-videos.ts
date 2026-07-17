/**
 * DNLA Social-Competency development videos.
 * ─────────────────────────────────────────────────────────────────────────────
 * The 17 factors DNLA measures under Social Competency (ESK), each with a short
 * learning video supplied by DNLA. Surfaced on the development page as a resource
 * pool so a candidate scoring low on a factor can watch the matching lesson.
 *
 * NOTES / open items (see the section header in the development page):
 *   - Videos are in GERMAN. English subtitles / dubs are not yet available — the
 *     UI flags this. Follow up with DNLA on localized versions before wide rollout.
 *   - Files are hot-linked from dnla.de (200-300 MB each, range-request capable),
 *     so <video preload="none"> fetches nothing until the candidate hits play.
 *     If dnla.de later blocks hotlinking or we need CDN control, re-host and swap
 *     the `url` field only.
 *   - `axis` reuses the four PRD/DNLA axes (see lib/dnla-mapping.ts AXIS_LABEL) so
 *     these line up with the scored profile once the live DNLA import is enabled.
 */

export type DnlaDevAxis =
  | "achievement"
  | "interpersonal"
  | "will_to_succeed"
  | "stress_capacity";

export const DNLA_DEV_AXIS_LABEL: Record<DnlaDevAxis, string> = {
  achievement: "Achievement Dynamics",
  interpersonal: "Interpersonal Relations",
  will_to_succeed: "Will to Succeed",
  stress_capacity: "Stress Capacity",
};

export type DnlaDevVideo = {
  /** Stable slug, also used as the React key. */
  factor: string;
  /** German factor name, exactly as DNLA labels it. */
  de: string;
  /** English label shown in our UI. */
  en: string;
  axis: DnlaDevAxis;
  /** One-line description of what the factor captures. */
  blurb: string;
  /** Direct MP4 (German audio), hot-linked from dnla.de. */
  url: string;
};

const BASE = "https://www.dnla.de/DLoad";

export const DNLA_DEV_VIDEOS: DnlaDevVideo[] = [
  {
    factor: "auftreten",
    de: "Auftreten",
    en: "Presence & Impact",
    axis: "interpersonal",
    blurb: "How you come across to others: poise, presence and the impression you make.",
    url: `${BASE}/Auftreten.mp4`,
  },
  {
    factor: "arbeitszufriedenheit",
    de: "Arbeitszufriedenheit",
    en: "Job Satisfaction",
    axis: "stress_capacity",
    blurb: "Contentment and engagement with your work over time.",
    url: `${BASE}/Arbeitszufriedenheit.mp4`,
  },
  {
    factor: "eigenverantwortlichkeit",
    de: "Eigenverantwortlichkeit",
    en: "Self-Responsibility",
    axis: "will_to_succeed",
    blurb: "Owning outcomes and acting responsibly without being told.",
    url: `${BASE}/Eigenverantwortlichkeit.mp4`,
  },
  {
    factor: "einfuehlungsvermoegen",
    de: "Einfühlungsvermögen",
    en: "Empathy",
    axis: "interpersonal",
    blurb: "Reading and responding to other people's feelings and needs.",
    url: `${BASE}/Einf%C3%BChlungsverm%C3%B6gen.mp4`,
  },
  {
    factor: "einsatzfreude",
    de: "Einsatzfreude",
    en: "Commitment & Drive",
    axis: "achievement",
    blurb: "Energy and willingness to put in the effort a task demands.",
    url: `${BASE}/Einsatzfreude.mp4`,
  },
  {
    factor: "emotionale-grundhaltung",
    de: "Emotionale Grundhaltung",
    en: "Emotional Outlook",
    axis: "stress_capacity",
    blurb: "Baseline optimism and emotional balance.",
    url: `${BASE}/EmotionaleGrundhaltung.mp4`,
  },
  {
    factor: "flexibilitaet",
    de: "Flexibilität",
    en: "Flexibility",
    axis: "stress_capacity",
    blurb: "Adapting readily to change and new demands.",
    url: `${BASE}/Flexibilitaet.mp4`,
  },
  {
    factor: "initiative",
    de: "Initiative",
    en: "Initiative",
    axis: "will_to_succeed",
    blurb: "Acting proactively and starting things without prompting.",
    url: `${BASE}/Initiative.mp4`,
  },
  {
    factor: "kontaktfaehigkeit",
    de: "Kontaktfähigkeit",
    en: "Sociability",
    axis: "interpersonal",
    blurb: "Building and maintaining contacts and networks.",
    url: `${BASE}/Kontaktf%C3%A4higkeit.mp4`,
  },
  {
    factor: "kritikstabilitaet",
    de: "Kritikstabilität",
    en: "Resilience to Criticism",
    axis: "stress_capacity",
    blurb: "Staying steady and constructive when criticised.",
    url: `${BASE}/Kritikstabilit%C3%A4t.mp4`,
  },
  {
    factor: "leistungsdrang",
    de: "Leistungsdrang",
    en: "Drive to Achieve",
    axis: "achievement",
    blurb: "The push toward high performance and results.",
    url: `${BASE}/Leistungsdrang.mp4`,
  },
  {
    factor: "misserfolgstoleranz",
    de: "Misserfolgstoleranz",
    en: "Tolerance of Setbacks",
    axis: "stress_capacity",
    blurb: "Bouncing back constructively from failure.",
    url: `${BASE}/Misserfolgstoleranz.mp4`,
  },
  {
    factor: "motivation",
    de: "Motivation",
    en: "Motivation",
    axis: "achievement",
    blurb: "The inner drive that keeps you moving toward goals.",
    url: `${BASE}/Motivation.mp4`,
  },
  {
    factor: "selbstvertrauen",
    de: "Selbstvertrauen",
    en: "Self-Confidence",
    axis: "achievement",
    blurb: "Belief in your own abilities.",
    url: `${BASE}/Selbstvertrauen.mp4`,
  },
  {
    factor: "selbstsicherheit",
    de: "Selbstsicherheit",
    en: "Self-Assurance",
    axis: "interpersonal",
    blurb: "An assertive, secure presence in dealings with others.",
    url: `${BASE}/Selbstsicherheit.mp4`,
  },
  {
    factor: "statusmotivation",
    de: "Statusmotivation",
    en: "Status Motivation",
    axis: "will_to_succeed",
    blurb: "Drive for recognition, responsibility and advancement.",
    url: `${BASE}/Statusmotivation.mp4`,
  },
  {
    factor: "systematik",
    de: "Systematik",
    en: "Systematic Working",
    axis: "will_to_succeed",
    blurb: "A structured, methodical approach to tasks.",
    url: `${BASE}/Systematik.mp4`,
  },
];

/** Videos grouped by axis, in the axis order the UI renders. */
export const DNLA_DEV_AXIS_ORDER: DnlaDevAxis[] = [
  "achievement",
  "interpersonal",
  "will_to_succeed",
  "stress_capacity",
];

export function dnlaVideosByAxis(): Array<{ axis: DnlaDevAxis; label: string; videos: DnlaDevVideo[] }> {
  return DNLA_DEV_AXIS_ORDER.map((axis) => ({
    axis,
    label: DNLA_DEV_AXIS_LABEL[axis],
    videos: DNLA_DEV_VIDEOS.filter((v) => v.axis === axis),
  }));
}
