"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkBackendHealth,
  loginUser,
  registerUser,
  refreshAuth,
  logoutUser,
  getRecipients,
  createRecipient,
  getGiftProjects,
  createGiftProject,
  generateRecommendations,
  getLatestRecommendations,
  getMemories,
  updateMemories,
  generateStory,
  getLatestStory,
  updateStory,
  downloadStoryPdf,
  type HealthCheckResponse,
  type User,
  type Recipient,
  type GiftProject,
  type RecommendationGeneration,
  type MemoryAnswer,
  type MemoryAnswersListResponse,
  type StoryKeepsake,
} from "@/lib/api";

export default function HomePage() {
  // Backend health status
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  // Auth state (refresh tokens remain strictly in HttpOnly cookies, never in localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoadingInitial, setAuthLoadingInitial] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Recipients state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [newRecName, setNewRecName] = useState("");
  const [newRecRel, setNewRecRel] = useState("");
  const [newRecInterests, setNewRecInterests] = useState("");
  const [newRecNotes, setNewRecNotes] = useState("");
  const [recLoading, setRecLoading] = useState(false);

  // Projects state
  const [projects, setProjects] = useState<GiftProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newProjTitle, setNewProjTitle] = useState("");
  const [newProjOccasion, setNewProjOccasion] = useState("");
  const [newProjBudgetMin, setNewProjBudgetMin] = useState<string>("30");
  const [newProjBudgetMax, setNewProjBudgetMax] = useState<string>("100");
  const [projLoading, setProjLoading] = useState(false);

  // Recommendations state
  const [latestGeneration, setLatestGeneration] = useState<RecommendationGeneration | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Phase 4: Guided Memories State
  const [memories, setMemories] = useState<Record<string, string>>({
    how_we_met: "",
    favorite_memory: "",
    what_makes_them_special: "",
    shared_milestone: "",
    gift_feeling: "",
  });
  const [hasSufficientMemories, setHasSufficientMemories] = useState(false);
  const [memoryGuidance, setMemoryGuidance] = useState("");
  const [savingMemories, setSavingMemories] = useState(false);
  const [saveMemoriesFeedback, setSaveMemoriesFeedback] = useState<string | null>(null);

  // Phase 4: Story Keepsake State
  const [story, setStory] = useState<StoryKeepsake | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyTitleEdit, setStoryTitleEdit] = useState("");
  const [storyDedicationEdit, setStoryDedicationEdit] = useState("");
  const [storyBodyEdit, setStoryBodyEdit] = useState("");
  const [storyClosingEdit, setStoryClosingEdit] = useState("");
  const [storySaving, setStorySaving] = useState(false);
  const [storySaveSuccess, setStorySaveSuccess] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Helper to extract CSRF cookie from document.cookie if available
  const getCsrfCookie = (): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|;\s*)giftmind_csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  // Attempt silent session refresh on reload using HttpOnly cookie and CSRF cookie
  useEffect(() => {
    let isMounted = true;
    const existingCsrf = getCsrfCookie();

    refreshAuth(existingCsrf)
      .then((data) => {
        if (isMounted) {
          setToken(data.access_token);
          setCsrfToken(data.csrf_token);
          setCurrentUser(data.user);
        }
      })
      .catch(() => {
        // Not authenticated or expired refresh token; user will see sign-in form
      })
      .finally(() => {
        if (isMounted) setAuthLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Check backend health on mount
  useEffect(() => {
    let isMounted = true;
    checkBackendHealth()
      .then((data) => {
        if (isMounted) {
          setHealth(data);
          setHealthStatus("connected");
        }
      })
      .catch(() => {
        if (isMounted) setHealthStatus("disconnected");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch recipients & projects whenever access token changes
  const loadWorkspaceData = useCallback((authToken: string) => {
    Promise.all([getRecipients(authToken, 50, 0), getGiftProjects(authToken, 50, 0)])
      .then(([recData, projData]) => {
        const recList = recData.items || [];
        const projList = projData.items || [];
        setRecipients(recList);
        setSelectedRecipientId((prev) => (!prev && recList.length > 0 ? recList[0].id : prev));
        setProjects(projList);
        setSelectedProjectId((prev) => (!prev && projList.length > 0 ? projList[0].id : prev));
      })
      .catch((err: unknown) => {
        // If access token expired, try transparent refresh
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401) {
          refreshAuth(csrfToken)
            .then((fresh) => {
              setToken(fresh.access_token);
              setCsrfToken(fresh.csrf_token);
              setCurrentUser(fresh.user);
            })
            .catch(() => {
              // Complete session expiration
              setToken(null);
              setCurrentUser(null);
            });
        }
      });
  }, [csrfToken]);

  useEffect(() => {
    if (!token) {
      setRecipients([]);
      setProjects([]);
      setSelectedRecipientId("");
      setSelectedProjectId("");
      setLatestGeneration(null);
      return;
    }
    loadWorkspaceData(token);
  }, [token, loadWorkspaceData]);

  // Phase 4: Active project guard ref to avoid stale response races
  const activeProjectIdRef = useRef<string>("");

  const resetProjectSubresources = useCallback(() => {
    setLatestGeneration(null);
    setStory(null);
    setStoryTitleEdit("");
    setStoryDedicationEdit("");
    setStoryBodyEdit("");
    setStoryClosingEdit("");
    setMemories({
      how_we_met: "",
      favorite_memory: "",
      what_makes_them_special: "",
      shared_milestone: "",
      gift_feeling: "",
    });
    setHasSufficientMemories(false);
    setMemoryGuidance("");
    setGenerationError(null);
    setStoryError(null);
    setPdfError(null);
  }, []);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    activeProjectIdRef.current = projectId;
    resetProjectSubresources();
  };

  // Load latest recommendation, memories, and story whenever selected project changes
  useEffect(() => {
    activeProjectIdRef.current = selectedProjectId;
    if (!token || !selectedProjectId) {
      resetProjectSubresources();
      return;
    }

    const currentProjectId = selectedProjectId;
    resetProjectSubresources();

    // 1. Fetch recommendations
    getLatestRecommendations(currentProjectId, token)
      .then((data) => {
        if (activeProjectIdRef.current === currentProjectId) {
          setLatestGeneration(data);
        }
      })
      .catch(() => {
        if (activeProjectIdRef.current === currentProjectId) {
          setLatestGeneration(null);
        }
      });

    // 2. Fetch memories
    getMemories(currentProjectId, token)
      .then((data) => {
        if (activeProjectIdRef.current !== currentProjectId) return;
        const memMap: Record<string, string> = {
          how_we_met: "",
          favorite_memory: "",
          what_makes_them_special: "",
          shared_milestone: "",
          gift_feeling: "",
        };
        for (const ans of data.answers) {
          memMap[ans.question_key] = ans.answer;
        }
        setMemories(memMap);
        setHasSufficientMemories(data.has_sufficient_input);
        setMemoryGuidance(data.guidance_message);
      })
      .catch(() => {
        // No memories yet
      });

    // 3. Fetch latest story keepsake
    getLatestStory(currentProjectId, token)
      .then((data) => {
        if (activeProjectIdRef.current !== currentProjectId) return;
        setStory(data);
        setStoryTitleEdit(data.title);
        setStoryDedicationEdit(data.dedication);
        setStoryBodyEdit(data.story_body);
        setStoryClosingEdit(data.closing_message);
      })
      .catch(() => {
        if (activeProjectIdRef.current === currentProjectId) {
          setStory(null);
        }
      });
  }, [selectedProjectId, token, resetProjectSubresources]);

  const handleSaveMemories = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !csrfToken || !selectedProjectId) return;
    setSavingMemories(true);
    setSaveMemoriesFeedback(null);

    // Explicit memory deletion semantics: send all keys so blank inputs delete previously saved records
    const payload = Object.entries(memories).map(([k, ans]) => ({
      question_key: k,
      answer: ans,
    }));

    try {
      const res = await updateMemories(selectedProjectId, token, csrfToken, payload);
      setHasSufficientMemories(res.has_sufficient_input);
      setMemoryGuidance(res.guidance_message);
      setSaveMemoriesFeedback("✓ Memories saved successfully!");
      setTimeout(() => setSaveMemoriesFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save memories";
      setSaveMemoriesFeedback(`Error: ${msg}`);
    } finally {
      setSavingMemories(false);
    }
  };

  const handleGenerateStory = async () => {
    if (!token || !csrfToken || !selectedProjectId) return;
    setStoryLoading(true);
    setStoryError(null);

    try {
      const newStory = await generateStory(selectedProjectId, token, csrfToken);
      setStory(newStory);
      setStoryTitleEdit(newStory.title);
      setStoryDedicationEdit(newStory.dedication);
      setStoryBodyEdit(newStory.story_body);
      setStoryClosingEdit(newStory.closing_message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate story";
      setStoryError(msg);
    } finally {
      setStoryLoading(false);
    }
  };

  const handleSaveEditedStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !csrfToken || !selectedProjectId) return;
    setStorySaving(true);
    setStorySaveSuccess(false);

    try {
      const updated = await updateStory(selectedProjectId, token, csrfToken, {
        title: storyTitleEdit.trim(),
        dedication: storyDedicationEdit.trim(),
        story_body: storyBodyEdit.trim(),
        closing_message: storyClosingEdit.trim(),
      });
      setStory(updated);
      setStorySaveSuccess(true);
      setTimeout(() => setStorySaveSuccess(false), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save story changes");
    } finally {
      setStorySaving(false);
    }
  };

  const isStoryDirty = Boolean(
    story &&
      (storyTitleEdit.trim() !== story.title ||
        storyDedicationEdit.trim() !== story.dedication ||
        storyBodyEdit.trim() !== story.story_body ||
        storyClosingEdit.trim() !== story.closing_message)
  );

  const handleDownloadPdf = async () => {
    if (!token || !selectedProjectId) return;
    if (isStoryDirty) {
      const proceed = window.confirm(
        "You have unsaved story edits! The PDF keepsake will only include saved changes.\n\nClick 'Cancel' to return and click 'Save Story Edits' first, or 'OK' to proceed with the previously saved version."
      );
      if (!proceed) return;
    }
    setPdfDownloading(true);
    setPdfError(null);

    try {
      const blob = await downloadStoryPdf(selectedProjectId, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const rec = recipients.find((r) => r.id === selectedRecipientId);
      const recName = rec?.name ? rec.name.replace(/\s+/g, "_") : "Keepsake";
      a.download = `GiftMind_Keepsake_${recName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download PDF";
      setPdfError(msg);
    } finally {
      setPdfDownloading(false);
    }
  };


  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);

    try {
      if (authMode === "register") {
        // POST /api/v1/auth/register returns TokenResponse directly (no duplicate login call needed)
        const regData = await registerUser({
          name: authName,
          email: authEmail,
          password: authPassword,
        });
        setToken(regData.access_token);
        setCsrfToken(regData.csrf_token);
        setCurrentUser(regData.user);
      } else {
        const loginData = await loginUser({
          email: authEmail,
          password: authPassword,
        });
        setToken(loginData.access_token);
        setCsrfToken(loginData.csrf_token);
        setCurrentUser(loginData.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser(csrfToken);
    } catch {
      // Ignore network errors on logout
    } finally {
      // Completely wipe client memory and sensitive state
      setToken(null);
      setCsrfToken(null);
      setCurrentUser(null);
      setRecipients([]);
      setProjects([]);
      setSelectedRecipientId("");
      setSelectedProjectId("");
      setLatestGeneration(null);
      setAuthError(null);
    }
  };

  const handleCreateRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !csrfToken) return;
    setRecLoading(true);

    // Normalize comma-separated interests into a validated list[str]
    const normalizedInterests = newRecInterests
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    try {
      const rec = await createRecipient(token, csrfToken, {
        name: newRecName.trim(),
        relationship: newRecRel.trim(),
        interests: normalizedInterests.length > 0 ? normalizedInterests : undefined,
        notes: newRecNotes.trim() ? newRecNotes.trim() : undefined,
      });
      setRecipients((prev) => [rec, ...prev]);
      setSelectedRecipientId(rec.id);
      setNewRecName("");
      setNewRecRel("");
      setNewRecInterests("");
      setNewRecNotes("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create recipient");
    } finally {
      setRecLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !csrfToken || !selectedRecipientId) return;
    setProjLoading(true);

    const minBudget = newProjBudgetMin ? parseFloat(newProjBudgetMin) : 0;
    const maxBudget = parseFloat(newProjBudgetMax);

    if (isNaN(maxBudget) || maxBudget < minBudget) {
      alert("Maximum budget must be a valid number greater than or equal to minimum budget.");
      setProjLoading(false);
      return;
    }

    try {
      const proj = await createGiftProject(token, csrfToken, {
        recipient_id: selectedRecipientId,
        title: newProjTitle.trim(),
        occasion: newProjOccasion.trim(),
        budget_min: minBudget,
        budget_max: maxBudget,
        currency: "USD",
      });
      setProjects((prev) => [proj, ...prev]);
      setSelectedProjectId(proj.id);
      setNewProjTitle("");
      setNewProjOccasion("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create gift project");
    } finally {
      setProjLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!token || !csrfToken || !selectedProjectId) return;
    setGenerating(true);
    setGenerationError(null);

    try {
      const gen = await generateRecommendations(selectedProjectId, token, csrfToken);
      setLatestGeneration(gen);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate recommendations";
      setGenerationError(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Top Hero Banner */}
      <section className="relative overflow-hidden pt-12 pb-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -top-40 -translate-x-1/2 transform-gpu overflow-hidden blur-3xl"
        >
          <div className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#9333ea] to-[#4f46e5] opacity-25"></div>
        </div>

        {/* Phase Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-6">
          <span>📖 Phase 4 Active: Memory Interview, AI Story & PDF Keepsake</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-300">Hosted Gemma 4 26B Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4">
          GiftMind
        </h1>
        <p className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300 bg-clip-text text-transparent mb-4">
          Turn Memories Into Meaningful Gifts.
        </p>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
          Personalized, budget-conscious gift ideas generated with local LLM inference.
          No third-party trackers, no merchant affiliate links, complete data privacy.
        </p>

        {/* System Health Status */}
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-sm text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              healthStatus === "connected"
                ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                : healthStatus === "checking"
                ? "bg-amber-500 animate-pulse"
                : "bg-rose-500"
            }`}
          />
          <span className="text-slate-300 font-medium">Backend:</span>
          <span className="font-mono text-slate-400">
            {healthStatus === "connected" && health
              ? `${health.service} (${health.status})`
              : healthStatus === "checking"
              ? "Connecting..."
              : "Offline"}
          </span>
        </div>
      </section>

      {/* Main Workspace Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 w-full">
        {authLoadingInitial ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !currentUser ? (
          /* Authentication Card */
          <div className="max-w-md mx-auto p-8 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h2 className="text-lg font-bold text-white">
                {authMode === "register" ? "Create Your Account" : "Sign In to GiftMind"}
              </h2>
              <button
                type="button"
                id="toggle-auth-mode"
                onClick={() => {
                  setAuthMode(authMode === "register" ? "login" : "register");
                  setAuthError(null);
                }}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium underline"
              >
                {authMode === "register" ? "Already have an account?" : "Need an account?"}
              </button>
            </div>

            {authError && (
              <div id="auth-error-message" className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Your Name
                  </label>
                  <input
                    id="input-name"
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Arun Kumar"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  id="input-email"
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="arun@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  id="input-password"
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                id="submit-auth-button"
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50"
              >
                {authSubmitting ? "Processing..." : authMode === "register" ? "Sign Up & Continue" : "Sign In"}
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="space-y-8">
            {/* Top User Bar */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-sm">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div id="user-display-name" className="text-sm font-semibold text-white">{currentUser.name}</div>
                  <div className="text-xs text-slate-400">{currentUser.email}</div>
                </div>
              </div>
              <button
                id="sign-out-button"
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 transition-colors"
              >
                Sign Out
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Column 1: Recipient Profile */}
              <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/50 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>👥</span> 1. Recipient Profile
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Who are you finding a gift for?
                  </p>
                </div>

                {recipients.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Active Recipient
                    </label>
                    <select
                      id="select-recipient"
                      value={selectedRecipientId}
                      onChange={(e) => setSelectedRecipientId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                      {recipients.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.relationship})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <form onSubmit={handleCreateRecipient} className="space-y-3 pt-3 border-t border-white/5">
                  <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    Add New Recipient
                  </div>
                  <div>
                    <input
                      id="recipient-name-input"
                      type="text"
                      required
                      placeholder="Name (e.g. Maya Lin)"
                      value={newRecName}
                      onChange={(e) => setNewRecName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <input
                      id="recipient-relationship-input"
                      type="text"
                      required
                      placeholder="Relationship (e.g. Close Friend, Sister)"
                      value={newRecRel}
                      onChange={(e) => setNewRecRel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <input
                      id="recipient-interests-input"
                      type="text"
                      placeholder="Interests (comma-separated, e.g. coffee, analog photography)"
                      value={newRecInterests}
                      onChange={(e) => setNewRecInterests(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <textarea
                      id="recipient-notes-input"
                      rows={2}
                      placeholder="Personal notes & quirks..."
                      value={newRecNotes}
                      onChange={(e) => setNewRecNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    id="submit-recipient-button"
                    type="submit"
                    disabled={recLoading}
                    className="w-full py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {recLoading ? "Saving..." : "+ Save Recipient"}
                  </button>
                </form>
              </div>

              {/* Column 2: Gift Project Setup */}
              <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/50 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🎁</span> 2. Gift Project
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Set the occasion, budget constraints, and parameters.
                  </p>
                </div>

                {projects.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Active Project
                    </label>
                    <select
                      id="select-project"
                      value={selectedProjectId}
                      onChange={(e) => handleSelectProject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.occasion})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <form onSubmit={handleCreateProject} className="space-y-3 pt-3 border-t border-white/5">
                  <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    Create New Project
                  </div>
                  <div>
                    <input
                      id="project-title-input"
                      type="text"
                      required
                      placeholder="Project Title (e.g. Maya's 30th Birthday)"
                      value={newProjTitle}
                      onChange={(e) => setNewProjTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <input
                      id="project-occasion-input"
                      type="text"
                      required
                      placeholder="Occasion (e.g. 30th Birthday, Housewarming)"
                      value={newProjOccasion}
                      onChange={(e) => setNewProjOccasion(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-0.5">Min ($)</label>
                      <input
                        id="project-budget-min"
                        type="number"
                        min="0"
                        placeholder="30"
                        value={newProjBudgetMin}
                        onChange={(e) => setNewProjBudgetMin(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950/60 border border-white/10 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase mb-0.5">Max ($)</label>
                      <input
                        id="project-budget-max"
                        type="number"
                        min="0"
                        required
                        placeholder="120"
                        value={newProjBudgetMax}
                        onChange={(e) => setNewProjBudgetMax(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950/60 border border-white/10 text-white text-xs"
                      />
                    </div>
                  </div>
                  <button
                    id="submit-project-button"
                    type="submit"
                    disabled={projLoading || !selectedRecipientId}
                    className="w-full py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {projLoading ? "Creating..." : "+ Create Project"}
                  </button>
                </form>
              </div>

              {/* Column 3: AI Inference Engine Trigger */}
              <div className="p-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 flex flex-col justify-between space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wider">
                    <span>✨</span> Gemma 4 AI Engine
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    Generate Recommendations
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Our prompt synthesis engine takes recipient interests, memories, and budget constraints
                    and feeds them into hosted Gemma 4 26B with strict JSON grammar and budget validation.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Provider:</span>
                    <span className="font-mono text-purple-300">Google Gemini API / Gemma 4 26B</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Output Schema:</span>
                    <span className="font-mono text-slate-300">3 Distinct Ideas + Budget Validation</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Model Architecture:</span>
                    <span className="text-emerald-400">Open-Weight Gemma 4</span>
                  </div>
                </div>

                {generationError && (
                  <div id="generation-error-message" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {generationError}
                  </div>
                )}

                <button
                  type="button"
                  id="btn-generate-recommendations"
                  onClick={handleGenerate}
                  disabled={generating || !selectedProjectId}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Synthesizing Ideas with Gemma...</span>
                    </>
                  ) : (
                    <>
                      <span>✨ Generate 3 Gift Ideas</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Recommendations Display */}
            {latestGeneration && (
              <div id="recommendations-container" className="pt-8 border-t border-white/10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                      <span>🎯</span> AI-Curated Gift Recommendations
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Engine: {latestGeneration.provider} ({latestGeneration.model}) • Status: {latestGeneration.status} • Prompt {latestGeneration.prompt_version} • Generated {new Date(latestGeneration.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <span>✓</span> Verified Unique & Budget-Aligned
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {latestGeneration.recommendations.map((rec, idx) => (
                    <div
                      key={rec.id}
                      data-recommendation-card
                      className="p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/80 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-4 shadow-xl"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 text-xs font-bold font-mono">
                            0{idx + 1}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-purple-300">
                            {rec.category}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-white leading-snug">
                          {rec.title}
                        </h3>

                        <div className="inline-block px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm font-semibold font-mono">
                          ~ ${parseFloat(rec.estimated_budget).toFixed(2)} {rec.currency}
                        </div>

                        {rec.description && (
                          <p className="text-xs text-slate-300 leading-relaxed font-normal">
                            {rec.description}
                          </p>
                        )}

                        <div className="space-y-1.5 pt-2">
                          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                            Why this fits:
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {rec.personalization_reason}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-1 bg-purple-950/20 -mx-6 -mb-6 p-4 rounded-b-2xl">
                        <div className="text-[11px] uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1.5">
                          <span>🎀</span> Presentation Suggestion
                        </div>
                        <p className="text-xs text-slate-300 italic">
                          &ldquo;{rec.presentation_idea}&rdquo;
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PHASE 4: GUIDED MEMORY INTERVIEW */}
            {selectedProjectId && (
              <div id="memory-interview-section" className="pt-10 border-t border-white/10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-400 mb-1 uppercase tracking-wider">
                      <span>🕊️</span> Step 3 &bull; Guided Memory Interview
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      Share Meaningful Memories
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Answer the five prompts below to ground Gemma 4&apos;s narrative story strictly in your authentic shared moments.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                        hasSufficientMemories
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                          : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                      }`}
                    >
                      <span>{hasSufficientMemories ? "✓" : "!"}</span>
                      {hasSufficientMemories ? "Story Input Ready" : "Need More Detail"}
                    </span>
                  </div>
                </div>

                {memoryGuidance && (
                  <div className={`p-3.5 rounded-xl text-xs border ${
                    hasSufficientMemories
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                      : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                  }`}>
                    {memoryGuidance}
                  </div>
                )}

                <form onSubmit={handleSaveMemories} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Prompt 1 */}
                    <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
                      <label htmlFor="memory-how-we-met" className="block text-xs font-semibold text-purple-300">
                        1. How did you first meet this person?
                      </label>
                      <textarea
                        id="memory-how-we-met"
                        rows={3}
                        placeholder="Tell the story of that first encounter or where your paths crossed..."
                        value={memories.how_we_met || ""}
                        onChange={(e) =>
                          setMemories((prev) => ({ ...prev, how_we_met: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Prompt 2 */}
                    <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
                      <label htmlFor="memory-favorite-memory" className="block text-xs font-semibold text-purple-300">
                        2. What is your favorite memory together?
                      </label>
                      <textarea
                        id="memory-favorite-memory"
                        rows={3}
                        placeholder="A trip, late-night conversation, celebration, or quiet moment..."
                        value={memories.favorite_memory || ""}
                        onChange={(e) =>
                          setMemories((prev) => ({ ...prev, favorite_memory: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Prompt 3 */}
                    <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
                      <label htmlFor="memory-what-makes-special" className="block text-xs font-semibold text-purple-300">
                        3. What makes this person special to you?
                      </label>
                      <textarea
                        id="memory-what-makes-special"
                        rows={3}
                        placeholder="Their humor, resilience, empathy, kindness, or quirky charm..."
                        value={memories.what_makes_them_special || ""}
                        onChange={(e) =>
                          setMemories((prev) => ({ ...prev, what_makes_them_special: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Prompt 4 */}
                    <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
                      <label htmlFor="memory-shared-milestone" className="block text-xs font-semibold text-purple-300">
                        4. What challenge, milestone or experience have you shared?
                      </label>
                      <textarea
                        id="memory-shared-milestone"
                        rows={3}
                        placeholder="A hurdle you navigated together, a life milestone, or a shared triumph..."
                        value={memories.shared_milestone || ""}
                        onChange={(e) =>
                          setMemories((prev) => ({ ...prev, shared_milestone: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Prompt 5 Full Width */}
                  <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
                    <label htmlFor="memory-gift-feeling" className="block text-xs font-semibold text-purple-300">
                      5. What do you want this person to remember or feel when receiving this gift?
                    </label>
                    <textarea
                      id="memory-gift-feeling"
                      rows={2}
                      placeholder="e.g. Cherished, seen, reminded of their strength, or deeply appreciated..."
                      value={memories.gift_feeling || ""}
                      onChange={(e) =>
                        setMemories((prev) => ({ ...prev, gift_feeling: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <div className="text-xs text-slate-400">
                      {saveMemoriesFeedback && (
                        <span className={saveMemoriesFeedback.startsWith("✓") ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
                          {saveMemoriesFeedback}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        id="btn-save-memories"
                        type="submit"
                        disabled={savingMemories}
                        className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-white/15 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {savingMemories ? "Saving..." : "Save Memories"}
                      </button>
                      <button
                        id="btn-generate-story"
                        type="button"
                        onClick={handleGenerateStory}
                        disabled={storyLoading || !hasSufficientMemories}
                        className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-pink-600/25 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {storyLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Crafting Story with Gemma (30-60s)...</span>
                          </>
                        ) : (
                          <>
                            <span>✨ Generate AI Story Keepsake</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {storyError && (
                  <div id="story-error-message" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {storyError}
                  </div>
                )}
              </div>
            )}

            {/* PHASE 4: STORY KEEPSAKE PREVIEW, EDITING & PDF DOWNLOAD */}
            {story && (
              <div id="story-keepsake-container" className="pt-10 border-t border-white/10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1 uppercase tracking-wider">
                      <span>📜</span> Step 4 &bull; Personalized Narrative Keepsake
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                      <span>&ldquo;</span>{story.title}<span>&rdquo;</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Model: {story.model_name} &bull; Prompt {story.prompt_version} &bull; Generated {new Date(story.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                    {isStoryDirty && (
                      <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                        ⚠️ Unsaved story edits
                      </span>
                    )}
                    <button
                      id="btn-download-pdf"
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={pdfDownloading}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-600/30 flex items-center gap-2 disabled:opacity-50"
                    >
                      {pdfDownloading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                          <span>Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <span>📥 Download PDF Keepsake</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {pdfError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {pdfError}
                  </div>
                )}

                {/* Editable Story Form */}
                <form onSubmit={handleSaveEditedStory} className="p-6 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-slate-900/90 to-slate-950/90 space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>✏️</span> Review &amp; Personalize Story Keepsake
                    </span>
                    {storySaveSuccess && (
                      <span className="text-xs text-emerald-400 font-semibold">
                        ✓ Story saved successfully!
                      </span>
                    )}
                  </div>

                  <div>
                    <label htmlFor="story-title-input" className="block text-xs font-semibold text-slate-300 mb-1">
                      Story Title
                    </label>
                    <input
                      id="story-title-input"
                      type="text"
                      required
                      value={storyTitleEdit}
                      onChange={(e) => setStoryTitleEdit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="story-dedication-input" className="block text-xs font-semibold text-slate-300 mb-1">
                      Dedication
                    </label>
                    <textarea
                      id="story-dedication-input"
                      rows={2}
                      required
                      value={storyDedicationEdit}
                      onChange={(e) => setStoryDedicationEdit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-xs italic focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="story-body-input" className="block text-xs font-semibold text-slate-300 mb-1">
                      Story Body (350–550 words suggested)
                    </label>
                    <textarea
                      id="story-body-input"
                      rows={12}
                      required
                      value={storyBodyEdit}
                      onChange={(e) => setStoryBodyEdit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-xs leading-relaxed focus:outline-none focus:border-amber-500"
                    />
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                      <span>Word count: {storyBodyEdit.trim().split(/\s+/).filter(Boolean).length} words</span>
                      <span>Rendered directly into in-memory PDF keepsake</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="story-closing-input" className="block text-xs font-semibold text-slate-300 mb-1">
                      Closing Blessing &amp; Message
                    </label>
                    <textarea
                      id="story-closing-input"
                      rows={2}
                      required
                      value={storyClosingEdit}
                      onChange={(e) => setStoryClosingEdit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      id="btn-save-story-changes"
                      type="submit"
                      disabled={storySaving}
                      className="px-6 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {storySaving ? "Saving Story..." : "💾 Save Story Edits"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

