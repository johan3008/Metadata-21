/**
 * Mistral AI Provider Service
 * 
 * Handles metadata generation using Mistral AI models
 * Compatible with existing queue system and SEO optimization pipeline
 */

export const MISTRAL_API_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
export const MISTRAL_MODELS_ENDPOINT = 'https://api.mistral.ai/v1/models';

export const MISTRAL_MODELS = [
  'mistral-medium-3.5',
  'mistral-small-4',
  'devstral-2',
  'codestral',
  'ministral-8b',
  'ministral-3b'
];

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface MistralRequestPayload {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Test Mistral API Key validity
 * Sends a minimal request to /v1/models endpoint
 */
export async function testMistralApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'API Key terlalu pendek atau kosong' };
  }

  try {
    const response = await fetch(MISTRAL_MODELS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`
      }
    });

    if (response.ok) {
      return { valid: true };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.message || errorData?.error?.message || response.statusText;

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'API Key tidak valid atau kedaluwarsa' };
    }

    if (response.status === 429) {
      return { valid: false, error: 'Batas kuota tercapai (429 Rate Limit)' };
    }

    return { valid: false, error: `HTTP ${response.status}: ${errorMsg}` };
  } catch (e: any) {
    return { valid: false, error: `Koneksi gagal: ${e.message || 'Network error' }` };
  }
}

/**
 * Generate metadata using Mistral AI
 * Compatible with existing SEO optimization pipeline
 */
export async function generateMetadataWithMistral(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model: string = 'mistral-small-4'
): Promise<string> {
  console.log('Using Mistral Model:', model);

  const payload: MistralRequestPayload = {
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    temperature: 0.4,
    max_tokens: 1200,
    response_format: { type: 'json_object' }
  };

  try {
    const response = await fetch(MISTRAL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Mistral API Response Status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.message || errorData?.error?.message || response.statusText;

      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key Mistral tidak valid');
      }

      if (response.status === 429) {
        throw new Error(`Batas kuota Mistral tercapai: ${errorMsg}`);
      }

      throw new Error(`Mistral API Error (${response.status}): ${errorMsg}`);
    }

    const data: MistralResponse = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Mistral returned empty response');
    }

    console.log('Mistral API Connected - Generated metadata successfully');
    return content;
  } catch (e: any) {
    console.error('Mistral metadata generation failed:', e);
    throw e;
  }
}

/**
 * Proxy or fallback call handler for Mistral
 * Similar to existing performProxyOrFallbackCall pattern
 */
export async function performMistralCall(
  options: {
    model: string;
    key: string;
    payload: MistralRequestPayload;
  },
  isUsingClientFallback: boolean = false
): Promise<Response> {
  let proxyFailedWith404 = false;
  let response: Response | null = null;

  // Try server proxy first (if not already in fallback mode)
  if (!isUsingClientFallback) {
    try {
      response = await fetch('/api/proxy/mistral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          key: options.key,
          payload: options.payload
        })
      });

      if (response.status === 404 || response.status === 405 || response.status === 502) {
        proxyFailedWith404 = true;
      }
    } catch (err) {
      console.warn('[PROXY] Mistral proxy fetch error:', err);
      proxyFailedWith404 = true;
    }
  } else {
    proxyFailedWith404 = true;
  }

  // Fallback to direct client-side request
  if (proxyFailedWith404 || isUsingClientFallback) {
    const directUrl = MISTRAL_API_ENDPOINT;

    try {
      const directResponse = await fetch(directUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.key}`
        },
        body: JSON.stringify(options.payload)
      });
      return directResponse;
    } catch (directErr: any) {
      console.error('[FALLBACK] Mistral direct call failed:', directErr);
      throw new Error(`Koneksi langsung Mistral gagal: ${directErr.message || 'Network error'}`);
    }
  }

  return response!;
}
