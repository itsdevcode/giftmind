"use client";

import { useCallback, useEffect, useState } from "react";
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
  type HealthCheckResponse,
  type User,
  type Recipient,
  type GiftProject,
  type RecommendationGeneration,
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

  // Load latest recommendation whenever selected project changes
  useEffect(() => {
    if (!token || !selectedProjectId) {
      setLatestGeneration(null);
      return;
    }
    setGenerationError(null);
    getLatestRecommendations(selectedProjectId, token)
      .then((data) => setLatestGeneration(data))
      .catch(() => setLatestGeneration(null));
  }, [selectedProjectId, token]);

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
          <span>🚀 Phase 3 Active: AI Gift Recommendations</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-300">Gemma 2 Inference Engine</span>
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
                      onChange={(e) => setSelectedProjectId(e.target.value)}
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
                    <span>✨</span> Gemma 2 AI Engine
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    Generate Recommendations
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Our prompt synthesis engine takes recipient interests, memories, and budget constraints
                    and feeds them into local Gemma 2 with strict JSON grammar and budget validation.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Provider:</span>
                    <span className="font-mono text-purple-300">Local Ollama / Gemma 2 2B</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Output Schema:</span>
                    <span className="font-mono text-slate-300">3 Distinct Ideas + Budget Validation</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Privacy:</span>
                    <span className="text-emerald-400">100% On-Premise Local</span>
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
          </div>
        )}
      </section>
    </div>
  );
}
