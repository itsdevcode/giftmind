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
import { SAMPLE_DEMO_DATA } from "@/lib/sampleDemoData";
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
  const [isDemoMode, setIsDemoMode] = useState(false);

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
    if (isDemoMode) return;
    if (!token) {
      setRecipients([]);
      setProjects([]);
      setSelectedRecipientId("");
      setSelectedProjectId("");
      setLatestGeneration(null);
      return;
    }
    loadWorkspaceData(token);
  }, [token, loadWorkspaceData, isDemoMode]);

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
    if (isDemoMode) return;
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
  }, [selectedProjectId, token, resetProjectSubresources, isDemoMode]);

  // Auth Submit Handler
  const handleAuthSubmit = async (
    mode: "login" | "register",
    payload: { name?: string; email: string; password: string }
  ) => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      setIsDemoMode(false);
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
    setIsDemoMode(false);
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
    if (isDemoMode) {
      alert("Sample Demo Mode: PDF download demonstrates full pipeline when authenticated with active projects.");
      return;
    }
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

  // Demo Explorer
  const handleExploreDemo = () => {
    setIsDemoMode(true);
    setRecipients([SAMPLE_DEMO_DATA.recipient]);
    setSelectedRecipientId(SAMPLE_DEMO_DATA.recipient.id);
    setProjects([SAMPLE_DEMO_DATA.project]);
    setSelectedProjectId(SAMPLE_DEMO_DATA.project.id);
    setLatestGeneration(SAMPLE_DEMO_DATA.generation);
    setMemories(SAMPLE_DEMO_DATA.memories);
    setHasSufficientMemories(true);
    setMemoryGuidance("Sample demo project loaded. Explore gift ideas and editable keepsake story.");
    setStory(SAMPLE_DEMO_DATA.story);
    setCurrentStep(3);
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
          if (currentStep < 3 && (selectedProjectId || isDemoMode)) {
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
            if (!currentUser && !isDemoMode) {
              setAuthModalOpen(true);
            } else {
              setCurrentStep(3);
            }
          }}
          onSelectStory={() => {
            setActiveExperience("story");
            if (!currentUser && !isDemoMode) {
              setAuthModalOpen(true);
            } else {
              setCurrentStep(3);
            }
          }}
          onExploreDemo={handleExploreDemo}
        />

        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="max-w-4xl mx-auto w-full px-4 mb-4">
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
              <span className="font-medium">
                ✨ Interactive Sample Demo Active (Maya Lin • 30th Birthday).
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsDemoMode(false);
                  resetProjectSubresources();
                  setCurrentStep(1);
                }}
                className="text-amber-300 underline font-semibold text-left sm:text-right"
              >
                Exit Demo
              </button>
            </div>
          </div>
        )}

        {/* Progressive Step Indicator (when signed in or in demo mode) */}
        {(currentUser || isDemoMode) && (
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
          ) : !currentUser && !isDemoMode ? (
            /* Unauthenticated Visitor Landing Preview */
            <div className="space-y-8 my-6">
              <ExperienceSelector
                activeExperience={activeExperience}
                onSelectExperience={(exp) => {
                  setActiveExperience(exp);
                  setAuthModalOpen(true);
                }}
              />

              <div className="p-8 sm:p-12 saas-card max-w-2xl mx-auto text-center space-y-4 border-amber-500/20">
                <h3 className="text-xl font-semibold text-white tracking-tight">
                  Ready to turn memories into a gift they&apos;ll treasure?
                </h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  Sign in or create a free account to craft personalized gift recommendations and generate heartwarming narrative keepsakes.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="px-6 py-2.5 btn-primary text-xs font-semibold"
                  >
                    Get Started Free
                  </button>
                  <button
                    type="button"
                    onClick={handleExploreDemo}
                    className="px-6 py-2.5 btn-secondary text-xs font-medium"
                  >
                    Explore Sample Demo
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
