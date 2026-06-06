"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const steps = ["Profile", "Goal", "Context", "Done"];

type ParsedResume = {
  full_name?: string;
  email?: string;
  institution?: string;
  year_cohort?: string;
  target_role?: string;
  summary?: string;
  skills?: string[];
  projects?: { title: string; stack: string[]; impact: string }[];
};

type ResumeStatus = "idle" | "uploading" | "parsing" | "parsed" | "error";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [track, setTrack] = useState<"placement" | "exam" | null>(null);

  // Resume parsing state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeStatus, setResumeStatus] = useState<ResumeStatus>("idle");
  const [resumeFile, setResumeFile] = useState<{ name: string; sizeKb: number } | null>(null);
  const [resumeSource, setResumeSource] = useState<string>("");
  const [resumeError, setResumeError] = useState<string>("");
  const [parseMs, setParseMs] = useState<number>(0);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [yearCohort, setYearCohort] = useState("");
  const [aspiration, setAspiration] = useState("");
  const [selectedRole, setSelectedRole] = useState("Full-stack Software Engineer");
  const [parsedExtras, setParsedExtras] = useState<{
    skills: string[];
    projects: { title: string; stack: string[]; impact: string }[];
    summary: string;
    target_role: string;
  } | null>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setResumeFile({ name: file.name, sizeKb: Math.round(file.size / 1024) });
      setResumeStatus("error");
      setResumeError("Please upload a PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResumeFile({ name: file.name, sizeKb: Math.round(file.size / 1024) });
      setResumeStatus("error");
      setResumeError("File is larger than 10 MB.");
      return;
    }
    setResumeFile({ name: file.name, sizeKb: Math.round(file.size / 1024) });
    setResumeStatus("parsing");
    setResumeError("");
    setParsedExtras(null);
    const t0 = performance.now();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await r.json();
      const elapsed = Math.round(performance.now() - t0);
      setParseMs(elapsed);

      if (!r.ok || !data.ok) {
        setResumeStatus("error");
        setResumeError(data?.error || "We couldn't parse this PDF. Please try a different resume file.");
        return;
      }

      setResumeSource(data.source || "");
      const p: ParsedResume = data.parsed || {};
      if (p.full_name) setFullName(p.full_name);
      if (p.email) setEmail(p.email);
      if (p.institution) setInstitution(p.institution);
      if (p.year_cohort) setYearCohort(p.year_cohort);
      setParsedExtras({
        skills: p.skills || [],
        projects: p.projects || [],
        summary: p.summary || "",
        target_role: p.target_role || "",
      });
      setResumeStatus("parsed");
    } catch (e: any) {
      setResumeStatus("error");
      setResumeError(e?.message || "Network error · please check your connection and retry.");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function persistDemoProfile() {
    try {
      localStorage.setItem(
        "taledge:demo-profile",
        JSON.stringify({
          fullName,
          email,
          institution,
          yearCohort,
          aspiration,
          targetRole: selectedRole,
          resumeSummary: parsedExtras?.summary || "",
          resumeSkills: parsedExtras?.skills || [],
          resumeProjects: parsedExtras?.projects || [],
        })
      );
    } catch {}
  }

  const slideVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95, filter: "blur(10px)" },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    },
    exit: { 
      opacity: 0, 
      y: -20, 
      scale: 0.95, 
      filter: "blur(10px)", 
      position: "absolute",
      transition: { duration: 0.3, ease: "easeIn" }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-500/20 overflow-x-hidden relative font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Crisp Checkered Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)`,
            backgroundSize: `60px 60px`,
            maskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 120% 120% at 50% 50%, #000 40%, transparent 100%)`
          }}
        />

        {/* Very soft glowing orbs to break the flatness without overpowering the grid */}
        <motion.div
          animate={{ x: [0, 60, -60, 0], y: [0, -60, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[0%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/30 blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -80, 80, 0], y: [0, 80, -80, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-sky-200/30 blur-[150px]"
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12 flex flex-col min-h-screen">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-16"
        >
          <div className="flex items-center gap-3 bg-white/50 border border-white/60 rounded-full px-6 py-2.5 backdrop-blur-2xl shadow-lg shadow-indigo-500/5 hover:shadow-xl hover:bg-white/60 transition-all">
            <SparklesIcon className="text-indigo-600" />
            <span className="text-sm font-bold tracking-wide text-slate-800">Onboarding</span>
          </div>
          <Link href="/" className="group flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
            <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            All roles
          </Link>
        </motion.header>

        {/* Stepper */}
        <div className="max-w-4xl mx-auto w-full mb-12">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-slate-200 -z-10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-sky-500"
                initial={{ width: "0%" }}
                animate={{ width: `${(step / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
            {steps.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-3">
                <motion.div
                  layout
                  className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm transition-all duration-500 shadow-sm ${
                    i < step 
                      ? "bg-gradient-to-br from-indigo-500 to-sky-500 text-white border-none shadow-lg shadow-indigo-500/20" 
                      : i === step 
                      ? "bg-white/80 backdrop-blur-md border-[3px] border-indigo-500 text-indigo-600 shadow-lg shadow-indigo-500/10" 
                      : "bg-white/50 backdrop-blur-md border border-white/60 text-slate-400"
                  }`}
                >
                  {i < step ? <CheckIcon className="w-5 h-5" /> : i + 1}
                </motion.div>
                <span className={`text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${i <= step ? "text-slate-800" : "text-slate-400"}`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="relative w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step-0"
                  variants={slideVariants as any}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full bg-white/50 backdrop-blur-2xl border border-white/60 rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 lg:p-12 shadow-2xl shadow-indigo-500/10 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-sky-500 opacity-80" />
                  
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl sm:text-[2.75rem] font-black text-slate-900 tracking-tight mb-4 leading-tight">
                      Tell us about yourself
                    </h2>
                    <p className="text-slate-500 font-medium">Your profile shapes the assessment. Upload your resume to auto-fill.</p>
                  </div>

                  {/* Upload Area */}
                  <div className="mb-8">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={onFileChange}
                      className="hidden"
                    />

                    {resumeStatus === "idle" && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={onDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="group relative flex flex-col items-center justify-center p-12 rounded-[2rem] border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white/40 hover:bg-white/60 backdrop-blur-sm transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-xl hover:shadow-indigo-500/5"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white border border-white/60 shadow-lg shadow-indigo-500/5 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-3 transition-transform duration-300">
                          <DocIcon className="w-8 h-8 text-indigo-500" />
                        </div>
                        <div className="text-lg font-bold text-slate-700 mb-1">Drop your resume PDF</div>
                        <div className="text-sm font-medium text-slate-400 mb-4">Max 10 MB · Gemini 2.5 Pro Powered</div>
                        <button className="px-6 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
                          Choose File
                        </button>
                      </div>
                    )}

                    {resumeStatus === "parsing" && (
                      <div className="flex items-center gap-4 p-6 rounded-3xl border border-indigo-200 bg-indigo-50 relative overflow-hidden">
                        <motion.div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-200/50 to-transparent"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center animate-pulse z-10">
                          <DocIcon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                          <div className="truncate text-slate-900 font-bold">{resumeFile?.name}</div>
                          <div className="text-sm font-medium text-slate-500">{resumeFile?.sizeKb} KB · AI Parsing...</div>
                        </div>
                      </div>
                    )}

                    {resumeStatus === "parsed" && (
                      <div className="flex items-center gap-4 p-6 rounded-3xl border border-emerald-200 bg-emerald-50 relative">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                          <CheckIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-slate-900 font-bold">{resumeFile?.name}</div>
                          <div className="text-sm font-medium text-emerald-600/80">Parsed in {(parseMs / 1000).toFixed(1)}s</div>
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm font-bold text-emerald-600 hover:text-emerald-700 underline-offset-4 hover:underline"
                        >
                          Replace
                        </button>
                      </div>
                    )}

                    {resumeStatus === "error" && (
                      <div className="flex items-center gap-4 p-6 rounded-3xl border border-red-200 bg-red-50">
                        <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center">
                          <span className="text-red-600 font-extrabold text-xl">!</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-slate-900 font-bold">Upload Failed</div>
                          <div className="text-sm font-medium text-red-600/80">{resumeError}</div>
                        </div>
                        <button
                          onClick={() => {
                            setResumeStatus("idle");
                            setResumeFile(null);
                            setResumeError("");
                            fileInputRef.current?.click();
                          }}
                          className="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                    <Field label="Full name" value={fullName} onChange={setFullName} autoFilled={resumeStatus === "parsed"} />
                    <Field label="Email" value={email} onChange={setEmail} autoFilled={resumeStatus === "parsed"} />
                    <Field label="Institution" value={institution} onChange={setInstitution} autoFilled={resumeStatus === "parsed"} />
                    <Field label="Year / Cohort" value={yearCohort} onChange={setYearCohort} autoFilled={resumeStatus === "parsed"} />
                  </div>

                  <div className="mb-8">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Career aspiration</label>
                    <textarea
                      value={aspiration}
                      onChange={(e) => setAspiration(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none shadow-sm font-medium"
                      placeholder="What kind of work and growth are you aiming for?"
                    />
                  </div>

                  <div className="flex justify-end">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStep(1)} 
                      className="group flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all duration-300"
                    >
                      Continue <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step-1"
                  variants={slideVariants as any}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full bg-white/50 backdrop-blur-2xl border border-white/60 rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 lg:p-12 shadow-2xl shadow-indigo-500/10 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-indigo-500 opacity-80" />
                  
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl sm:text-[2.75rem] font-black text-slate-900 tracking-tight mb-4 leading-tight">
                      Your primary objective?
                    </h2>
                    <p className="text-slate-500 font-medium">Select your track to calibrate the system appropriately.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                    <Choice
                      active={track === "placement"}
                      onClick={() => setTrack("placement")}
                      tag="Track 01"
                      title="Placement & Career"
                      desc="Job preparation, mock interviews, and industry readiness."
                      icon={<BriefcaseIcon className="w-6 h-6" />}
                    />
                    <Choice
                      active={track === "exam"}
                      onClick={() => setTrack("exam")}
                      tag="Track 02"
                      title="Competitive Exams"
                      desc="Long-term preparation for UPSC, GATE, GMAT, etc."
                      icon={<BookIcon className="w-6 h-6" />}
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <button onClick={() => setStep(0)} className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium">
                      <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back
                    </button>
                    <motion.button 
                      whileHover={track ? { scale: 1.02 } : {}}
                      whileTap={track ? { scale: 0.98 } : {}}
                      disabled={!track}
                      onClick={() => setStep(2)} 
                      className={`group flex items-center gap-2 px-8 py-4 rounded-full font-bold transition-all duration-300 ${
                        track ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      Continue <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-2"
                  variants={slideVariants as any}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full bg-white/50 backdrop-blur-2xl border border-white/60 rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 lg:p-12 shadow-2xl shadow-indigo-500/10 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-sky-500 opacity-80" />
                  
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl sm:text-[2.75rem] font-black text-slate-900 tracking-tight mb-4 leading-tight">
                      {track === "placement" ? "Which role are you targeting?" : "Which exam are you preparing for?"}
                    </h2>
                    <p className="text-slate-500 font-medium">
                      {track === "placement" 
                        ? "This grounds your interview questions and Fit Score weighting." 
                        : "This wires in the right success benchmarks and mock-test cadence."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
                    {(track === "placement" 
                      ? ["Full-stack Software Engineer", "Backend Engineer", "Frontend Engineer", "Data / ML Engineer", "Product Manager", "Consultant · Strategy"]
                      : ["UPSC Civil Services", "GATE · CSE", "CAT", "GMAT", "GRE", "Other"]
                    ).map((r) => (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={r}
                        onClick={() => setSelectedRole(r)}
                        className={`p-5 rounded-2xl border text-left transition-all duration-300 ${
                          selectedRole === r 
                            ? "border-indigo-500 bg-indigo-50/80 shadow-md shadow-indigo-500/10" 
                            : "border-white/60 bg-white/50 backdrop-blur-md hover:border-indigo-300 hover:bg-white/80 hover:shadow-lg hover:shadow-indigo-500/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${selectedRole === r ? "text-indigo-700" : "text-slate-700"}`}>{r}</span>
                          {selectedRole === r && (
                            <motion.div layoutId="check">
                              <CheckIcon className="w-5 h-5 text-indigo-600" />
                            </motion.div>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <button onClick={() => setStep(1)} className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium">
                      <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back
                    </button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStep(3)} 
                      className="group flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all duration-300"
                    >
                      Continue <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step-3"
                  variants={slideVariants as any}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full bg-white/50 backdrop-blur-2xl border border-white/60 rounded-3xl lg:rounded-[2.5rem] p-6 sm:p-10 lg:p-16 shadow-2xl shadow-indigo-500/10 relative overflow-hidden text-center"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-indigo-500 opacity-80" />
                  
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ type: "spring", damping: 15, stiffness: 100, delay: 0.2 }}
                    className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 to-sky-500 rounded-full flex items-center justify-center mb-8 shadow-xl shadow-indigo-200"
                  >
                    <CheckIcon className="w-12 h-12 text-white" />
                  </motion.div>

                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                    Calibration Complete
                  </h2>
                  <p className="text-lg text-slate-600 font-medium mb-2">
                    Routed into <span className="text-indigo-600 font-bold">{track === "exam" ? "Track 02" : "Track 01"}</span>
                  </p>
                  <p className="text-slate-500 font-medium max-w-sm mx-auto mb-10">
                    The platform has configured your evaluation methodology, benchmarks, and interaction model.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href={track === "exam" ? "/exam/anjali" : "/student/priya/interview/technical"}
                      onClick={persistDemoProfile}
                      className="w-full sm:w-auto"
                    >
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group w-full flex justify-center items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all duration-300"
                      >
                        {track === "exam" ? "Begin Track 02" : "Begin Technical Interview"}
                        <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                      </motion.button>
                    </Link>
                    <Link href="/student/priya" className="w-full sm:w-auto text-slate-500 hover:text-slate-900 font-medium transition-colors py-4">
                      Skip to dashboard
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, autoFilled = false }: any) {
  return (
    <div className="relative group">
      <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-2">
        {label}
        {autoFilled && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            Auto-filled
          </span>
        )}
      </label>
      <div className="relative">
        <input
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`w-full border rounded-2xl px-5 py-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-300 font-medium shadow-sm hover:shadow-md ${
            autoFilled ? "border-emerald-200 bg-emerald-50/50" : "border-white/60 bg-white/50 backdrop-blur-md hover:bg-white/80"
          }`}
        />
      </div>
    </div>
  );
}

function Choice({ active, onClick, tag, title, desc, icon }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`text-left rounded-3xl p-6 border transition-all duration-300 relative overflow-hidden ${
        active
          ? "border-indigo-500 bg-indigo-50/80 shadow-md shadow-indigo-500/10"
          : "border-white/60 bg-white/40 backdrop-blur-md hover:border-indigo-300 hover:bg-white/60 hover:shadow-lg hover:shadow-indigo-500/5"
      }`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
            active ? "bg-indigo-600 text-white" : "bg-white/50 border border-white/60 text-slate-500 group-hover:bg-white group-hover:text-indigo-600 transition-colors"
          }`}>
            {icon}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
            active ? "border-indigo-200 text-indigo-700 bg-indigo-100" : "border-white/60 text-slate-500 bg-white/50"
          }`}>
            {tag}
          </span>
        </div>
        <h3 className={`text-xl font-extrabold mb-2 ${active ? "text-slate-900" : "text-slate-800"}`}>{title}</h3>
        <p className={`text-sm font-medium leading-relaxed ${active ? "text-slate-700" : "text-slate-500"}`}>{desc}</p>
      </div>
    </motion.button>
  );
}

/* Icons */
function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowLeftIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12H5M11 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.7L20 10l-5 4 1.5 6L12 17l-4.5 3L9 14l-5-4 6.1-1.3z" />
    </svg>
  );
}
function BriefcaseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function BookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function DocIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
