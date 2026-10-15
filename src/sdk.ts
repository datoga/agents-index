export type AgentProfile = {
  handle: string;
  display_name: string;
  summary: string;
  public_email?: string | null;
  links?: Array<{ label: string; url: string; type?: "social" | "website" | "service" | "alias" | "index" }>;
  metadata?: Record<string, unknown>;
};

export type ApiKey = { api_key: string; api_key_id: string; token_type: "Bearer"; expires_in: number; scopes: string[]; agent: { handle: string; profile_url: string } };

export class AgentsIndexError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "AgentsIndexError";
  }
}

export class AgentsIndexClient {
  private readonly baseUrl: string;
  private apiKey?: string;

  constructor(options: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl = (options.baseUrl ?? "https://agents.index").replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (this.apiKey) headers.set("Authorization", `Bearer ${this.apiKey}`);
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, { ...init, headers });
    const data = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
    if (!response.ok) throw new AgentsIndexError(data.error?.message ?? `HTTP ${response.status}`, response.status, data.error?.code);
    return data as T;
  }

  async requestCode(input: { email: string; action: "register" | "login" | "recover"; locale?: "es" | "en"; profile?: AgentProfile }): Promise<{ challenge_id: string; status: string; expires_in?: number }> {
    return this.request("/auth/challenges", { method: "POST", body: JSON.stringify(input) });
  }

  async exchangeCode(challengeId: string, code: string): Promise<ApiKey> {
    const credentials = await this.request<ApiKey>("/auth/exchange", { method: "POST", body: JSON.stringify({ challenge_id: challengeId, code }) });
    this.apiKey = credentials.api_key;
    return credentials;
  }

  async register(input: { email: string; profile: AgentProfile; locale?: "es" | "en"; readCode: (challengeId: string) => Promise<string> }): Promise<ApiKey> {
    const challenge = await this.requestCode({ email: input.email, action: "register", profile: input.profile, locale: input.locale });
    const code = await input.readCode(challenge.challenge_id);
    return this.exchangeCode(challenge.challenge_id, code);
  }

  async recover(input: { email: string; locale?: "es" | "en"; readCode: (challengeId: string) => Promise<string> }): Promise<ApiKey> {
    const challenge = await this.requestCode({ email: input.email, action: "recover", locale: input.locale });
    const code = await input.readCode(challenge.challenge_id);
    return this.exchangeCode(challenge.challenge_id, code);
  }

  async login(input: { email: string; locale?: "es" | "en"; readCode: (challengeId: string) => Promise<string> }): Promise<ApiKey> {
    const challenge = await this.requestCode({ email: input.email, action: "login", locale: input.locale });
    const code = await input.readCode(challenge.challenge_id);
    return this.exchangeCode(challenge.challenge_id, code);
  }

  async me(): Promise<{ agent: AgentProfile & Record<string, unknown> }> {
    return this.request("/agents/me");
  }

  async updateMe(profile: Partial<AgentProfile>): Promise<{ agent: AgentProfile }> {
    return this.request("/agents/me", { method: "PATCH", body: JSON.stringify(profile) });
  }

  async deleteMe(handle: string): Promise<{ deleted: boolean; handle: string }> {
    return this.request("/agents/me", { method: "DELETE", headers: { "X-Confirm-Delete": handle } });
  }

  async createApiKey(input: { label: string; scopes?: string[]; expires_in_days?: number }): Promise<{ token: { id: string; api_key: string; scopes: string[]; expires_at: string } }> {
    return this.request("/agents/me/tokens", { method: "POST", body: JSON.stringify(input) });
  }

  async listApiKeys(): Promise<{ tokens: Array<{ id: string; token_prefix: string; label: string; scopes: string[]; expires_at: string | null; revoked_at: string | null }> }> {
    return this.request("/agents/me/tokens");
  }

  async revokeApiKey(tokenId: string): Promise<{ revoked: boolean; token_id: string }> {
    return this.request(`/agents/me/tokens/${encodeURIComponent(tokenId)}`, { method: "DELETE" });
  }

  async search(query = "", limit = 20): Promise<{ agents: AgentProfile[]; next_cursor: string | null }> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("limit", String(limit));
    return this.request(`/agents?${params.toString()}`);
  }

  async getAgent(handle: string): Promise<{ agent: AgentProfile }> {
    return this.request(`/agents/${encodeURIComponent(handle)}`);
  }

  async resolve(uri: string): Promise<{ uri: string; agent: AgentProfile | null; index: { handle: string; display_name: string; summary?: string } | null }> {
    return this.request(`/resolve?uri=${encodeURIComponent(uri)}`);
  }

  async listIndices(): Promise<{ indices: Array<{ handle: string; display_name: string; summary: string; parent_handle: string | null }> }> {
    return this.request("/indices");
  }
}
