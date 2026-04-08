export interface LLMConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
}

export interface LLMAdapter {
  generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse>;
}
