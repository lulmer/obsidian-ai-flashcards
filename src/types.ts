/**
 * Shared types for the AI Flashcards plugin
 */

// ============================================================================
// LLM Provider Types
// ============================================================================

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface LLMResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export interface LLMProviderConfig {
	apiKey: string;
	model: string;
	baseUrl?: string;
	temperature: number;
	maxTokens: number;
}

// ============================================================================
// Flashcard Types
// ============================================================================

export interface Flashcard {
	question: string;
	answer: string;
}

export type OutputMode = 'folder' | 'append';

// ============================================================================
// Template Types
// ============================================================================

export interface FlashcardTemplate {
	id: string;
	name: string;
	description: string;
	systemPrompt: string;
	userPromptPrefix: string;
	userPromptSuffix: string;
	outputInstructions: string;
	isBuiltIn: boolean;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface FlashcardSettings {
	// Provider selection
	activeProvider: LLMProviderType;

	// OpenAI config
	openaiApiKey: string;
	openaiModel: string;

	// Anthropic config
	anthropicApiKey: string;
	anthropicModel: string;

	// Gemini config
	geminiApiKey: string;
	geminiModel: string;

	// Custom OpenAI-compatible endpoint
	customEndpointUrl: string;
	customApiKey: string;
	customModel: string;

	// Output configuration
	outputMode: OutputMode;
	outputFolderPath: string;

	// Template configuration
	activeTemplateId: string;
	customTemplates: FlashcardTemplate[];

	// Generation parameters
	temperature: number;
	maxTokens: number;
	maxInputTokens: number; // Max tokens for input content (for chunking)

	// Cached model lists (fetched from APIs)
	cachedModels: {
		openai: string[];
		anthropic: string[];
		gemini: string[];
		custom: string[];
		lastUpdated: Record<string, number>; // provider -> timestamp
	};
}

// ============================================================================
// Error Types
// ============================================================================

export type FlashcardErrorType =
	| 'empty_note'
	| 'no_api_key'
	| 'invalid_api_key'
	| 'rate_limited'
	| 'network_error'
	| 'parse_failure'
	| 'endpoint_unreachable'
	| 'unknown';

export class FlashcardError extends Error {
	constructor(
		public type: FlashcardErrorType,
		message: string,
		public originalError?: Error
	) {
		super(message);
		this.name = 'FlashcardError';
	}
}
