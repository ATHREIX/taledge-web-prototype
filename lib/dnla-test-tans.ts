/**
 * Temporary pre-issued TAN support for DNLA integration testing.
 *
 * TANs are participant credentials, so they must come from a server-only
 * environment variable and must never be committed or sent to the client as a
 * pool. The selected TAN is necessarily present in DNLA's questionnaire URL.
 */

const DEFAULT_START_BASE = "https://next.dnla.com/";
const TAN_PATTERN = /^[A-Za-z0-9]{4,}-(?:ESK|AZS)-[A-Za-z0-9]{4,}-[A-Za-z0-9]{4,}$/;

export function parseDnlaTestTans(raw: string | undefined): string[] {
  if (!raw) return [];

  const unique = new Set<string>();
  for (const value of raw.split(/[\s,;]+/)) {
    const tan = value.trim();
    if (TAN_PATTERN.test(tan)) unique.add(tan);
  }
  return [...unique];
}

export function getDnlaTestTans(): string[] {
  return parseDnlaTestTans(process.env.DNLA_TEST_TANS);
}

export function isDnlaTestModeConfigured(): boolean {
  return getDnlaTestTans().length > 0;
}

/**
 * Build the current DNLA login URL for an existing TAN.
 *
 * DNLA's current frontend consumes `tan` on `/`; `/start?tan=...` skips the
 * login/bootstrap screen and remains on a spinner because `/start` expects an
 * authenticated DNLA cookie. Force the root path for the official host even if
 * an old `/start` URL was copied into configuration.
 */
export function buildDnlaTestStartUrl(
  tan: string,
  configuredBase = process.env.DNLA_TEST_START_BASE
): string {
  if (!TAN_PATTERN.test(tan)) throw new Error("Invalid DNLA test TAN format.");

  const url = new URL(configuredBase?.trim() || DEFAULT_START_BASE);
  if (url.protocol !== "https:") throw new Error("DNLA test start URL must use HTTPS.");
  if (url.hostname === "next.dnla.com") url.pathname = "/";
  url.hash = "";
  url.search = "";
  url.searchParams.set("tan", tan);
  return url.toString();
}
