import "server-only";

// Shared server-side code execution via Paiza.IO (free, no API key). Async API:
//   create -> poll get_status until "completed" -> get_details.
// Used by /api/code/run (free runs) and /api/code/grade (run against test cases).

const PAIZA = (process.env.PAIZA_URL || "https://api.paiza.io").replace(/\/$/, "");
const PAIZA_KEY = process.env.PAIZA_API_KEY || "guest";

// Map our language ids (lib/code-languages.ts) to Paiza language codes.
export const PAIZA_LANG: Record<string, string> = {
  python: "python3",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  c: "c",
  "c++": "cpp",
  csharp: "csharp",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  php: "php",
  kotlin: "kotlin",
  swift: "swift",
  bash: "bash",
};

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  compileError: string;
  timedOut: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function paiza(path: string, params: Record<string, string>, method: "GET" | "POST") {
  const body = new URLSearchParams({ ...params, api_key: PAIZA_KEY });
  const url = method === "GET" ? `${PAIZA}${path}?${body.toString()}` : `${PAIZA}${path}`;
  const res = await fetch(url, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: method === "POST" ? body.toString() : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`paiza ${path} ${res.status}`), { status: 502, detail: (await res.text()).slice(0, 200) });
  }
  return res.json();
}

export function isSupportedLanguage(langId: string): boolean {
  return !!PAIZA_LANG[langId];
}

/** Compile + run `code` (in language `langId`) with `stdin`, bounded in time. */
export async function runCode(langId: string, code: string, stdin: string, deadlineMs = 24_000): Promise<ExecResult> {
  const paizaLang = PAIZA_LANG[langId];
  if (!paizaLang) throw Object.assign(new Error(`Unsupported language: ${langId}`), { status: 400 });

  const created = await paiza("/runners/create", { source_code: code, language: paizaLang, input: stdin }, "POST");
  if (created?.error || !created?.id) throw Object.assign(new Error("Could not start the code runner."), { status: 502 });
  const id = String(created.id);

  const deadline = Date.now() + deadlineMs;
  let status = String(created.status || "running");
  while (status !== "completed") {
    if (Date.now() > deadline) return { stdout: "", stderr: "", exitCode: null, compileError: "", timedOut: true };
    await sleep(650);
    const s = await paiza("/runners/get_status", { id }, "GET");
    status = String(s?.status || "");
    if (s?.error) throw Object.assign(new Error("Code runner error."), { status: 502 });
  }

  const d = await paiza("/runners/get_details", { id }, "GET");
  const buildFailed = d?.build_result === "failure";
  const timedOut = d?.result === "timeout";
  const exitRaw = d?.exit_code ?? d?.build_exit_code ?? "";
  const exitCode = exitRaw === "" || exitRaw == null ? null : Number(exitRaw);

  return {
    stdout: String(d?.stdout || ""),
    stderr: timedOut ? "Execution timed out (exceeded the time limit)." : String(d?.stderr || ""),
    exitCode: Number.isFinite(exitCode as number) ? exitCode : null,
    compileError: buildFailed ? String(d?.build_stderr || d?.build_stdout || "Compilation failed.") : "",
    timedOut,
  };
}

/** Normalize program output for lenient test-case comparison. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "")
    .trim();
}
