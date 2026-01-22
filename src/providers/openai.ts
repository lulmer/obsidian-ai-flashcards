import { BaseLLMProvider } from './base';
import type { LLMMessage, LLMResponse } from '../types';
import { FlashcardError } from '../types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface OpenAIResponse {
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

export class OpenAIProvider extends BaseLLMProvider {
	get displayName(): string {
		return 'OpenAI';
	}

	validate(): void {
		if (!this.config.apiKey) {
			throw new FlashcardError(
				'no_api_key',
				'Please configure your OpenAI API key in settings'
			);
		}
		if (!this.config.model) {
			throw new FlashcardError(
				'no_api_key',
				'Please select an OpenAI model in settings'
			);
		}
	}

	async complete(messages: LLMMessage[]): Promise<LLMResponse> {
		this.validate();

		const openaiMessages: OpenAIMessage[] = messages.map(msg => ({
			role: msg.role,
			content: msg.content,
		}));

		const response = await this.makeRequest(
			OPENAI_API_URL,
			'POST',
			{
				'Authorization': `Bearer ${this.config.apiKey}`,
			},
			{
				model: this.config.model,
				messages: openaiMessages,
				temperature: this.config.temperature,
				max_tokens: this.config.maxTokens,
			}
		);

		const data = response.json as OpenAIResponse;

		if (!data.choices?.[0]?.message?.content) {
			throw new FlashcardError(
				'parse_failure',
				'Invalid response from OpenAI API'
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
