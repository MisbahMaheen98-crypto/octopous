import { AiProvider, AiResponse } from './AiProvider.js';
import { ChatMessage, ProjectInfo } from '../octo.types.js';
import { SecurityGuard } from '../octo.security.js';
import { logger } from '../octo.logger.js';

export type SupportedProviderType = 'gemini' | 'gemma' | 'openai' | 'none';

export class ConfigurableAiProvider implements AiProvider {
  public id: string = 'gemini';
  public name: string = 'Google Gemini (gemini-2.5-flash)';
  private apiKey: string | null = null;
  public model: string = 'gemini-2.5-flash';
  public providerType: 'gemini' | 'openai' | 'none' = 'gemini';

  private geminiKey: string = '';
  private openaiKey: string = '';

  constructor() {
    this.reloadConfig();
  }

  public reloadConfig() {
    this.geminiKey = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
    this.openaiKey = (process.env.OPENAI_API_KEY || '').trim();

    // Default configuration: prefer Gemini if present, otherwise OpenAI
    if (this.geminiKey) {
      this.apiKey = this.geminiKey;
      this.providerType = 'gemini';
      this.model = process.env.AI_MODEL || 'gemini-2.5-flash';
      this.id = 'gemini';
      this.name = `Google Gemini (${this.model})`;
    } else if (this.openaiKey) {
      this.apiKey = this.openaiKey;
      this.providerType = 'openai';
      this.model = process.env.AI_MODEL || 'gpt-4o-mini';
      this.id = 'openai';
      this.name = `OpenAI (${this.model})`;
    } else {
      this.apiKey = null;
      this.providerType = 'none';
      this.model = process.env.AI_MODEL || 'gemini-2.5-flash';
      this.id = 'unconfigured';
      this.name = 'Unconfigured Provider';
    }
  }

  public isConfigured(): boolean {
    this.reloadConfig();
    return Boolean(this.geminiKey || this.openaiKey);
  }

  public isModelConfigured(modelName?: string | null): boolean {
    this.reloadConfig();
    if (!modelName || modelName === 'demo-simulator') return true;
    const clean = modelName.trim().toLowerCase();
    if (clean.startsWith('gpt') || clean.startsWith('o1') || clean.includes('openai')) {
      return Boolean(this.openaiKey && this.openaiKey.length > 0);
    }
    // Both Gemini and Gemma models use the Google Gemini API key
    return Boolean(this.geminiKey && this.geminiKey.length > 0);
  }

  public prepareForModel(modelName?: string | null): { provider: 'gemini' | 'openai'; model: string } {
    this.reloadConfig();
    let cleanModel = (modelName || 'gemini-2.5-flash').trim();
    const lower = cleanModel.toLowerCase();

    // 1. OpenAI Provider Models
    if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.includes('openai')) {
      if (!this.openaiKey) {
        throw new Error(
          `OpenAI API key is not configured. Please add OPENAI_API_KEY to apps/api/.env to use ${cleanModel}.`
        );
      }
      this.providerType = 'openai';
      this.apiKey = this.openaiKey;

      // Model mapping: OpenAI deprecated gpt-4-turbo in favor of gpt-4o / gpt-4o-mini
      if (cleanModel === 'gpt-4-turbo' || cleanModel === 'gpt-4') {
        this.model = 'gpt-4o';
      } else {
        this.model = cleanModel;
      }

      this.id = 'openai';
      this.name = `OpenAI (${this.model})`;
      return { provider: 'openai', model: this.model };
    }

    // 2. Google Gemma Models (Use existing Google/Gemini API configuration)
    if (lower.startsWith('gemma') || lower.includes('gemma')) {
      if (!this.geminiKey) {
        throw new Error(
          `Google API key is not configured. Please ensure GEMINI_API_KEY is configured in apps/api/.env to use Google Gemma (${cleanModel}).`
        );
      }
      this.providerType = 'gemini';
      this.apiKey = this.geminiKey;
      this.model = cleanModel;
      this.id = 'gemma';
      this.name = `Google Gemma (${cleanModel})`;
      return { provider: 'gemini', model: cleanModel };
    }

