"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PageShell, Card, Button, ButtonLink, Badge, Heading } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const steps = ["Profile", "Goal", "Context", "Done"];

const PLACEMENT_ROLES = [
  "Full-stack Software Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Data / ML Engineer",
  "Mobile Engineer (iOS/Android)",
  "DevOps / SRE Engineer",
  "Cloud Solutions Architect",
  "Embedded Systems Engineer",
  "QA / Test Automation Engineer",
  "Data Scientist / Analyst",
  "Product Manager",
  "Product Designer (UI/UX)",
  "Consultant · Strategy",
  "Business Analyst",
  "Human Resources Assistant",
  "Marketing Operations Specialist",
  "Financial Analyst"
];

const COMPETITIVE_EXAMS = [
  "UPSC Civil Services",
  "GATE · CSE",
  "CAT",
  "GMAT",
  "GRE",
  "IIT JEE",
  "NEET",
  "SAT / ACT",
  "TOEFL / IELTS",
  "Chartered Accountant (CA)",
  "CFA (Chartered Financial Analyst)",
  "SBI PO / IBPS Clerk"
];


type ParsedResume = {
  is_jd?: boolean;
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

  // JD and Validation state
  const [isJdUpload, setIsJdUpload] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Search input & Dropdown visibility states
  const [roleSearch, setRoleSearch] = useState("");
  const [examSearch, setExamSearch] = useState("");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showExamDropdown, setShowExamDropdown] = useState(false);
  // Keyboard-navigation cursor for the combobox listbox (-1 = no active option).
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);

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
      const r = await authedFetch("/api/parse-resume", { method: "POST", body: fd });
      // The endpoint always returns JSON; if we got HTML (a platform 500/504
      // error page), surface a clean message instead of a JSON parse crash.
      const rawBody = await r.text();
      let data: any;
      try {
        data = JSON.parse(rawBody);
      } catch {
        setResumeStatus("error");
        setResumeError(
          r.status >= 500
            ? "Resume parsing failed on the server. Please try again in a moment."
            : "Unexpected response from the server. Please try again."
        );
        return;
      }
      const elapsed = Math.round(performance.now() - t0);
      setParseMs(elapsed);

      if (!r.ok || !data.ok) {
        setResumeStatus("error");
        setResumeError(data?.error || "We couldn't parse this PDF. Please try a different resume file.");
        return;
      }

      setResumeSource(data.source || "");
      const p: ParsedResume = data.parsed || {};
      const isJd = !!p.is_jd;
      setIsJdUpload(isJd);

      if (isJd) {
        setFullName("");
        setEmail("");
        setInstitution("");
        setYearCohort("");
        setTrack("placement");
        if (p.target_role) {
          setSelectedRole(p.target_role);
        }
      } else {
        setFullName(p.full_name || "");
        setEmail(p.email || "");
        setInstitution(p.institution || "");
        setYearCohort(p.year_cohort || "");
        if (p.target_role) {
          setSelectedRole(p.target_role);
        }
      }
      setErrors({});

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

  function validateStep0() {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }
    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!institution.trim()) {
      newErrors.institution = "Institution / Company is required.";
    }
    if (!yearCohort.trim()) {
      newErrors.yearCohort = "Year / Cohort is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleContinueStep0() {
    if (validateStep0()) {
      setStep(1);
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

  // Keep the keyboard highlight valid: reset whenever the query or track changes.
  useEffect(() => {
    setActiveOptionIndex(-1);
  }, [roleSearch, examSearch, track]);

  async function persistDemoProfile() {
    try {
      const profileData = JSON.stringify({
        fullName,
        email,
        institution,
        yearCohort,
        aspiration,
        targetRole: selectedRole,
        resumeSummary: parsedExtras?.summary || "",
        resumeSkills: parsedExtras?.skills || [],
        resumeProjects: parsedExtras?.projects || [],
      });
      localStorage.setItem("taledge:demo-profile", profileData);
      localStorage.setItem("taledge:workspace-profile", profileData);

      if (auth.currentUser) {
        await updateDoc(doc(db, "candidates", auth.currentUser.uid), {
          institution,
          yearCohort,
          aspiration,
          targetRole: selectedRole,
          resumeSummary: parsedExtras?.summary || "",
          resumeSkills: parsedExtras?.skills || [],
          resumeProjects: parsedExtras?.projects || [],
        });
      }
    } catch (e) {
      console.error("Error persisting profile:", e);
    }
  }

  // ----- Accessible combobox (role/exam search) derived state -----
  // Computed once per render so the input's keyboard handler and the rendered
  // listbox stay perfectly in sync (same options, same indices).
  const comboQueryRaw = track === "placement" ? roleSearch : examSearch;
  const comboQuery = comboQueryRaw.trim().toLowerCase();
  const comboFullList = track === "placement" ? PLACEMENT_ROLES : COMPETITIVE_EXAMS;
  const comboFiltered = comboFullList.filter((item) => item.toLowerCase().includes(comboQuery));
  const comboShowCustom = !!comboQuery && !comboFullList.some((item) => item.toLowerCase() === comboQuery);
  // Flat list of selectable options in DOM order (filtered items, then optional custom-add).
  const comboOptions: { value: string; custom: boolean }[] = [
    ...comboFiltered.map((value) => ({ value, custom: false })),
    ...(comboShowCustom ? [{ value: comboQueryRaw.trim(), custom: true }] : []),
  ];
  const comboOpen =
    (track === "placement" && showRoleDropdown) || (track === "exam" && showExamDropdown);

  function closeCombo() {
    setShowRoleDropdown(false);
    setShowExamDropdown(false);
    setActiveOptionIndex(-1);
  }

  function openCombo() {
    if (track === "placement") setShowRoleDropdown(true);
    else setShowExamDropdown(true);
  }

  function commitComboOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSelectedRole(trimmed);
    if (track === "placement") setRoleSearch("");
    else setExamSearch("");
    closeCombo();
  }

  function onComboKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!comboOpen) {
        openCombo();
        return;
      }
      if (comboOptions.length === 0) return;
      setActiveOptionIndex((i) => (i + 1) % comboOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!comboOpen) {
        openCombo();
        return;
      }
      if (comboOptions.length === 0) return;
      setActiveOptionIndex((i) => (i <= 0 ? comboOptions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (comboOpen && activeOptionIndex >= 0 && activeOptionIndex < comboOptions.length) {
        e.preventDefault();
        commitComboOption(comboOptions[activeOptionIndex].value);
      }
    } else if (e.key === "Escape") {
      if (comboOpen) {
        e.preventDefault();
        closeCombo();
      }
    }
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
    <PageShell width="default" className="py-5 sm:py-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-5"
      >
        <Badge tone="brand" className="px-4 py-2">
          <SparklesIcon className="w-4 h-4 text-brand-600" aria-hidden="true" />
          <span className="text-sm font-bold tracking-wide">Onboarding</span>
        </Badge>
        <Link href="/" className="group flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 transition-colors font-medium">
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
          All roles
        </Link>
      </motion.header>

      {/* Stepper */}
      <div className="max-w-5xl mx-auto w-full mb-6">
        <div className="flex justify-between items-center relative">
          <div
            className="absolute top-6 -translate-y-1/2 h-[2px] bg-ink-200 -z-10 rounded-full overflow-hidden"
            style={{ left: `calc(50% / ${steps.length})`, right: `calc(50% / ${steps.length})` }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-brand-600 to-accent-500"
              initial={{ width: "0%" }}
              animate={{ width: `${(step / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-3">
              <motion.div
                layout
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm transition-all duration-500 shadow-panel",
                  i < step
                    ? "bg-gradient-to-br from-brand-600 to-accent-500 text-white border-none shadow-panel"
                    : i === step
                    ? "bg-white backdrop-blur-md border-[3px] border-brand-500 text-brand-600 shadow-panel"
                    : "bg-white/70 backdrop-blur-md border border-ink-200/60 text-ink-500"
                )}
              >
                {i < step ? <CheckIcon className="w-5 h-5" aria-hidden="true" /> : i + 1}
              </motion.div>
              <span className={cn("text-xs font-bold uppercase tracking-wider transition-colors duration-300", i <= step ? "text-ink-900" : "text-ink-500")}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        <div className="relative mx-auto w-full max-w-5xl">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step-0"
                variants={slideVariants as any}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <Card variant="frosted" className="rounded-xl3 p-5 sm:p-7 lg:p-9 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-600 to-accent-500 opacity-80" />

                  <div className="mb-6 text-center">
                    <Heading className="mb-4">
                      Tell us about yourself
                    </Heading>
                    <p className="text-ink-500 font-medium">Your profile shapes the assessment. Upload your resume to auto-fill.</p>
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
                        role="button"
                        tabIndex={0}
                        aria-label="Upload resume PDF. Drop a file here or activate to choose a file."
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        onDrop={onDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-xl3 border-2 border-dashed border-ink-300 hover:border-brand-400 bg-white/50 hover:bg-white/70 backdrop-blur-sm transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        <div className="w-16 h-16 rounded-xl2 bg-white border border-ink-200/60 shadow-panel flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-3 transition-transform duration-300">
                          <DocIcon className="w-8 h-8 text-brand-500" aria-hidden="true" />
                        </div>
                        <div className="text-lg font-bold text-ink-700 mb-1">Drop your resume PDF</div>
                        <div className="text-sm font-medium text-ink-500 mb-4">Max 10 MB · TalEdge AI Powered</div>
                        <Button variant="ghost" size="sm" type="button" className="rounded-full">
                          Choose File
                        </Button>
                      </div>
                    )}

                    {resumeStatus === "parsing" && (
                      <div role="status" aria-live="polite" className="flex items-center gap-4 p-6 rounded-xl2 border border-brand-200 bg-brand-50 relative overflow-hidden">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-200/50 to-transparent"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                        <div className="w-12 h-12 rounded-xl bg-brand-100 border border-brand-200 flex items-center justify-center animate-pulse z-10">
                          <DocIcon className="w-6 h-6 text-brand-600" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                          <div className="truncate text-ink-900 font-bold">{resumeFile?.name}</div>
                          <div className="text-sm font-medium text-ink-500">{resumeFile?.sizeKb} KB · AI Parsing...</div>
                        </div>
                      </div>
                    )}

                    {resumeStatus === "parsed" && (
                      <div className="flex items-center gap-4 p-6 rounded-xl2 border border-emerald-200 bg-emerald-50 relative">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                          <CheckIcon className="w-6 h-6 text-emerald-600" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-ink-900 font-bold">{resumeFile?.name}</div>
                          <div className="text-sm font-medium text-emerald-600/80">Parsed in {(parseMs / 1000).toFixed(1)}s</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm font-bold text-emerald-600 hover:text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
                        >
                          Replace
                        </button>
                      </div>
                    )}

                    {resumeStatus === "error" && (
                      <div className="flex items-center gap-4 p-6 rounded-xl2 border border-rose-200 bg-rose-50">
                        <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center">
                          <span className="text-rose-600 font-extrabold text-xl">!</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-ink-900 font-bold">Upload Failed</div>
                          <div className="text-sm font-medium text-rose-600/80">{resumeError}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="rounded-full"
                          onClick={() => {
                            setResumeStatus("idle");
                            setResumeFile(null);
                            setResumeError("");
                            fileInputRef.current?.click();
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>

                  {isJdUpload && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 flex gap-3.5 p-5 rounded-xl2 border border-amber-200 bg-amber-50/70 text-amber-800 backdrop-blur-md"
                    >
                      <AlertTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <div className="font-bold text-sm text-amber-900">Job Description Detected</div>
                        <div className="text-xs font-semibold text-amber-700 mt-0.5 leading-relaxed">
                          The uploaded file appears to be a Job Description. Please fill in your personal details manually.
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                    <Field
                      label="Full name"
                      value={fullName}
                      onChange={(val: string) => {
                        setFullName(val);
                        if (errors.fullName) setErrors(prev => ({ ...prev, fullName: "" }));
                      }}
                      autoFilled={resumeStatus === "parsed" && !isJdUpload}
                      error={errors.fullName}
                    />
                    <Field
                      label="Email"
                      value={email}
                      onChange={(val: string) => {
                        setEmail(val);
                        if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                      }}
                      autoFilled={resumeStatus === "parsed" && !isJdUpload}
                      error={errors.email}
                    />
                    <Field
                      label="Institution"
                      value={institution}
                      onChange={(val: string) => {
                        setInstitution(val);
                        if (errors.institution) setErrors(prev => ({ ...prev, institution: "" }));
                      }}
                      autoFilled={resumeStatus === "parsed" && !isJdUpload}
                      error={errors.institution}
                    />
                    <Field
                      label="Year / Cohort"
                      value={yearCohort}
                      onChange={(val: string) => {
                        setYearCohort(val);
                        if (errors.yearCohort) setErrors(prev => ({ ...prev, yearCohort: "" }));
                      }}
                      autoFilled={resumeStatus === "parsed" && !isJdUpload}
                      error={errors.yearCohort}
                    />
                  </div>

                  <div className="mb-8">
                    <label htmlFor="aspiration" className="block text-sm font-bold text-ink-700 mb-2">Career aspiration</label>
                    <textarea
                      id="aspiration"
                      value={aspiration}
                      onChange={(e) => setAspiration(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-ink-200 rounded-xl2 p-4 text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all resize-none shadow-panel font-medium"
                      placeholder="What kind of work and growth are you aiming for?"
                    />
                  </div>

                  <div className="flex justify-end">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        size="lg"
                        type="button"
                        onClick={handleContinueStep0}
                        className="group rounded-full"
                      >
                        Continue <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </Button>
                    </motion.div>
                  </div>
                </Card>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step-1"
                variants={slideVariants as any}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <Card variant="frosted" className="rounded-xl3 p-5 sm:p-7 lg:p-9 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-500 to-brand-600 opacity-80" />

                  <div className="mb-6 text-center">
                    <Heading className="mb-4">
                      Your primary objective?
                    </Heading>
                    <p className="text-ink-500 font-medium">Select your track to calibrate the system appropriately.</p>
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
                    <button type="button" onClick={() => setStep(0)} className="group flex items-center gap-2 text-ink-500 hover:text-ink-900 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md">
                      <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" /> Back
                    </button>
                    <motion.div whileHover={track ? { scale: 1.02 } : {}} whileTap={track ? { scale: 0.98 } : {}}>
                      <Button
                        size="lg"
                        type="button"
                        disabled={!track}
                        onClick={() => setStep(2)}
                        className="group rounded-full"
                      >
                        Continue <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </Button>
                    </motion.div>
                  </div>
                </Card>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                variants={slideVariants as any}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <Card variant="frosted" className="rounded-xl3 p-5 sm:p-7 lg:p-9 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-600 to-accent-500 opacity-80" />

                  <div className="mb-6 text-center">
                    <Heading className="mb-4">
                      {track === "placement" ? "Which role are you targeting?" : "Which exam are you preparing for?"}
                    </Heading>
                    <p className="text-ink-500 font-medium">
                      {track === "placement"
                        ? "This grounds your interview questions and Fit Score weighting."
                        : "This wires in the right success benchmarks and mock-test cadence."}
                    </p>
                    {isJdUpload && track === "placement" && (
                      <Badge tone="brand" className="mt-4">
                        <SparklesIcon className="w-3.5 h-3.5 text-brand-600 animate-pulse" aria-hidden="true" />
                        Target role auto-detected from Job Description
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {(() => {
                      const quickList = track === "placement"
                        ? ["Full-stack Software Engineer", "Backend Engineer", "Frontend Engineer", "Data / ML Engineer", "Product Manager", "Consultant · Strategy"]
                        : ["UPSC Civil Services", "GATE · CSE", "CAT", "GMAT", "GRE", "Other"];

                      const displayList = [...quickList];
                      if (selectedRole && !quickList.includes(selectedRole)) {
                        displayList.push(selectedRole);
                      }

                      return displayList.map((r) => (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          key={r}
                          aria-pressed={selectedRole === r}
                          onClick={() => setSelectedRole(r)}
                          className={cn(
                            "p-5 rounded-xl2 border text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                            selectedRole === r
                              ? "border-brand-500 bg-brand-50/80 shadow-panel"
                              : "border-ink-200/60 bg-white/60 backdrop-blur-md hover:border-brand-300 hover:bg-white/80 hover:shadow-panel-hover"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn("font-bold", selectedRole === r ? "text-brand-700" : "text-ink-700")}>{r}</span>
                            {selectedRole === r && (
                              <motion.div layoutId="check">
                                <CheckIcon className="w-5 h-5 text-brand-600" aria-hidden="true" />
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      ));
                    })()}
                  </div>

                  <div className="relative mb-10">
                    <label htmlFor="role-exam-combobox" className="block text-sm font-bold text-ink-700 mb-2">
                      Search all {track === "placement" ? "roles" : "exams"}...
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <SearchIcon className="w-5 h-5 text-ink-400" aria-hidden="true" />
                      </div>
                      <input
                        id="role-exam-combobox"
                        type="text"
                        role="combobox"
                        aria-expanded={comboOpen}
                        aria-controls="role-exam-listbox"
                        aria-autocomplete="list"
                        aria-activedescendant={
                          comboOpen && activeOptionIndex >= 0
                            ? `role-exam-option-${activeOptionIndex}`
                            : undefined
                        }
                        autoComplete="off"
                        placeholder={`Type to search or add custom ${track === "placement" ? "role" : "exam"}...`}
                        value={comboQueryRaw}
                        onChange={(e) => {
                          if (track === "placement") {
                            setRoleSearch(e.target.value);
                            setShowRoleDropdown(true);
                          } else {
                            setExamSearch(e.target.value);
                            setShowExamDropdown(true);
                          }
                        }}
                        onFocus={openCombo}
                        onKeyDown={onComboKeyDown}
                        className="w-full bg-white border border-ink-200 rounded-xl2 pl-12 pr-10 py-4 text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-medium shadow-panel hover:shadow-panel-hover"
                      />
                      {comboQueryRaw && (
                        <button
                          type="button"
                          aria-label={`Clear ${track === "placement" ? "role" : "exam"} search`}
                          onClick={() => {
                            if (track === "placement") {
                              setRoleSearch("");
                            } else {
                              setExamSearch("");
                            }
                          }}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-ink-500 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
                        >
                          <CloseIcon className="w-5 h-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {comboOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            aria-hidden="true"
                            onClick={closeCombo}
                          />
                          <motion.div
                            id="role-exam-listbox"
                            role="listbox"
                            aria-label={track === "placement" ? "Roles" : "Exams"}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute z-30 w-full mt-2 bg-white/95 backdrop-blur-xl border border-ink-200 rounded-xl2 shadow-panel max-h-60 overflow-y-auto"
                          >
                            <div className="p-2 flex flex-col gap-1">
                              {comboFiltered.map((item, idx) => {
                                const isActive = idx === activeOptionIndex;
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    id={`role-exam-option-${idx}`}
                                    role="option"
                                    aria-selected={selectedRole === item}
                                    onMouseEnter={() => setActiveOptionIndex(idx)}
                                    onClick={() => commitComboOption(item)}
                                    className={cn(
                                      "w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                                      selectedRole === item
                                        ? "bg-brand-50 text-brand-700"
                                        : isActive
                                        ? "bg-ink-50 text-ink-700"
                                        : "text-ink-700 hover:bg-ink-50"
                                    )}
                                  >
                                    <span>{item}</span>
                                    {selectedRole === item && <CheckIcon className="w-4 h-4 text-brand-600" aria-hidden="true" />}
                                  </button>
                                );
                              })}

                              {comboShowCustom && (() => {
                                const customIdx = comboFiltered.length;
                                const isActive = customIdx === activeOptionIndex;
                                return (
                                  <button
                                    type="button"
                                    id={`role-exam-option-${customIdx}`}
                                    role="option"
                                    aria-selected={false}
                                    onMouseEnter={() => setActiveOptionIndex(customIdx)}
                                    onClick={() => commitComboOption(comboQueryRaw.trim())}
                                    className={cn(
                                      "w-full text-left px-4 py-3 rounded-xl font-bold text-sm text-brand-600 transition-colors flex items-center gap-2 border border-dashed border-brand-200 mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                                      isActive ? "bg-brand-50" : "hover:bg-brand-50/50"
                                    )}
                                  >
                                    <SparklesIcon className="w-4 h-4 text-brand-500" aria-hidden="true" />
                                    <span>Use custom: "{comboQueryRaw}"</span>
                                  </button>
                                );
                              })()}

                              {comboFiltered.length === 0 && !comboShowCustom && (
                                <div className="px-4 py-3 text-sm font-medium text-ink-500 text-center">
                                  No {track === "placement" ? "roles" : "exams"} found.
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex justify-between items-center">
                    <button type="button" onClick={() => setStep(1)} className="group flex items-center gap-2 text-ink-500 hover:text-ink-900 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md">
                      <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" /> Back
                    </button>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        size="lg"
                        type="button"
                        onClick={() => setStep(3)}
                        className="group rounded-full"
                      >
                        Continue <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </Button>
                    </motion.div>
                  </div>
                </Card>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                variants={slideVariants as any}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                <Card variant="frosted" className="rounded-xl3 p-6 sm:p-10 lg:p-16 relative overflow-hidden text-center">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-brand-600 opacity-80" />

                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ type: "spring", damping: 15, stiffness: 100, delay: 0.2 }}
                    className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-600 to-accent-500 rounded-full flex items-center justify-center mb-8 shadow-panel"
                  >
                    <CheckIcon className="w-12 h-12 text-white" aria-hidden="true" />
                  </motion.div>

                  <Heading className="mb-4">
                    Calibration Complete
                  </Heading>
                  <p className="text-lg text-ink-600 font-medium mb-2">
                    Routed into <span className="text-brand-600 font-bold">{track === "exam" ? "Track 02" : "Track 01"}</span>
                  </p>
                  <p className="text-ink-500 font-medium max-w-sm mx-auto mb-10">
                    The platform has configured your evaluation methodology, benchmarks, and interaction model.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href={track === "exam" ? "/exam/aspirant-001" : "/student/candidate-001/dnla"}
                      onClick={persistDemoProfile}
                      className="w-full sm:w-auto"
                    >
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full"
                      >
                        <Button
                          size="lg"
                          type="button"
                          className="group w-full rounded-full text-lg"
                        >
                          {track === "exam" ? "Begin Track 02" : "Begin Technical Interview"}
                          <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </Button>
                      </motion.div>
                    </Link>
                    <Link href="/student/candidate-001" className="w-full sm:w-auto text-ink-500 hover:text-ink-900 font-medium transition-colors py-4">
                      Skip to dashboard
                    </Link>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}

function Field({ label, value, onChange, autoFilled = false, error }: any) {
  const fieldId = `field-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const errorId = `${fieldId}-error`;
  return (
    <div className="relative group">
      <label htmlFor={fieldId} className="flex items-center justify-between text-sm font-bold text-ink-700 mb-2">
        <span className={error ? "text-rose-600" : ""}>{label}</span>
        {autoFilled && !error && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            Auto-filled
          </span>
        )}
        {error && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
            Required
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full border rounded-xl2 px-5 py-4 text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-4 transition-all duration-300 font-medium shadow-panel hover:shadow-panel-hover",
            error
              ? "border-rose-300 bg-rose-50/20 focus:ring-rose-500/10 focus:border-rose-400"
              : autoFilled
              ? "border-emerald-200 bg-emerald-50/50 focus:ring-brand-500/10 focus:border-brand-500"
              : "border-ink-200/60 bg-white/60 backdrop-blur-md hover:bg-white/80 focus:ring-brand-500/10 focus:border-brand-500"
          )}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-bold text-rose-600">{error}</p>
      )}
    </div>
  );
}

