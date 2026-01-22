import { requestUrl } from 'obsidian';
import type { LLMProviderType } from '../types';

export interface ModelInfo {
	id: string;
	name: string;      // Display name
	description?: string;
}

export interface ModelFetchResult {
	success: boolean;
	models: ModelInfo[];
	error?: string;
}

/**
 * Fetch available models from LLM provider APIs.
 */
export class ModelFetcher {

	/**
	 * Fetch models for a specific provider.
	 */
	async fetchModels(
		provider: LLMProviderType,
		apiKey: string,
		customEndpoint?: string
	): Promise<ModelFetchResult> {
		try {
			switch (provider) {
				case 'openai':
					return await this.fetchOpenAIModels(apiKey);
				case 'anthropic':
					return await this.fetchAnthropicModels(apiKey);
				case 'gemini':
					return await this.fetchGeminiModels(apiKey);
				case 'openai-compatible':
					return await this.fetchOpenAICompatibleModels(customEndpoint || '', apiKey);
				default:
					return { success: false, models: [], error: 'Unknown provider' };
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, models: [], error: message };
		}
	}

	/**
	 * Fetch models from OpenAI API.
	 */
	private async fetchOpenAIModels(apiKey: string): Promise<ModelFetchResult> {
		if (!apiKey) {
			return { success: false, models: [], error: 'API key required' };
		}

		const response = await requestUrl({
			url: 'https://api.openai.com/v1/models',
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
			},
			throw: false,
		});

		if (response.status !== 200) {
			return { success: false, models: [], error: `API error: ${response.status}` };
		}

		const data = response.json;
		const models: ModelInfo[] = data.data
			// Filter for chat models (gpt-*)
			.filter((m: { id: string }) =>
				m.id.startsWith('gpt-') &&
				!m.id.includes('instruct') &&
				!m.id.includes('vision') &&
				!m.id.includes('realtime') &&
				!m.id.includes('audio')
			)
			// Sort by name, newest first
			.sort((a: { id: string }, b: { id: string }) => b.id.localeCompare(a.id))
			.map((m: { id: string }) => ({
				id: m.id,
				name: this.formatOpenAIModelName(m.id),
			}));

		return { success: true, models };
	}

	/**
	 * Fetch models from Anthropic API.
	 * Note: Anthropic doesn't have a public models endpoint, so we use a curated list
	 * but verify the API key works.
	 */
	private async fetchAnthropicModels(apiKey: string): Promise<ModelFetchResult> {
		if (!apiKey) {
			return { success: false, models: [], error: 'API key required' };
		}

		// Anthropic doesn't have a models list endpoint, but we can verify the key
		// by making a minimal request. For now, return curated list.
		// The models list is updated periodically based on Anthropic's releases.
		const curatedModels: ModelInfo[] = [
			{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Latest)' },
			{ id: 'claude-opus-4-20250514', name: 'Claude Opus 4 (Most Capable)' },
			{ id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
			{ id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
			{ id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
			{ id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
			{ id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
			{ id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
		];

		// Optionally verify API key with a minimal request
		try {
			const response = await requestUrl({
				url: 'https://api.anthropic.com/v1/messages',
				method: 'POST',
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: 'claude-3-haiku-20240307',
					max_tokens: 1,
					messages: [{ role: 'user', content: 'hi' }],
				}),
				throw: false,
			});

			// 401 = invalid key, but other errors mean key is valid
			if (response.status === 401) {
				return { success: false, models: [], error: 'Invalid API key' };
			}
		} catch {
			// Network error, but return models anyway
		}

		return { success: true, models: curatedModels };
	}

	/**
	 * Fetch models from Google Gemini API.
	 */
	private async fetchGeminiModels(apiKey: string): Promise<ModelFetchResult> {
		if (!apiKey) {
			return { success: false, models: [], error: 'API key required' };
		}

		const response = await requestUrl({
			url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
			method: 'GET',
			throw: false,
		});

		if (response.status !== 200) {
			return { success: false, models: [], error: `API error: ${response.status}` };
		}

		const data = response.json;
		const models: ModelInfo[] = data.models
			// Filter for generateContent capable models
			.filter((m: { supportedGenerationMethods?: string[], name: string }) =>
				m.supportedGenerationMethods?.includes('generateContent') &&
				m.name.includes('gemini')
			)
			.map((m: { name: string, displayName?: string, description?: string }) => ({
				id: m.name.replace('models/', ''),
				name: m.displayName || m.name.replace('models/', ''),
				description: m.description,
			}))
			// Sort to put newer/flash models first
			.sort((a: ModelInfo, b: ModelInfo) => {
				// Prioritize 2.0 > 1.5 > 1.0
				const aVersion = a.id.includes('2.0') ? 3 : a.id.includes('1.5') ? 2 : 1;
				const bVersion = b.id.includes('2.0') ? 3 : b.id.includes('1.5') ? 2 : 1;
				if (aVersion !== bVersion) return bVersion - aVersion;
				// Then flash > pro
				const aFlash = a.id.includes('flash') ? 1 : 0;
				const bFlash = b.id.includes('flash') ? 1 : 0;
				return bFlash - aFlash;
			});

		return { success: true, models };
	}

	/**
	 * Fetch models from OpenAI-compatible endpoint (Ollama, LM Studio, etc).
	 */
	private async fetchOpenAICompatibleModels(endpoint: string, apiKey?: string): Promise<ModelFetchResult> {
		if (!endpoint) {
			return { success: false, models: [], error: 'Endpoint URL required' };
		}

		// Normalize endpoint
		let baseUrl = endpoint.trim();
		if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
		if (!baseUrl.includes('/v1')) baseUrl += '/v1';

		const headers: Record<string, string> = {};
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		const response = await requestUrl({
			url: `${baseUrl}/models`,
			method: 'GET',
			headers,
			throw: false,
		});

		if (response.status !== 200) {
			return { success: false, models: [], error: `Endpoint error: ${response.status}` };
		}

		const data = response.json;

		// Handle both OpenAI format and Ollama format
		let modelList: { id?: string; name?: string; model?: string }[] = [];

		if (Array.isArray(data)) {
			// Ollama format: array of objects with 'name' or 'model'
			modelList = data;
		} else if (data.data && Array.isArray(data.data)) {
			// OpenAI format: { data: [...] }
			modelList = data.data;
		} else if (data.models && Array.isArray(data.models)) {
			// Some endpoints use { models: [...] }
			modelList = data.models;
		}

		const models: ModelInfo[] = modelList
			.map(m => ({
				id: m.id || m.name || m.model || '',
				name: m.id || m.name || m.model || '',
			}))
			.filter(m => m.id);

		return { success: true, models };
	}

	/**
	 * Format OpenAI model ID to friendly name.
	 */
	private formatOpenAIModelName(id: string): string {
		// gpt-4o-mini -> GPT-4o Mini
		// gpt-4-turbo -> GPT-4 Turbo
		return id
			.replace('gpt-', 'GPT-')
			.replace('-turbo', ' Turbo')
			.replace('-mini', ' Mini')
			.replace(/-(\d{4}-\d{2}-\d{2})$/, ' ($1)'); // Date suffix
	}
}

// Singleton instance
export const modelFetcher = new ModelFetcher();