    // 3. Google Gemini Models
    if (lower.startsWith('gemini') || lower.includes('gemini')) {
      if (!this.geminiKey) {
        throw new Error(
          `Google Gemini API key is not configured. Please ensure GEMINI_API_KEY is configured in apps/api/.env to use ${cleanModel}.`
        );
      }
      this.providerType = 'gemini';
      this.apiKey = this.geminiKey;

      // Map deprecated models (gemini-1.5-flash, gemini-2.0-flash) to currently active 2.5
      if (cleanModel === 'gemini-2.0-flash' || cleanModel === 'gemini-1.5-flash') {
        this.model = 'gemini-2.5-flash';
      } else if (cleanModel === 'gemini-1.5-pro') {
        this.model = 'gemini-2.5-pro';
      } else {
        this.model = cleanModel;
      }

      this.id = 'gemini';
      this.name = `Google Gemini (${this.model})`;
      return { provider: 'gemini', model: this.model };
    }

    // 4. Default fallback: use Gemini if available, else OpenAI
    if (this.geminiKey) {
      this.providerType = 'gemini';
      this.apiKey = this.geminiKey;
      this.model = cleanModel;
      this.id = 'gemini';
      this.name = `Google Gemini (${cleanModel})`;
      return { provider: 'gemini', model: cleanModel };
    }

    if (this.openaiKey) {
      this.providerType = 'openai';
      this.apiKey = this.openaiKey;
      this.model = cleanModel;
      this.id = 'openai';
      this.name = `OpenAI (${cleanModel})`;
      return { provider: 'openai', model: cleanModel };
    }

