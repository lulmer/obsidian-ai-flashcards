import type { FlashcardSettings, LLMProviderConfig } from '../types';
import { BaseLLMProvider } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenAICompatibleProvider } from './openai-compatible';

export { BaseLLMProvider } from './base';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { GeminiProvider } from './gemini';
export { OpenAICompatibleProvider } from './openai-compatible';

/**
 * Factory function to create the appropriate LLM provider based on settings.
 */
export function createProvider(settings: FlashcardSettings): BaseLLMProvider {
	const { activeProvider, temperature, maxTokens } = settings;

	const baseConfig = { temperature, maxTokens };

	switch (activeProvider) {
		case 'openai': {
			const config: LLMProviderConfig = {
				...baseConfig,
				apiKey: settings.openaiApiKey,
				model: settings.openaiModel,
			};
			return new OpenAIProvider(config);
		}

		case 'anthropic': {
			const config: LLMProviderConfig = {
				...baseConfig,
				apiKey: settings.anthropicApiKey,
				model: settings.anthropicModel,
			};
			return new AnthropicProvider(config);
		}

		case 'gemini': {
			const config: LLMProviderConfig = {
				...baseConfig,
				apiKey: settings.geminiApiKey,
				model: settings.geminiModel,
			};
			return new GeminiProvider(config);
		}

		case 'openai-compatible': {
			const config: LLMProviderConfig = {
				...baseConfig,
				apiKey: settings.customApiKey,
				model: settings.customModel,
				baseUrl: settings.customEndpointUrl,
			};
			return new OpenAICompatibleProvider(config);
		}

		default: {
			const _exhaustive: never = activeProvider;
			throw new Error(`Unknown provider: ${_exhaustive as string}`);
		}
	}
}
