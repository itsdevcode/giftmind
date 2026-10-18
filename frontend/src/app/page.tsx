"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeroSection } from "@/components/layout/HeroSection";
import { ExperienceSelector } from "@/components/gifts/ExperienceSelector";
import { StepIndicator, type StepItem } from "@/components/ui/StepIndicator";
import { RecipientStep } from "@/components/gifts/RecipientStep";
import { GiftProjectStep } from "@/components/gifts/GiftProjectStep";
import { GiftRecommendationsWorkspace } from "@/components/gifts/GiftRecommendationsWorkspace";
import { MemoryInterview } from "@/components/story/MemoryInterview";
import { StoryEditor } from "@/components/story/StoryEditor";
import { AuthModal } from "@/components/auth/AuthModal";
import { Gift, BookHeart, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { CulturalDivider, HeritageArch, MandalaAccent, LotusFlowerPattern } from "@/components/illustrations/CulturalMotifs";
import {
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
  getRecommendationGenerationStatus,
  subscribeAuth,
  setAuthSession,
  getMemories,
  updateMemories,
  generateStory,
  getLatestStory,
  getStoryStatus,
  updateStory,
  downloadStoryPdf,
  type User,
  type Recipient,
  type GiftProject,
  type RecommendationGeneration,
  type StoryKeepsake,
} from "@/lib/api";

const PROGRESS_STEPS: StepItem[] = [
  { id: 1, label: "1. Recipient Profile", description: "Who the gift is for" },
  { id: 2, label: "2. Gift Project", description: "Occasion & budget" },
  { id: 3, label: "3. Choose Creation", description: "AI Gift Ideas or Story" },
];

export default function HomePage() {
  // Navigation & Experience Selection
  const [activeExperience, setActiveExperience] = useState<"gifts" | "story">("gifts");
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoadingInitial, setAuthLoadingInitial] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [recLoading, setRecLoading] = useState(false);

  // Projects
  const [projects, setProjects] = useState<GiftProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projLoading, setProjLoading] = useState(false);

  // Recommendations
  const [latestGeneration, setLatestGeneration] = useState<RecommendationGeneration | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Memory Interview
  const [memories, setMemories] = useState<Record<string, string>>({
    how_we_met: "",
    favorite_memory: "",
    what_makes_them_special: "",
    shared_milestone: "",
    gift_feeling: "",
  });
  const [hasSufficientMemories, setHasSufficientMemories] = useState(false);
  const [memoryGuidance, setMemoryGuidance] = useState("");

  // Story Keepsake
  const [story, setStory] = useState<StoryKeepsake | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);

  // Project identity guard ref to prevent race conditions across fast switches
  const activeProjectIdRef = useRef<string>("");

  // Polling reference for asynchronous recommendation generations
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopPollingRecommendations = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  // Polling reference for asynchronous story keepsake generations
  const storyPollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopPollingStory = useCallback(() => {
    if (storyPollingTimeoutRef.current) {
      clearTimeout(storyPollingTimeoutRef.current);
      storyPollingTimeoutRef.current = null;
    }
  }, []);

  // Clean up polling timers when component unmounts
  useEffect(() => {
    return () => {
      stopPollingRecommendations();
      stopPollingStory();
    };
  }, [stopPollingRecommendations, stopPollingStory]);

  // Subscribe to transparent token refresh from api.ts
  useEffect(() => {
    const unsubscribe = subscribeAuth((session) => {
      if (session.token !== undefined) setToken(session.token);
      if (session.csrfToken !== undefined) setCsrfToken(session.csrfToken);
      if (session.user !== undefined) setCurrentUser(session.user);
    });
    return unsubscribe;
  }, []);

  // Helper: extract CSRF cookie from document.cookie
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
          setAuthSession(data);
          setToken(data.access_token);
          setCsrfToken(data.csrf_token);
          setCurrentUser(data.user);
        }
      })
      .catch(() => {
        // Unauthenticated visitor: demo or sign-in available
      })
      .finally(() => {
        if (isMounted) setAuthLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch recipients & projects
  const loadWorkspaceData = useCallback((authToken: string) => {
    Promise.all([getRecipients(authToken, 50, 0), getGiftProjects(authToken, 50, 0)])
      .then(([recData, projData]) => {
        const recList = recData.items || [];
        const projList = projData.items || [];
        setRecipients(recList);
        setProjects(projList);

        if (recList.length > 0 && !selectedRecipientId) {
          setSelectedRecipientId(recList[0].id);
        }
        if (projList.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projList[0].id);
          setCurrentStep(3); // Already configured, go directly to studio
        } else if (recList.length > 0) {
          setCurrentStep(2);
        } else {
          setCurrentStep(1);
        }
      })
      .catch((err: unknown) => {
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401) {
          refreshAuth(csrfToken)
            .then((fresh) => {
              setToken(fresh.access_token);
              setCsrfToken(fresh.csrf_token);
              setCurrentUser(fresh.user);
            })
            .catch(() => {
              setToken(null);
              setCurrentUser(null);
            });
        }
      });
  }, [csrfToken, selectedRecipientId, selectedProjectId]);

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

  // Reset project-scoped subresources immediately on project switch
  const resetProjectSubresources = useCallback(() => {
    stopPollingRecommendations();
    stopPollingStory();
    setLatestGeneration(null);
    setStory(null);
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
    setGenerating(false);
    setStoryLoading(false);
  }, [stopPollingRecommendations, stopPollingStory]);

  const handleSelectProject = (projectId: string) => {
    if (projectId === selectedProjectId) return;
    setSelectedProjectId(projectId);
    activeProjectIdRef.current = projectId;
    resetProjectSubresources();
  };

  // Start polling recommendation generation status at bounded interval (2.5s)
  const startPollingRecommendations = useCallback(
    (projectId: string, generationId?: string) => {
      stopPollingRecommendations();
      setGenerating(true);
      setGenerationError(null);

      let attempts = 0;
      // Budget aligns with settings.full_inference_retry_budget_seconds (~420s)
      // 180 attempts * 2.5s = 450s, preventing premature frontend abandonment
      const maxAttempts = 180;

      const pollTick = async () => {
        if (activeProjectIdRef.current !== projectId) {
          stopPollingRecommendations();
          return;
        }

        attempts++;
        try {
          const latest = generationId
            ? await getRecommendationGenerationStatus(projectId, generationId, token || "")
            : await getLatestRecommendations(projectId, token || "");

          if (activeProjectIdRef.current !== projectId) return;

          setLatestGeneration(latest);

          if (latest.status === "succeeded") {
            setGenerating(false);
            stopPollingRecommendations();
            return;
          }

          if (latest.status === "failed") {
            setGenerating(false);
            setGenerationError(latest.error_message || "Generation failed. Please try again.");
            stopPollingRecommendations();
            return;
          }

          // Still pending
          if (attempts >= maxAttempts) {
            setGenerating(false);
            setGenerationError("Generation timed out. Please try again.");
            stopPollingRecommendations();
            return;
          }

          pollingTimeoutRef.current = setTimeout(pollTick, 2500);
        } catch (err: unknown) {
          if (activeProjectIdRef.current !== projectId) return;
          if (attempts >= maxAttempts) {
            setGenerating(false);
            setGenerationError(
              err instanceof Error ? err.message : "Failed to retrieve generation status."
            );
            stopPollingRecommendations();
          } else {
            pollingTimeoutRef.current = setTimeout(pollTick, 2500);
          }
        }
      };

      pollingTimeoutRef.current = setTimeout(pollTick, 2500);
    },
    [token, stopPollingRecommendations]
  );

  // Start polling story keepsake generation status at bounded interval (2.5s)
  const startPollingStory = useCallback(
    (projectId: string, storyId?: string) => {
      stopPollingStory();
      setStoryLoading(true);
      setStoryError(null);

      let attempts = 0;
      // Budget aligns with settings.full_inference_retry_budget_seconds (~420s)
      // 180 attempts * 2.5s = 450s, preventing premature frontend abandonment
      const maxAttempts = 180;

      const pollTick = async () => {
        if (activeProjectIdRef.current !== projectId) {
          stopPollingStory();
          return;
        }

        attempts++;
        try {
          const latest = storyId
            ? await getStoryStatus(projectId, storyId, token || "")
            : await getLatestStory(projectId, token || "");

          if (activeProjectIdRef.current !== projectId) return;

          setStory(latest);

          if (latest.status === "succeeded") {
            setStoryLoading(false);
            stopPollingStory();
            return;
          }

          if (latest.status === "failed") {
            setStoryLoading(false);
            setStoryError(latest.error_message || "Story generation failed. Please try again.");
            stopPollingStory();
            return;
          }

          // Still pending
          if (attempts >= maxAttempts) {
            setStoryLoading(false);
            setStoryError("Story generation timed out. Please try again.");
            stopPollingStory();
            return;
          }

          storyPollingTimeoutRef.current = setTimeout(pollTick, 2500);
        } catch (err: unknown) {
          if (activeProjectIdRef.current !== projectId) return;
          if (attempts >= maxAttempts) {
            setStoryLoading(false);
            setStoryError(
              err instanceof Error ? err.message : "Failed to retrieve story keepsake status."
            );
            stopPollingStory();
          } else {
            storyPollingTimeoutRef.current = setTimeout(pollTick, 2500);
          }
        }
      };

      storyPollingTimeoutRef.current = setTimeout(pollTick, 2500);
    },
    [token, stopPollingStory]
  );

  // Load project subresources whenever selectedProjectId changes
  useEffect(() => {
    activeProjectIdRef.current = selectedProjectId;
    if (!token || !selectedProjectId) {
      resetProjectSubresources();
      return;
    }

    const currentProjectId = selectedProjectId;
    resetProjectSubresources();

    // 1. Latest recommendations
    getLatestRecommendations(currentProjectId, token)
      .then((data) => {
        if (activeProjectIdRef.current === currentProjectId) {
          setLatestGeneration(data);
          if (data.status === "pending") {
            startPollingRecommendations(currentProjectId, data.id);
          } else {
            setGenerating(false);
          }
        }
      })
      .catch(() => {
        if (activeProjectIdRef.current === currentProjectId) {
          setLatestGeneration(null);
          setGenerating(false);
        }
      });

    // 2. Saved memory interview answers
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
        // No saved memories
      });

    // 3. Latest Story Keepsake
    getLatestStory(currentProjectId, token)
      .then((data) => {
        if (activeProjectIdRef.current === currentProjectId) {
          setStory(data);
          if (data.status === "pending") {
            startPollingStory(currentProjectId, data.id);
          } else {
            setStoryLoading(false);
            if (data.status === "failed") {
              setStoryError(data.error_message || "Story generation failed. Please try again.");
            }
          }
        }
      })
      .catch(() => {
        if (activeProjectIdRef.current === currentProjectId) {
          setStory(null);
          setStoryLoading(false);
        }
      });
  }, [
    selectedProjectId,
    token,
    resetProjectSubresources,
    startPollingRecommendations,
    startPollingStory,
  ]);

  // Auth Submit Handler
  const handleAuthSubmit = async (
    mode: "login" | "register",
    payload: { name?: string; email: string; password: string }
  ) => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      let authResult;
      if (mode === "register") {
        authResult = await registerUser({
          name: payload.name || "GiftMind User",
          email: payload.email,
          password: payload.password,
        });
      } else {
        authResult = await loginUser({
          email: payload.email,
          password: payload.password,
        });
      }
      setToken(authResult.access_token);
      setCsrfToken(authResult.csrf_token);
      setCurrentUser(authResult.user);
      setAuthModalOpen(false);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (csrfToken) {
        await logoutUser(csrfToken);
      }
    } catch {
      // Ignore network errors on logout
    }
    setToken(null);
    setCsrfToken(null);
    setCurrentUser(null);
    resetProjectSubresources();
    setCurrentStep(1);
  };

  // Recipient Creation
  const handleCreateRecipient = async (payload: {
    name: string;
    relationship: string;
    interests?: string[];
    notes?: string;
  }) => {
    if (!token || !csrfToken) {
      setAuthModalOpen(true);
      return;
    }
    setRecLoading(true);
    try {
      const created = await createRecipient(token, csrfToken, payload);
      setRecipients((prev) => [created, ...prev]);
      setSelectedRecipientId(created.id);
      setCurrentStep(2);
    } finally {
      setRecLoading(false);
    }
  };

  // Project Creation
  const handleCreateProject = async (payload: {
    recipient_id: string;
    title: string;
    occasion: string;
    budget_min?: number | null;
    budget_max: number;
    currency?: string;
  }) => {
    if (!token || !csrfToken) {
      setAuthModalOpen(true);
      return;
    }
    setProjLoading(true);
    try {
      const created = await createGiftProject(token, csrfToken, payload);
      setProjects((prev) => [created, ...prev]);
      setSelectedProjectId(created.id);
      activeProjectIdRef.current = created.id;
      resetProjectSubresources();
      setCurrentStep(3);
    } finally {
      setProjLoading(false);
    }
  };

  // Recommendation Generation
  const handleGenerateRecommendations = async () => {
    if (!token || !csrfToken || !selectedProjectId) {
      if (!currentUser) setAuthModalOpen(true);
      return;
    }
    if (generating) return; // Prevent duplicate submissions
    const targetProjectId = selectedProjectId;
    setGenerating(true);
    setGenerationError(null);

    try {
      const gen = await generateRecommendations(targetProjectId, token, csrfToken);
      if (activeProjectIdRef.current === targetProjectId) {
        setLatestGeneration(gen);
        if (gen.status === "succeeded") {
          setGenerating(false);
        } else if (gen.status === "failed") {
          setGenerating(false);
          setGenerationError(gen.error_message || "Generation failed. Please try again.");
        } else {
          startPollingRecommendations(targetProjectId, gen.id);
        }
      }
    } catch (err: unknown) {
      if (activeProjectIdRef.current === targetProjectId) {
        setGenerating(false);
        setGenerationError(err instanceof Error ? err.message : "Failed to generate recommendations");
      }
    }
  };

  // Memory Answers Update
  const handleSaveMemories = async (answersPayload: { question_key: string; answer: string }[]) => {
    if (!token || !csrfToken || !selectedProjectId) {
      if (!currentUser) setAuthModalOpen(true);
      throw new Error("Please sign in to save your memories.");
    }
    const targetProjectId = selectedProjectId;
    const res = await updateMemories(targetProjectId, token, csrfToken, answersPayload);
    if (activeProjectIdRef.current === targetProjectId) {
      setHasSufficientMemories(res.has_sufficient_input);
      setMemoryGuidance(res.guidance_message);
      const newMap: Record<string, string> = {};
      for (const a of res.answers) {
        newMap[a.question_key] = a.answer;
      }
      setMemories(newMap);
    }
    return res;
  };

  // Story Generation
  const handleGenerateStory = async () => {
    if (!token || !csrfToken || !selectedProjectId) {
      if (!currentUser) setAuthModalOpen(true);
      return;
    }
    const targetProjectId = selectedProjectId;
    setStoryLoading(true);
    setStoryError(null);

    try {
      const generated = await generateStory(targetProjectId, token, csrfToken, true);
      if (activeProjectIdRef.current === targetProjectId) {
        setStory(generated);
        if (generated.status === "pending") {
          startPollingStory(targetProjectId, generated.id);
        } else if (generated.status === "succeeded") {
          setStoryLoading(false);
        } else if (generated.status === "failed") {
          setStoryLoading(false);
          setStoryError(generated.error_message || "Story generation failed. Please try again.");
        }
      }
    } catch (err: unknown) {
      if (activeProjectIdRef.current === targetProjectId) {
        setStoryError(err instanceof Error ? err.message : "Failed to generate story keepsake");
        setStoryLoading(false);
      }
    }
  };

  // Story Edit Update
  const handleSaveStory = async (storyPayload: {
    title: string;
    dedication: string;
    story_body: string;
    closing_message: string;
  }) => {
    if (!token || !csrfToken || !selectedProjectId) {
      if (!currentUser) setAuthModalOpen(true);
      throw new Error("Please sign in to update story.");
    }
    const targetProjectId = selectedProjectId;
    const updated = await updateStory(targetProjectId, token, csrfToken, storyPayload);
    if (activeProjectIdRef.current === targetProjectId) {
      setStory(updated);
    }
  };

  // PDF Download
  const handleDownloadPdf = async () => {
    if (!token || !selectedProjectId) {
      if (!currentUser) setAuthModalOpen(true);
      return;
    }
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
  };

  // Active Recipient and Project references
  const currentRecipient = recipients.find((r) => r.id === selectedRecipientId);
  const currentProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex-1 flex flex-col justify-between ambient-mesh">
      {/* App Header */}
      <AppHeader
        currentUser={currentUser}
        activeExperience={activeExperience}
        onSelectExperience={(exp) => {
          setActiveExperience(exp);
          if (currentStep < 3 && selectedProjectId) {
            setCurrentStep(3);
          }
        }}
        onLogout={handleLogout}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main className="flex-1 flex flex-col pb-16">
        {/* Hero Section */}
        <HeroSection
          onSelectGifts={() => {
            setActiveExperience("gifts");
            if (!currentUser) {
              setAuthModalOpen(true);
            } else {
              setCurrentStep(3);
            }
          }}
          onSelectStory={() => {
            setActiveExperience("story");
            if (!currentUser) {
              setAuthModalOpen(true);
            } else {
              setCurrentStep(3);
            }
          }}
        />

        {/* Subtle Cultural Section Divider */}
        <div className="max-w-4xl mx-auto px-6 w-full">
          <CulturalDivider className="my-4 opacity-70" />
        </div>

        {/* Progressive Step Indicator (when signed in) */}
        {currentUser && (
          <div className="max-w-5xl mx-auto px-4 w-full">
            <StepIndicator
              steps={PROGRESS_STEPS}
              currentStep={currentStep}
              onStepClick={(stepId) => setCurrentStep(stepId)}
            />
          </div>
        )}

        {/* Main Work Area */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          {authLoadingInitial ? (
            <div className="flex items-center justify-center p-16">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !currentUser ? (
            /* Unified Premium Experience Showcase */
            <div className="my-6 sm:my-10 max-w-4xl mx-auto w-full">
              <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-b from-[#111726]/90 via-[#0b0f19]/95 to-[#070a10] p-6 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-xl">
                {/* Decorative cultural background motifs */}
                <div className="pointer-events-none absolute -right-12 -top-12 opacity-[0.06] text-amber-400">
                  <MandalaAccent className="w-64 h-64" />
                </div>
                <div className="pointer-events-none absolute -left-12 -bottom-12 opacity-[0.06] text-violet-400">
                  <MandalaAccent className="w-64 h-64" />
                </div>

                {/* Section Header */}
                <div className="relative z-10 text-center max-w-xl mx-auto mb-8 sm:mb-10 space-y-2.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/25 text-[11px] font-medium text-amber-300">
                    <LotusFlowerPattern className="w-3.5 h-3.5 text-amber-400" />
                    <span>Two Thoughtful Ways to Gift</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                    Choose Your Keepsake Experience
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed">
                    Powered by Gemma 4 AI to craft memorable, emotionally authentic gifts and stories in minutes.
                  </p>
                </div>

                {/* Unified Interactive 2-Card Grid */}
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  {/* Card 1: AI Gift Ideas */}
                  <div
                    id="card-experience-gifts"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveExperience("gifts");
                      setAuthModalOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveExperience("gifts");
                        setAuthModalOpen(true);
                      }
                    }}
                    className={`group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                      activeExperience === "gifts"
                        ? "border-amber-400/50 bg-gradient-to-br from-amber-950/40 via-[#131b2e] to-[#0a0e1a] shadow-xl shadow-amber-950/30 ring-1 ring-amber-400/30"
                        : "border-white/[0.08] bg-[#0c121e]/60 hover:border-amber-400/40 hover:bg-[#101728]/80"
                    }`}
                  >
                    <div className="pointer-events-none absolute right-3 bottom-3 opacity-5 group-hover:opacity-10 text-amber-400 transition-opacity">
                      <HeritageArch className="w-24 h-24" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 group-hover:scale-105 group-hover:bg-amber-500/25 transition-all">
                          <Gift className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-amber-400/15 text-amber-300 border border-amber-400/30">
                          Personalized
                        </span>
                      </div>

                      <h4 className="text-lg font-semibold text-white tracking-tight mb-2 flex items-center gap-2 group-hover:text-amber-200 transition-colors">
                        AI Gift Recommendations
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-300/85 leading-relaxed mb-6">
                        Personalized gift ideas curated around their unique personality, shared moments, occasion, and your exact budget.
                      </p>
                    </div>

                    <div className="relative z-10 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-400 group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                        Start with Gift Ideas
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                      <span className="text-[11px] text-slate-400">3 Curated Picks</span>
                    </div>
                  </div>

                  {/* Card 2: Story Keepsake */}
                  <div
                    id="card-experience-story"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveExperience("story");
                      setAuthModalOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveExperience("story");
                        setAuthModalOpen(true);
                      }
                    }}
                    className={`group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                      activeExperience === "story"
                        ? "border-violet-400/50 bg-gradient-to-br from-violet-950/40 via-[#131b2e] to-[#0a0e1a] shadow-xl shadow-violet-950/30 ring-1 ring-violet-400/30"
                        : "border-white/[0.08] bg-[#0c121e]/60 hover:border-violet-400/40 hover:bg-[#101728]/80"
                    }`}
                  >
                    <div className="pointer-events-none absolute right-3 bottom-3 opacity-5 group-hover:opacity-10 text-violet-400 transition-opacity">
                      <HeritageArch className="w-24 h-24" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-400 group-hover:scale-105 group-hover:bg-violet-500/25 transition-all">
                          <BookHeart className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-violet-400/15 text-violet-300 border border-violet-400/30">
                          Printable PDF
                        </span>
                      </div>

                      <h4 className="text-lg font-semibold text-white tracking-tight mb-2 flex items-center gap-2 group-hover:text-violet-200 transition-colors">
                        Story Keepsake
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-300/85 leading-relaxed mb-6">
                        Turn cherished memories into an emotional narrative story that you can edit, personalize, and download as an archival PDF.
                      </p>
                    </div>

                    <div className="relative z-10 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs font-semibold text-violet-400 group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
                        Create Story Keepsake
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                      <span className="text-[11px] text-slate-400">PDF Download</span>
                    </div>
                  </div>
                </div>

                {/* Seamless Unified Action Bar */}
                <div className="relative z-10 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-white">
                        Free to start &middot; No credit card required
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Join in seconds with email or demo account
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full sm:w-auto px-7 py-3 btn-primary text-xs sm:text-sm font-semibold cursor-pointer shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2"
                  >
                    <span>Get Started Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Progressive Workflow Content */
            <div>
              {/* Step 1: Recipient Profile */}
              {currentStep === 1 && (
                <RecipientStep
                  recipients={recipients}
                  selectedRecipientId={selectedRecipientId}
                  onSelectRecipient={(id) => setSelectedRecipientId(id)}
                  onCreateRecipient={handleCreateRecipient}
                  loading={recLoading}
                  onContinue={() => setCurrentStep(2)}
                />
              )}

              {/* Step 2: Gift Project */}
              {currentStep === 2 && (
                <GiftProjectStep
                  projects={projects}
                  selectedRecipient={currentRecipient}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={handleSelectProject}
                  onCreateProject={handleCreateProject}
                  onBack={() => setCurrentStep(1)}
                  onContinue={() => setCurrentStep(3)}
                />
              )}

              {/* Step 3: Creation Studio (Gift Ideas or Story Keepsake) */}
              {currentStep === 3 && currentRecipient && currentProject && (
                <div className="space-y-6">
                  {/* Experience Selector Tabs in Studio */}
                  <div className="flex justify-center mb-6">
                    <ExperienceSelector
                      activeExperience={activeExperience}
                      onSelectExperience={(exp) => setActiveExperience(exp)}
                    />
                  </div>

                  {activeExperience === "gifts" ? (
                    <GiftRecommendationsWorkspace
                      recipient={currentRecipient}
                      project={currentProject}
                      generation={latestGeneration}
                      generating={generating}
                      error={generationError}
                      onGenerate={handleGenerateRecommendations}
                      onSwitchProject={() => setCurrentStep(2)}
                    />
                  ) : (
                    <div className="space-y-8">
                      <MemoryInterview
                        recipient={currentRecipient}
                        project={currentProject}
                        initialAnswers={memories}
                        hasSufficientMemories={hasSufficientMemories}
                        guidanceMessage={memoryGuidance}
                        onSaveAnswers={handleSaveMemories}
                        onReadyToGenerateStory={handleGenerateStory}
                        storyLoading={storyLoading}
                      />

                      {/* Story Error Banner with Retry */}
                      {storyError && (
                        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{storyError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleGenerateStory}
                            disabled={storyLoading || !hasSufficientMemories}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium border border-rose-500/30 transition-colors shrink-0 disabled:opacity-50"
                          >
                            Retry Generation
                          </button>
                        </div>
                      )}

                      {/* Story Loading / Polling Progress Card */}
                      {storyLoading && (
                        <div className="max-w-4xl mx-auto p-6 saas-card bg-gradient-to-r from-violet-950/20 to-slate-900/40 border-violet-500/30 flex items-center gap-4 animate-pulse">
                          <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" />
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-white">Weaving your biographical keepsake...</h4>
                            <p className="text-xs text-slate-400">
                              Google-hosted Gemma 4 is synthesizing your shared memories into an authentic keepsake narrative.
                            </p>
                          </div>
                        </div>
                      )}

                      {story && story.status === "succeeded" && (
                        <StoryEditor
                          story={story}
                          onSaveStory={handleSaveStory}
                          onDownloadPdf={handleDownloadPdf}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#090c13] py-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 GiftMind Open Source. Turn Memories Into Meaningful Gifts.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Powered by hosted Gemma 4 AI</span>
            <span>•</span>
            <a
              href="https://github.com/itsdevcode/giftmind"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Hacktoberfest 2026
            </a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSubmit={handleAuthSubmit}
        error={authError}
        submitting={authSubmitting}
      />
    </div>
  );
}
