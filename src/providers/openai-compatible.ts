import { BaseLLMProvider } from './base';
import type { LLMMessage, LLMResponse } from '../types';
import { FlashcardError } from '../types';

interface OpenAICompatibleMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface OpenAICompatibleResponse {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Provider for OpenAI-compatible APIs like Ollama, LM Studio, vLLM, etc.
 */
export class OpenAICompatibleProvider extends BaseLLMProvider {
	get displayName(): string {
		return 'Custom Endpoint';
	}

	validate(): void {
		if (!this.config.baseUrl) {
			throw new FlashcardError(
				'no_api_key',
				'Please configure your custom endpoint URL in settings'
			);
		}
		if (!this.config.model) {
			throw new FlashcardError(
				'no_api_key',
				'Please configure your model name in settings'
			);
		}
	}

	private buildApiUrl(): string {
		let baseUrl = this.config.baseUrl!.trim();
		// Remove trailing slash if present
		if (baseUrl.endsWith('/')) {
			baseUrl = baseUrl.slice(0, -1);
		}
		// Add the chat completions path if not already present
		if (!baseUrl.endsWith('/v1/chat/completions')) {
			if (!baseUrl.endsWith('/v1')) {
				baseUrl += '/v1';
			}
			baseUrl += '/chat/completions';
		}
		return baseUrl;
	}

	async complete(messages: LLMMessage[]): Promise<LLMResponse> {
		this.validate();

		const apiMessages: OpenAICompatibleMessage[] = messages.map(msg => ({
			role: msg.role,
			content: msg.content,
		}));

		const headers: Record<string, string> = {};
		if (this.config.apiKey) {
			headers['Authorization'] = `Bearer ${this.config.apiKey}`;
		}

		const response = await this.makeRequest(
			this.buildApiUrl(),
			'POST',
			headers,
			{
				model: this.config.model,
				messages: apiMessages,
				temperature: this.config.temperature,
				max_tokens: this.config.maxTokens,
			}
		);

		const data = response.json as OpenAICompatibleResponse;

		if (!data.choices?.[0]?.message?.content) {
			throw new FlashcardError(
				'parse_failure',
				'Invalid response from custom endpoint'
			);
		}

		return {
			content: data.choices[0].message.content,
			usage: data.usage ? {
				promptTokens: data.usage.prompt_tokens,
				completionTokens: data.usage.completion_tokens,
				totalTokens: data.usage.total_tokens,
			} : undefined,
		};
	}
}
