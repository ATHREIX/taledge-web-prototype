"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Play, Loader2, Terminal, ChevronDown, CheckCircle2, XCircle,
  Code2, FlaskConical, Lock, Sparkles,
} from "lucide-react";
import { authedFetch } from "@/lib/api-client";
import { CODE_LANGUAGES, getCodeLanguage } from "@/lib/code-languages";

export type RunResult = {
  language: string;
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number | null;
  compileError: string;
};

export type TestSummary = { passed: number; total: number };

type TestCaseResult = { input: string; passed: boolean; actual: string; error: string };
type GradeResponse = { ioContract: string; total: number; passed: number; results: TestCaseResult[]; compileError: string };

const FILE_EXT: Record<string, string> = {
  python: "py", javascript: "js", typescript: "ts", java: "java", c: "c",
  "c++": "cpp", csharp: "cs", go: "go", rust: "rs", ruby: "rb", php: "php",
  kotlin: "kt", swift: "swift", bash: "sh",
};

type Props = {
  code: string;
  onCodeChange: (value: string) => void;
  language: string;
  onLanguageChange: (id: string) => void;
  /** Latest free-run result, or null when the code changes (stale). */
  onResultChange?: (result: RunResult | null) => void;
  /** Latest hidden-test-case score, or null when the code changes. */
  onTestSummaryChange?: (summary: TestSummary | null) => void;
  /** The coding question being answered - enables "Run Tests" grading. */
  question?: string;
  editorHeight?: number | string;
  className?: string;
};

/**
 * Multi-language code compiler/runner (inspired by Programiz) for the AI
 * interview. Runs code server-side, and - when a coding question is present -
 * grades the candidate's program against HIDDEN test cases generated from that
 * question (expected outputs are never sent to the client). The latest run /
 * test results are surfaced so the submitted answer can carry them for the AI
 * report.
 */
