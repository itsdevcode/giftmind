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
import { CulturalDivider, HeritageArch, MandalaAccent } from "@/components/illustrations/CulturalMotifs";
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
  getMemories,
  updateMemories,
  generateStory,
  getLatestStory,
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
  }, []);

  const handleSelectProject = (projectId: string) => {
    if (projectId === selectedProjectId) return;
    setSelectedProjectId(projectId);
    activeProjectIdRef.current = projectId;
    resetProjectSubresources();
  };

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
        }
      })
      .catch(() => {
        if (activeProjectIdRef.current === currentProjectId) {
          setLatestGeneration(null);
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
        }
      })
      .catch(() => {
        if (activeProjectIdRef.current === currentProjectId) {
          setStory(null);
        }
      });
  }, [selectedProjectId, token, resetProjectSubresources]);

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
    const targetProjectId = selectedProjectId;
    setGenerating(true);
    setGenerationError(null);

    try {
      const gen = await generateRecommendations(targetProjectId, token, csrfToken);
      if (activeProjectIdRef.current === targetProjectId) {
        setLatestGeneration(gen);
      }
    } catch (err: unknown) {
      if (activeProjectIdRef.current === targetProjectId) {
        setGenerationError(err instanceof Error ? err.message : "Failed to generate recommendations");
      }
    } finally {
      if (activeProjectIdRef.current === targetProjectId) {
        setGenerating(false);
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
      const generated = await generateStory(targetProjectId, token, csrfToken);
      if (activeProjectIdRef.current === targetProjectId) {
        setStory(generated);
      }
    } catch (err: unknown) {
      if (activeProjectIdRef.current === targetProjectId) {
        setStoryError(err instanceof Error ? err.message : "Failed to generate story keepsake");
      }
    } finally {
      if (activeProjectIdRef.current === targetProjectId) {
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
            /* Unauthenticated Visitor Landing Preview */
            <div className="space-y-10 my-4 sm:my-8">
              <ExperienceSelector
                activeExperience={activeExperience}
                onSelectExperience={(exp) => {
                  setActiveExperience(exp);
                  setAuthModalOpen(true);
                }}
              />

              <div className="relative overflow-hidden p-8 sm:p-12 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-[#121826]/90 via-[#0c101a]/95 to-[#090c13] max-w-2xl mx-auto text-center space-y-5 shadow-2xl shadow-black/60">
                {/* Decorative background mandalas */}
                <div className="pointer-events-none absolute -right-8 -bottom-8 opacity-[0.07] text-amber-400">
                  <MandalaAccent className="w-48 h-48" />
                </div>
                <div className="pointer-events-none absolute -left-8 -top-8 opacity-[0.07] text-violet-400">
                  <MandalaAccent className="w-48 h-48" />
                </div>

                <div className="relative z-10 flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-300/10 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
                    <HeritageArch className="w-5 h-5 text-amber-400" />
                  </div>
                </div>

                <div className="relative z-10 space-y-2">
                  <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    Ready to turn memories into a gift they&apos;ll treasure?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300/90 max-w-md mx-auto leading-relaxed">
                    Create your free account to curate personalized Gemma 4 gift recommendations or generate an authentic keepsake story.
                  </p>
                </div>

                <div className="relative z-10 pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="px-8 py-3 btn-primary text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Get Started Free
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

                      {story && (
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
