/**
 * Centralized API client and data models for GiftMind Frontend.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== "undefined"
    ? ""
    : "http://127.0.0.1:8000";

export interface HealthCheckResponse {
  status: string;
  service: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: User;
  csrf_token: string;
}

export interface Recipient {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  interests: string[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface GiftProject {
  id: string;
  recipient_id: string;
  title: string;
  occasion: string;
  occasion_date?: string | null;
  budget_min: string | number;
  budget_max: string | number;
  currency: string;
  status: "draft" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
}

export interface GiftRecommendation {
  id: string;
  gift_project_id: string;
  generation_id: string;
  title: string;
  description: string;
  category: string;
  estimated_budget: string;
  currency: string;
  personalization_reason: string;
  presentation_idea: string;
  created_at: string;
}

export type GenerationStatus = "pending" | "succeeded" | "failed";

export interface RecommendationGeneration {
  id: string;
  gift_project_id: string;
  user_id: string;
  provider: string;
  model: string;
  prompt_version: string;
  status: GenerationStatus;
  error_message?: string | null;
  recommendations: GiftRecommendation[];
  created_at: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Active session state and subscriber registry for synchronized token management
let activeToken: string | null = null;
let activeCsrfToken: string | null = null;
let activeUser: User | null = null;
let refreshPromise: Promise<AuthTokens | null> | null = null;

type AuthListener = (session: {
  token: string | null;
  csrfToken: string | null;
  user: User | null;
}) => void;
const authListeners = new Set<AuthListener>();

export function setAuthSession(tokens: {
  access_token: string;
  csrf_token: string;
  user: User;
} | null) {
  activeToken = tokens ? tokens.access_token : null;
  activeCsrfToken = tokens ? tokens.csrf_token : null;
  activeUser = tokens ? tokens.user : null;
  authListeners.forEach((listener) =>
    listener({ token: activeToken, csrfToken: activeCsrfToken, user: activeUser })
  );
}

export function subscribeAuth(listener: AuthListener): () => void {
  authListeners.add(listener);
  listener({ token: activeToken, csrfToken: activeCsrfToken, user: activeUser });
  return () => authListeners.delete(listener);
}

export function getActiveAuthSession() {
  return { token: activeToken, csrfToken: activeCsrfToken, user: activeUser };
}

/**
 * Perform a typed API request to the backend with automatic 401 token refresh mutex.
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { token?: string | null; csrfToken?: string | null }
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const resolvedToken = options?.token !== undefined ? options.token : activeToken;
  const resolvedCsrf = options?.csrfToken !== undefined ? options.csrfToken : activeCsrfToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (resolvedToken) {
    headers["Authorization"] = `Bearer ${resolvedToken}`;
  }

  if (resolvedCsrf) {
    headers["X-CSRF-Token"] = resolvedCsrf;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // If 401 Unauthorized occurs on an authenticated route (not an auth endpoint itself),
  // refresh tokens using a single shared mutex promise and retry the request.
  if (response.status === 401 && !endpoint.includes("/api/v1/auth/")) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const newTokens = await refreshAuth(activeCsrfToken);
          setAuthSession(newTokens);
          return newTokens;
        } catch {
          setAuthSession(null);
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      // Retry original request with newly rotated credentials
      return fetchApi<T>(endpoint, {
        ...options,
        token: refreshed.access_token,
        csrfToken: refreshed.csrf_token,
      });
    }
  }

  if (!response.ok) {
    let errorDetail = `API request failed with status ${response.status}`;
    let errorData: unknown;
    try {
      errorData = await response.json();
      if (typeof errorData === "object" && errorData !== null && "detail" in errorData) {
        errorDetail = String((errorData as { detail: unknown }).detail);
      }
    } catch {
      // Body may not be valid JSON
    }
    throw new ApiError(response.status, errorDetail, errorData);
  }

  return response.json() as Promise<T>;
}

export async function checkBackendHealth(): Promise<HealthCheckResponse> {
  return fetchApi<HealthCheckResponse>("/health");
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthTokens> {
  const result = await fetchApi<AuthTokens>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAuthSession(result);
  return result;
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthTokens> {
  const result = await fetchApi<AuthTokens>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAuthSession(result);
  return result;
}

export async function refreshAuth(csrfToken?: string | null): Promise<AuthTokens> {
  return fetchApi<AuthTokens>("/api/v1/auth/refresh", {
    method: "POST",
    csrfToken,
  });
}

export async function logoutUser(csrfToken?: string | null): Promise<{ status: string }> {
  try {
    return await fetchApi<{ status: string }>("/api/v1/auth/logout", {
      method: "POST",
      csrfToken,
    });
  } finally {
    setAuthSession(null);
  }
}

export async function getRecipients(
  token: string,
  limit: number = 50,
  offset: number = 0
): Promise<PaginatedResponse<Recipient>> {
  return fetchApi<PaginatedResponse<Recipient>>(
    `/api/v1/recipients?limit=${limit}&offset=${offset}`,
    {
      method: "GET",
      token,
    }
  );
}

export async function createRecipient(
  token: string,
  csrfToken: string,
  payload: {
    name: string;
    relationship: string;
    interests?: string[];
    notes?: string;
  }
): Promise<Recipient> {
  return fetchApi<Recipient>("/api/v1/recipients", {
    method: "POST",
    token,
    csrfToken,
    body: JSON.stringify(payload),
  });
}

export async function getGiftProjects(
  token: string,
  limit: number = 50,
  offset: number = 0
): Promise<PaginatedResponse<GiftProject>> {
  return fetchApi<PaginatedResponse<GiftProject>>(
    `/api/v1/gift-projects?limit=${limit}&offset=${offset}`,
    {
      method: "GET",
      token,
    }
  );
}

export async function createGiftProject(
  token: string,
  csrfToken: string,
  payload: {
    recipient_id: string;
    title: string;
    occasion: string;
    occasion_date?: string | null;
    budget_min?: number | null;
    budget_max: number;
    currency?: string;
  }
): Promise<GiftProject> {
  return fetchApi<GiftProject>("/api/v1/gift-projects", {
    method: "POST",
    token,
    csrfToken,
    body: JSON.stringify(payload),
  });
}

export async function generateRecommendations(
  projectId: string,
  token: string,
  csrfToken: string,
  background: boolean = true
): Promise<RecommendationGeneration> {
  const url = `/api/v1/gift-projects/${projectId}/recommendations/generate?background=${background}`;
  return fetchApi<RecommendationGeneration>(url, {
    method: "POST",
    token,
    csrfToken,
  });
}

export async function getLatestRecommendations(
  projectId: string,
  token: string
): Promise<RecommendationGeneration> {
  return fetchApi<RecommendationGeneration>(
    `/api/v1/gift-projects/${projectId}/recommendations`,
    {
      method: "GET",
      token,
    }
  );
}

export async function getRecommendationGenerationStatus(
  projectId: string,
  generationId: string,
  token: string
): Promise<RecommendationGeneration> {
  return fetchApi<RecommendationGeneration>(
    `/api/v1/gift-projects/${projectId}/recommendations/${generationId}`,
    {
      method: "GET",
      token,
    }
  );
}

// --- Memory Interview Interfaces & API ---

export interface MemoryAnswer {
  id: string;
  gift_project_id: string;
  question_key: string;
  question_prompt: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryAnswersListResponse {
  gift_project_id: string;
  answers: MemoryAnswer[];
  has_sufficient_input: boolean;
  guidance_message: string;
}

export async function getMemories(
  projectId: string,
  token: string
): Promise<MemoryAnswersListResponse> {
  return fetchApi<MemoryAnswersListResponse>(
    `/api/v1/gift-projects/${projectId}/memories`,
    {
      method: "GET",
      token,
    }
  );
}

export async function updateMemories(
  projectId: string,
  token: string,
  csrfToken: string,
  answers: { question_key: string; answer: string }[]
): Promise<MemoryAnswersListResponse> {
  return fetchApi<MemoryAnswersListResponse>(
    `/api/v1/gift-projects/${projectId}/memories`,
    {
      method: "PUT",
      token,
      csrfToken,
      body: JSON.stringify({ answers }),
    }
  );
}

// --- Story Keepsake Interfaces & API ---

export interface StoryKeepsake {
  id: string;
  gift_project_id: string;
  user_id: string;
  title: string;
  dedication: string;
  story_body: string;
  closing_message: string;
  model_name: string;
  prompt_version: string;
  status: "pending" | "succeeded" | "failed";
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export async function generateStory(
  projectId: string,
  token: string,
  csrfToken: string
): Promise<StoryKeepsake> {
  return fetchApi<StoryKeepsake>(
    `/api/v1/gift-projects/${projectId}/story/generate`,
    {
      method: "POST",
      token,
      csrfToken,
    }
  );
}

export async function getLatestStory(
  projectId: string,
  token: string
): Promise<StoryKeepsake> {
  return fetchApi<StoryKeepsake>(
    `/api/v1/gift-projects/${projectId}/story`,
    {
      method: "GET",
      token,
    }
  );
}

export async function updateStory(
  projectId: string,
  token: string,
  csrfToken: string,
  payload: {
    title: string;
    dedication: string;
    story_body: string;
    closing_message: string;
  }
): Promise<StoryKeepsake> {
  return fetchApi<StoryKeepsake>(
    `/api/v1/gift-projects/${projectId}/story`,
    {
      method: "PATCH",
      token,
      csrfToken,
      body: JSON.stringify(payload),
    }
  );
}

export async function downloadStoryPdf(
  projectId: string,
  token: string
): Promise<Blob> {
  const url = `${API_BASE_URL}/api/v1/gift-projects/${projectId}/story/pdf`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || `Failed to download PDF (${res.status})`);
  }

  return res.blob();
}

