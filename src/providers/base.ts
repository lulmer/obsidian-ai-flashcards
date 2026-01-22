import { requestUrl, RequestUrlResponse } from 'obsidian';
import type { LLMMessage, LLMResponse, LLMProviderConfig } from '../types';
import { FlashcardError } from '../types';

/**
 * Abstract base class for LLM providers.
 * Each provider implements its own API format and authentication.
 */
export abstract class BaseLLMProvider {
	protected config: LLMProviderConfig;

	constructor(config: LLMProviderConfig) {
		this.config = config;
	}

	/**
	 * Send messages to the LLM and get a completion response.
	 */
	abstract complete(messages: LLMMessage[]): Promise<LLMResponse>;

	/**
	 * Validate that the provider is properly configured.
	 * Throws FlashcardError if configuration is invalid.
	 */
	abstract validate(): void;

	/**
	 * Get the display name for this provider.
	 */
	abstract get displayName(): string;

	/**
	 * Helper to make HTTP requests using Obsidian's requestUrl.
	 * Handles common error mapping.
	 */
	protected async makeRequest(
		url: string,
		method: 'GET' | 'POST',
		headers: Record<string, string>,
		body?: unknown
	): Promise<RequestUrlResponse> {
		try {
			const response = await requestUrl({
				url,
				method,
				headers: {
					'Content-Type': 'application/json',
					...headers,
				},
				body: body ? JSON.stringify(body) : undefined,
				throw: false, // Don't throw on non-2xx, we'll handle it
			});

			// Handle HTTP errors
			if (response.status === 401 || response.status === 403) {
				throw new FlashcardError(
					'invalid_api_key',
					'Invalid API key. Please check your settings.'
				);
			}

			if (response.status === 429) {
				throw new FlashcardError(
					'rate_limited',
					'Rate limited. Please wait and try again.'
				);
			}

			if (response.status >= 400) {
				const errorMessage = this.extractErrorMessage(response);
				throw new FlashcardError(
					'network_error',
					`API error (${response.status}): ${errorMessage}`
				);
			}

			return response;
		} catch (error) {
			// Re-throw FlashcardErrors as-is
			if (error instanceof FlashcardError) {
				throw error;
			}

			// Check for network/connection errors
			if (error instanceof Error) {
				if (error.message.includes('net::') ||
					error.message.includes('ECONNREFUSED') ||
					error.message.includes('Failed to fetch')) {
					throw new FlashcardError(
						'endpoint_unreachable',
						`Could not connect to ${url}. Is the server running?`,
						error
					);
				}
				throw new FlashcardError('network_error', `Network error: ${error.message}`, error);
			}

			throw new FlashcardError('unknown', 'An unknown error occurred');
		}
	}

	/**
	 * Extract error message from API response.
	 */
	protected extractErrorMessage(response: RequestUrlResponse): string {
		try {
			const json = response.json as { error?: { message?: string }; message?: string } | undefined;
			return json?.error?.message ?? json?.message ?? JSON.stringify(json);
		} catch {
			return response.text || 'Unknown error';
		}
	}
}