function Choice({ active, onClick, tag, title, desc, icon }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "text-left rounded-xl3 p-6 border transition-all duration-300 relative overflow-hidden",
        active
          ? "border-brand-500 bg-brand-50/80 shadow-panel"
          : "border-ink-200/60 bg-white/50 backdrop-blur-md hover:border-brand-300 hover:bg-white/70 hover:shadow-panel-hover"
      )}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div aria-hidden="true" className={cn(
            "w-12 h-12 rounded-xl2 flex items-center justify-center shadow-panel",
            active ? "bg-brand-600 text-white" : "bg-white/60 border border-ink-200/60 text-ink-500 group-hover:bg-white group-hover:text-brand-600 transition-colors"
          )}>
            {icon}
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border",
            active ? "border-brand-200 text-brand-700 bg-brand-100" : "border-ink-200/60 text-ink-500 bg-white/60"
          )}>
            {tag}
          </span>
        </div>
        <h3 className={cn("text-xl font-extrabold mb-2", active ? "text-ink-900" : "text-ink-800")}>{title}</h3>
        <p className={cn("text-sm font-medium leading-relaxed", active ? "text-ink-700" : "text-ink-500")}>{desc}</p>
      </div>
    </motion.button>
  );
}

/* Icons */
type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

function ArrowRightIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowLeftIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <path d="M19 12H5M11 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SparklesIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l1.9 5.7L20 10l-5 4 1.5 6L12 17l-4.5 3L9 14l-5-4 6.1-1.3z" />
    </svg>
  );
}
function BriefcaseIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function BookIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function DocIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function CheckIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