export function CodeRunner({
  code,
  onCodeChange,
  language,
  onLanguageChange,
  onResultChange,
  onTestSummaryChange,
  question,
  editorHeight = 240,
  className = "",
}: Props) {
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);
  const [running, setRunning] = useState(false);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [grade, setGrade] = useState<GradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"output" | "tests">("output");

  const lang = getCodeLanguage(language);
  const canTest = !!question && question.trim().length > 0;

  const clearOutputs = () => {
    if (result) { setResult(null); onResultChange?.(null); }
    if (grade) { setGrade(null); onTestSummaryChange?.(null); }
  };

  const handleLanguageChange = (nextId: string) => {
    const prev = getCodeLanguage(language);
    const next = getCodeLanguage(nextId);
    onLanguageChange(nextId);
    if (!code.trim() || code.trim() === prev.starter.trim()) onCodeChange(next.starter);
    clearOutputs();
  };

  const handleCodeChange = (value: string | undefined) => {
    onCodeChange(value || "");
    clearOutputs();
  };

  const run = async () => {
    if (running || grading || !code.trim()) return;
    setRunning(true);
    setError(null);
    setTab("output");
    try {
      const res = await authedFetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not run your code. Please try again.");
        setResult(null);
        onResultChange?.(null);
        return;
      }
      const r: RunResult = {
        language: data.language,
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        output: data.output || "",
        exitCode: data.exitCode ?? null,
        compileError: data.compileError || "",
      };
      setResult(r);
      onResultChange?.(r);
    } catch {
      setError("Could not reach the code runner. Check your connection.");
    } finally {
      setRunning(false);
    }
  };

  const runTests = async () => {
    if (running || grading || !code.trim() || !canTest) return;
    setGrading(true);
    setError(null);
    setTab("tests");
    try {
      const res = await authedFetch("/api/code/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, language, code }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not run the test cases. Please try again.");
        setGrade(null);
        onTestSummaryChange?.(null);
        return;
      }
      const g: GradeResponse = {
        ioContract: data.ioContract || "",
        total: data.total || 0,
        passed: data.passed || 0,
        results: Array.isArray(data.results) ? data.results : [],
        compileError: data.compileError || "",
      };
      setGrade(g);
      onTestSummaryChange?.({ passed: g.passed, total: g.total });
    } catch {
      setError("Could not reach the test runner. Check your connection.");
    } finally {
      setGrading(false);
    }
  };

  const runOk = result && !result.compileError && (result.exitCode === 0 || result.exitCode === null) && !result.stderr;
  const allPass = grade && grade.total > 0 && grade.passed === grade.total;

  return (
    <div className={`rounded-2xl overflow-hidden border border-ink-900/60 bg-[#1e1e2e] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-[#23232f] to-[#2a2a3a] border-b border-black/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 truncate">
            <Code2 aria-hidden className="w-3.5 h-3.5 text-brand-400" />
            main.{FILE_EXT[language] || "txt"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              aria-label="Programming language"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="appearance-none bg-white/5 hover:bg-white/10 text-slate-100 text-xs font-semibold rounded-lg pl-3 pr-7 py-1.5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-500/50 cursor-pointer transition-colors"
            >
              {CODE_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id} className="bg-[#23232f]">{l.label}</option>
              ))}
            </select>
            <ChevronDown aria-hidden className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {canTest && (
            <button
              type="button"
              onClick={runTests}
              disabled={running || grading || !code.trim()}
              title="Run hidden test cases generated from the question"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-500 hover:to-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 transition-all shadow-sm"
            >
              {grading ? <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical aria-hidden className="w-3.5 h-3.5" />}
              {grading ? "Testing…" : "Run Tests"}
            </button>
          )}

          <button
            type="button"
            onClick={run}
            disabled={running || grading || !code.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3.5 py-1.5 transition-colors shadow-sm"
          >
            {running ? <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" /> : <Play aria-hidden className="w-3.5 h-3.5" />}
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <Editor
        height={editorHeight}
        language={lang.monaco}
        theme="vs-dark"
        value={code}
        onChange={handleCodeChange}
        options={{
          minimap: { enabled: false },
          fontSize: 13.5,
          fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
          fontLigatures: true,
          padding: { top: 14 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          tabSize: 2,
          renderLineHighlight: "all",
        }}
      />

      {/* Optional custom stdin (for free runs) */}
      <div className="border-t border-black/40">
        <button
          type="button"
          onClick={() => setShowStdin((s) => !s)}
          className="w-full flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronDown aria-hidden className={`w-3 h-3 transition-transform ${showStdin ? "" : "-rotate-90"}`} />
          Custom input (stdin)
        </button>
        {showStdin && (
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Input passed to your program when you press Run…"
            rows={2}
            className="w-full bg-[#16161f] text-slate-200 text-xs font-mono px-3.5 py-2 resize-none focus:outline-none border-t border-black/40 placeholder-slate-600"
          />
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 pt-2 bg-[#16161f] border-t border-black/40">
        <button
          type="button"
          onClick={() => setTab("output")}
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-t-lg transition-colors ${tab === "output" ? "bg-[#1e1e2e] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
        >
          <Terminal aria-hidden className="w-3.5 h-3.5" /> Output
        </button>
        {canTest && (
          <button
            type="button"
            onClick={() => setTab("tests")}
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-t-lg transition-colors ${tab === "tests" ? "bg-[#1e1e2e] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            <FlaskConical aria-hidden className="w-3.5 h-3.5" /> Test Cases
            {grade && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] ${allPass ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                {grade.passed}/{grade.total}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Panel */}
      <div className="bg-[#1e1e2e] px-3.5 py-3 max-h-52 overflow-auto font-mono text-xs leading-relaxed">
        {error ? (
          <span className="text-rose-400">{error}</span>
        ) : tab === "output" ? (
          running ? (
            <span className="text-slate-500">Compiling &amp; running…</span>
          ) : result ? (
            <>
              <div className="flex items-center gap-1.5 mb-1.5 not-italic">
                {runOk ? <CheckCircle2 aria-hidden className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle aria-hidden className="w-3.5 h-3.5 text-rose-400" />}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${runOk ? "text-emerald-400" : "text-rose-400"}`}>
                  exit {result.exitCode ?? "-"}
                </span>
              </div>
              {result.compileError && <pre className="whitespace-pre-wrap text-rose-400">{result.compileError}</pre>}
              {result.stdout && <pre className="whitespace-pre-wrap text-slate-100">{result.stdout}</pre>}
              {result.stderr && <pre className="whitespace-pre-wrap text-rose-400">{result.stderr}</pre>}
              {!result.compileError && !result.stdout && !result.stderr && (
                <span className="text-slate-500">Program finished with no output.</span>
              )}
            </>
          ) : (
            <span className="text-slate-600">Press “Run” to compile and execute your code.</span>
          )
        ) : /* tests */ grading ? (
          <span className="text-slate-500">Running hidden test cases…</span>
        ) : grade ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {allPass ? <CheckCircle2 aria-hidden className="w-4 h-4 text-emerald-400" /> : <XCircle aria-hidden className="w-4 h-4 text-rose-400" />}
              <span className={`text-sm font-bold ${allPass ? "text-emerald-400" : "text-rose-400"}`}>
                {grade.passed} / {grade.total} test cases passed
              </span>
            </div>
            {grade.ioContract && (
              <p className="text-[11px] text-slate-400 not-italic flex items-start gap-1.5">
                <Sparkles aria-hidden className="w-3 h-3 mt-0.5 shrink-0 text-brand-400" />
                <span>{grade.ioContract}</span>
              </p>
            )}
            {grade.compileError && <pre className="whitespace-pre-wrap text-rose-400">{grade.compileError}</pre>}
            <div className="space-y-1.5">
              {grade.results.map((r, i) => (
                <div key={i} className={`rounded-lg border px-2.5 py-2 ${r.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">Test {i + 1}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${r.passed ? "text-emerald-400" : "text-rose-400"}`}>
                      {r.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {r.passed ? "Passed" : r.error || "Failed"}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-1 text-[10px]">
                    <div><span className="text-slate-500">Input: </span><span className="text-slate-300 whitespace-pre-wrap">{r.input || "(none)"}</span></div>
                    <div className="inline-flex items-center gap-1 text-slate-500"><Lock className="w-2.5 h-2.5" /> Expected output is hidden</div>
                    {!r.passed && r.actual && (
                      <div><span className="text-slate-500">Your output: </span><span className="text-rose-300 whitespace-pre-wrap">{r.actual}</span></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-slate-600 inline-flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" /> Press “Run Tests” to check your solution against hidden test cases.
          </span>
        )}
      </div>
    </div>
  );
}