    throw new Error(
      `No API key configured for model "${cleanModel}". Please configure GEMINI_API_KEY or OPENAI_API_KEY in apps/api/.env.`
    );
  }

  public setOverrideModel(modelName?: string | null) {
    if (!modelName || modelName === 'demo-simulator') return;
    try {
      this.prepareForModel(modelName);
    } catch (err: any) {
      logger.warn('ConfigurableAiProvider', `Cannot set override model: ${err.message}`);
    }
  }

  public getConfigStatus() {
    this.reloadConfig();
    const hasGemini = Boolean(this.geminiKey && this.geminiKey.length > 0);
    const hasOpenai = Boolean(this.openaiKey && this.openaiKey.length > 0);

    return {
      configured: hasGemini || hasOpenai,
      provider: this.providerType,
      model: this.model,
      hasKey: hasGemini || hasOpenai,
      geminiConfigured: hasGemini,
      gemmaConfigured: hasGemini, // Uses Google Gemini key
      openaiConfigured: hasOpenai,
      name: this.name,
    };
  }

  public async generateResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    fileReferences: string[] = [],
    project?: ProjectInfo
  ): Promise<AiResponse> {
    if (!this.apiKey) {
      throw new Error(
        'AI Provider is not configured. Please supply GEMINI_API_KEY or OPENAI_API_KEY in apps/api/.env or switch to Demo Simulator.'
      );
    }

    const sanitizedSystemPrompt = SecurityGuard.redactSecrets(systemPrompt);
    const sanitizedMessages = messages.map((m) => ({
      ...m,
      content: SecurityGuard.redactSecrets(m.content),
    }));

    if (this.providerType === 'gemini') {
      return this.callGemini(sanitizedMessages, sanitizedSystemPrompt, fileReferences);
    } else {
      return this.callOpenAiCompatible(
        'https://api.openai.com/v1/chat/completions',
        sanitizedMessages,
        sanitizedSystemPrompt,
        fileReferences,
        'OpenAI'
      );
    }
  }

  public async streamResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    onChunk: (chunk: string) => void,
    fileReferences: string[] = [],
    _project?: ProjectInfo
  ): Promise<AiResponse> {
    if (!this.apiKey) {
      throw new Error(
        'AI Provider is not configured. Please supply GEMINI_API_KEY or OPENAI_API_KEY in apps/api/.env or switch to Demo Simulator.'
      );
    }

    const sanitizedSystemPrompt = SecurityGuard.redactSecrets(systemPrompt);
    const sanitizedMessages = messages.map((m) => ({
      ...m,
      content: SecurityGuard.redactSecrets(m.content),
    }));

    if (this.providerType === 'gemini') {
      try {
        return await this.streamGemini(sanitizedMessages, sanitizedSystemPrompt, fileReferences, onChunk);
      } catch (streamErr: any) {
        logger.warn('ConfigurableAiProvider', `Native stream failed: ${streamErr.message}. Falling back to chunked generation.`);
        const result = await this.callGemini(sanitizedMessages, sanitizedSystemPrompt, fileReferences);
        if (result.text && onChunk) {
          onChunk(result.text);
        }
        return result;
      }
    } else {
      const result = await this.callOpenAiCompatible(
        'https://api.openai.com/v1/chat/completions',
        sanitizedMessages,
        sanitizedSystemPrompt,
        fileReferences,
        'OpenAI'
      );
      if (result.text && onChunk) {
        const words = result.text.split(/(\s+|\n+)/);
        let batch = '';
        for (const w of words) {
          batch += w;
          if (batch.length >= 24 || w.includes('\n')) {
            onChunk(batch);
            batch = '';
            await new Promise((r) => setTimeout(r, 10));
          }
        }
        if (batch.length > 0) {
          onChunk(batch);
        }
      }
      return result;
    }
  }

  private async streamGemini(
    messages: ChatMessage[],
    systemPrompt: string,
    fileReferences: string[],
    onChunk: (chunk: string) => void
  ): Promise<AiResponse> {
    const isGemma = this.model.toLowerCase().includes('gemma');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    }> = [];

    for (const m of messages) {
      const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
      const text = m.content || '';
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      if (text) {
        parts.push({ text });
      }

      if (m.images && m.images.length > 0) {
        for (const img of m.images) {
          const match = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          const mimeType = match && match[1] ? match[1] : 'image/png';
          const base64Data = match && match[2] ? match[2] : img;
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      }

      if (parts.length === 0) {
        parts.push({ text: '...' });
      }

      if (contents.length === 0) {
        if (role !== 'user') {
          contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
        }
        contents.push({ role, parts });
      } else {
        const lastItem = contents[contents.length - 1];
        if (lastItem && lastItem.role === role) {
          lastItem.parts.push(...parts);
        } else {
          contents.push({ role, parts });
        }
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const payload: any = {
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };

    if (!isGemma && systemPrompt) {
      payload.system_instruction = {
        parts: [{ text: systemPrompt }],
      };
    } else if (isGemma && systemPrompt && contents.length > 0) {
      const firstUser = contents.find((c) => c.role === 'user');
      const firstPart = firstUser?.parts[0];
      if (firstPart) {
        firstPart.text = `[SYSTEM INSTRUCTIONS: ${systemPrompt}]\n\n${firstPart.text || ''}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API Streaming Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Google API response body is not readable');
    }

    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunkText) {
            accumulatedText += chunkText;
            onChunk(chunkText);
          }
        } catch {}
      }
    }

    const providerLabel = isGemma ? 'Google Gemma' : 'Google Gemini';

    return {
      text: SecurityGuard.redactSecrets(accumulatedText || 'Response completed.'),
      fileReferences,
      isSimulated: false,
      provider: providerLabel,
      model: this.model,
    };
  }

  private async callGemini(
    messages: ChatMessage[],
    systemPrompt: string,
    fileReferences: string[]
  ): Promise<AiResponse> {
    const isGemma = this.model.toLowerCase().includes('gemma');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    }> = [];

    for (const m of messages) {
      const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
      const text = m.content || '';
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      if (text) {
        parts.push({ text });
      }

      if (m.images && m.images.length > 0) {
        for (const img of m.images) {
          const match = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          const mimeType = match && match[1] ? match[1] : 'image/png';
          const data = match && match[2] ? match[2] : img;
          parts.push({
            inlineData: {
              mimeType,
              data,
            },
          });
        }
      }

      if (parts.length === 0) {
        parts.push({ text: '...' });
      }

      if (contents.length === 0) {
        if (role !== 'user') {
          contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
        }
        contents.push({ role, parts });
      } else {
        const lastItem = contents[contents.length - 1];
        if (lastItem && lastItem.role === role) {
          lastItem.parts.push(...parts);
        } else {
          contents.push({ role, parts });
        }
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    // Google Generative AI API:
    // Gemini supports top-level system_instruction.
    // Gemma models on Google API do not accept system_instruction; prepend instructions to the first user message.
    const payload: any = {
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };

    if (!isGemma && systemPrompt) {
      payload.system_instruction = {
        parts: [{ text: systemPrompt }],
      };
    } else if (isGemma && systemPrompt && contents.length > 0) {
      const firstUser = contents.find((c) => c.role === 'user');
      const firstPart = firstUser?.parts[0];
      if (firstPart) {
        firstPart.text = `[SYSTEM INSTRUCTIONS: ${systemPrompt}]\n\n${firstPart.text || ''}`;
      }
    }

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          let parsedErr: any = null;
          try {
            parsedErr = JSON.parse(errText);
          } catch {}
          const errMsg = parsedErr?.error?.message || errText;

          logger.error('ConfigurableAiProvider', `Google API error (attempt ${attempt}): ${response.status} ${errMsg}`);

          if ([500, 502, 503, 504].includes(response.status) && attempt < maxAttempts) {
            const delay = 1000 * 2 ** (attempt - 1);
            logger.info('ConfigurableAiProvider', `Retrying Google request in ${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (response.status === 401 || response.status === 403) {
            throw new Error(`Google API Authentication Error (${response.status}): Invalid or unauthorized GEMINI_API_KEY. Please verify your key.`);
          }

          if (response.status === 404) {
            throw new Error(`Google Model Unavailable (404): Model "${this.model}" was not found on Google's API endpoint.`);
          }

          if (response.status === 429) {
            throw new Error('Google Gemini / Gemma rate limit or quota exceeded. Please check your Google Cloud quota and billing settings.');
          }

          throw new Error(`Google API Error (${response.status}): ${errMsg}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        const text =
          candidate?.content?.parts
            ?.map((part: { text?: string }) => part.text || '')
            .join('') || 'No response generated.';

        const providerLabel = isGemma ? 'Google Gemma' : 'Google Gemini';

        return {
          text: SecurityGuard.redactSecrets(text),
          fileReferences,
          isSimulated: false,
          provider: providerLabel,
          model: this.model,
          usage: {
            promptTokens: data.usageMetadata?.promptTokenCount,
            completionTokens: data.usageMetadata?.candidatesTokenCount,
          },
        };
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
            continue;
          }
          throw new Error(`Google ${isGemma ? 'Gemma' : 'Gemini'} request timed out after 3 attempts.`);
        }

        throw err;
      }
    }

    throw new Error('Google API request failed after multiple attempts.');
  }

  private async callOpenAiCompatible(
    url: string,
    messages: ChatMessage[],
    systemPrompt: string,
    fileReferences: string[],
    providerLabel: string
  ): Promise<AiResponse> {
    const isO1 = this.model.startsWith('o1');
    const systemRole = isO1 ? 'developer' : 'system';

    const payloadMessages = [
      { role: systemRole, content: systemPrompt },
      ...messages.map((m) => {
        if (m.images && m.images.length > 0 && !isO1) {
          const contentParts: any[] = [{ type: 'text', text: m.content || '' }];
          for (const img of m.images) {
            const imgUrl = img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
            contentParts.push({ type: 'image_url', image_url: { url: imgUrl } });
          }
          return { role: m.role, content: contentParts };
        }
        return {
          role: m.role,
          content: m.content || '',
        };
      }),
    ];

    const bodyPayload: any = {
      model: this.model,
      messages: payloadMessages,
    };

    if (!isO1) {
      bodyPayload.temperature = 0.2;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        let parsedErr: any = null;
        try {
          parsedErr = JSON.parse(errText);
        } catch {}
        const errMsg = parsedErr?.error?.message || errText;

        logger.error('ConfigurableAiProvider', `${providerLabel} API error: ${response.status} ${errMsg}`);

        if (response.status === 401) {
          throw new Error(
            `OpenAI Authentication Error (401): Invalid or unauthorized OPENAI_API_KEY. Please verify your key in apps/api/.env.`
          );
        } else if (response.status === 404) {
          throw new Error(
            `OpenAI Model Unavailable (404): Model "${this.model}" was not found or is unavailable for your account.`
          );
        } else if (response.status === 429) {
          throw new Error(
            `OpenAI Quota Exceeded (429): ${errMsg || 'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.'}`
          );
        }
        throw new Error(`${providerLabel} API error (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const text = choice?.message?.content || 'No response generated.';

      return {
        text: SecurityGuard.redactSecrets(text),
        fileReferences,
        isSimulated: false,
        provider: providerLabel,
        model: this.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`${providerLabel} request timed out after 30 seconds.`);
      }
      throw err;
    }
  }
}
