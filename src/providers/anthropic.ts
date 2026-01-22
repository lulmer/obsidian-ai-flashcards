import { BaseLLMProvider } from './base';
import type { LLMMessage, LLMResponse } from '../types';
import { FlashcardError } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessage {
	role: 'user' | 'assistant';
	content: string;
}

interface AnthropicResponse {
	content: Array<{
		type: 'text';
		text: string;
	}>;
	usage?: {
		input_tokens: number;
		output_tokens: number;
	};
}

export class AnthropicProvider extends BaseLLMProvider {
	get displayName(): string {
		return 'Anthropic (Claude)';
	}

	validate(): void {
		if (!this.config.apiKey) {
			throw new FlashcardError(
				'no_api_key',
				'Please configure your Anthropic API key in settings'
			);
		}
		if (!this.config.model) {
			throw new FlashcardError(
				'no_api_key',
				'Please select a Claude model in settings'
			);
		}
	}

	async complete(messages: LLMMessage[]): Promise<LLMResponse> {
		this.validate();

		// Anthropic uses a separate system parameter, not in messages array
		let systemPrompt: string | undefined;
		const anthropicMessages: AnthropicMessage[] = [];

		for (const msg of messages) {
			if (msg.role === 'system') {
				systemPrompt = msg.content;
			} else {
				anthropicMessages.push({
					role: msg.role as 'user' | 'assistant',
					content: msg.content,
				});
			}
		}

		const requestBody: Record<string, unknown> = {
			model: this.config.model,
			messages: anthropicMessages,
			max_tokens: this.config.maxTokens,
			temperature: this.config.temperature,
		};

		if (systemPrompt) {
			requestBody.system = systemPrompt;
		}

		const response = await this.makeRequest(
			ANTHROPIC_API_URL,
			'POST',
			{
				'x-api-key': this.config.apiKey,
				'anthropic-version': ANTHROPIC_VERSION,
			},
			requestBody
		);

		const data = response.json as AnthropicResponse;

		if (!data.content?.[0]?.text) {
			throw new FlashcardError(
				'parse_failure',
				'Invalid response from Anthropic API'
			);
		}

		return {
			content: data.content[0].text,
			usage: data.usage ? {
				promptTokens: data.usage.input_tokens,
				completionTokens: data.usage.output_tokens,
				totalTokens: data.usage.input_tokens + data.usage.output_tokens,
			} : undefined,
		};
	}
}
