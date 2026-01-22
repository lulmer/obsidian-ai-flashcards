import { BaseLLMProvider } from './base';
import type { LLMMessage, LLMResponse } from '../types';
import { FlashcardError } from '../types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiContent {
	role: 'user' | 'model';
	parts: Array<{ text: string }>;
}

interface GeminiResponse {
	candidates: Array<{
		content: {
			parts: Array<{ text: string }>;
		};
	}>;
	usageMetadata?: {
		promptTokenCount: number;
		candidatesTokenCount: number;
		totalTokenCount: number;
	};
}

export class GeminiProvider extends BaseLLMProvider {
	get displayName(): string {
		return 'Google Gemini';
	}

	validate(): void {
		if (!this.config.apiKey) {
			throw new FlashcardError(
				'no_api_key',
				'Please configure your Gemini API key in settings'
			);
		}
		if (!this.config.model) {
			throw new FlashcardError(
				'no_api_key',
				'Please select a Gemini model in settings'
			);
		}
	}

	async complete(messages: LLMMessage[]): Promise<LLMResponse> {
		this.validate();

		// Gemini uses system instruction separately and different role names
		let systemInstruction: string | undefined;
		const geminiContents: GeminiContent[] = [];

		for (const msg of messages) {
			if (msg.role === 'system') {
				systemInstruction = msg.content;
			} else {
				geminiContents.push({
					role: msg.role === 'assistant' ? 'model' : 'user',
					parts: [{ text: msg.content }],
				});
			}
		}

		const url = `${GEMINI_API_BASE}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

		const requestBody: Record<string, unknown> = {
			contents: geminiContents,
			generationConfig: {
				temperature: this.config.temperature,
				maxOutputTokens: this.config.maxTokens,
			},
		};

		if (systemInstruction) {
			requestBody.systemInstruction = {
				parts: [{ text: systemInstruction }],
			};
		}

		const response = await this.makeRequest(
			url,
			'POST',
			{}, // API key is in URL for Gemini
			requestBody
		);

		const data = response.json as GeminiResponse;

		if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
			throw new FlashcardError(
				'parse_failure',
				'Invalid response from Gemini API'
			);
		}

		return {
			content: data.candidates[0].content.parts[0].text,
			usage: data.usageMetadata ? {
				promptTokens: data.usageMetadata.promptTokenCount,
				completionTokens: data.usageMetadata.candidatesTokenCount,
				totalTokens: data.usageMetadata.totalTokenCount,
			} : undefined,
		};
	}
}
