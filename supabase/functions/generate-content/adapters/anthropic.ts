import type { LLMAdapter, LLMConfig, LLMResponse } from './types.ts';

export class AnthropicAdapter implements LLMAdapter {
  async generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error: ${err}`);
    }

    const data = await response.json();
    const textBlock = data.content.find((b: { type: string }) => b.type === 'text');
    return { content: textBlock?.text ?? '' };
  }
}
