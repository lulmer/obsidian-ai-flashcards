import type { App, TFile } from 'obsidian';
import type { FlashcardSettings, Flashcard } from '../types';
import { FlashcardError } from '../types';
import { createProvider } from '../providers';
import { findTemplate, buildPrompt, BUILT_IN_TEMPLATES } from '../templates';
import { parseFlashcards, formatForSpacedRepetition, createFlashcardHeader } from './parser';
import { OutputHandler } from './output-handler';
import { chunkContent, needsChunking } from './chunker';

export interface GenerationResult {
	flashcards: Flashcard[];
	outputFile: TFile;
	chunksProcessed?: number;
	tokenUsage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export type ProgressCallback = (message: string) => void;

/**
 * Orchestrates the flashcard generation workflow.
 */
export class FlashcardGenerator {
	private outputHandler: OutputHandler;

	constructor(private app: App) {
		this.outputHandler = new OutputHandler(app);
	}

	/**
	 * Generate flashcards from a note.
	 * Automatically handles long documents by chunking.
	 */
	async generate(
		sourceFile: TFile,
		settings: FlashcardSettings,
		onProgress?: ProgressCallback
	): Promise<GenerationResult> {
		// 1. Read and validate note content
		const noteContent = await this.app.vault.read(sourceFile);
		if (!noteContent.trim()) {
			throw new FlashcardError(
				'empty_note',
				'Note is empty - cannot generate flashcards'
			);
		}

		// 2. Get the active template
		const template = findTemplate(settings.activeTemplateId, settings.customTemplates)
			?? BUILT_IN_TEMPLATES[0];

		if (!template) {
			throw new FlashcardError('unknown', 'No template found');
		}

		// 3. Create and validate the provider
		const provider = createProvider(settings);
		provider.validate();

		// 4. Check if we need to chunk the document
		const maxInputTokens = settings.maxInputTokens;
		const chunks = needsChunking(noteContent, maxInputTokens)
			? chunkContent(noteContent, { maxTokens: maxInputTokens })
			: [{ content: noteContent, index: 0, total: 1 }];

		const isChunked = chunks.length > 1;
		if (isChunked) {
			onProgress?.(`Document split into ${chunks.length} chunks`);
		}

		// 5. Process each chunk
		const allFlashcards: Flashcard[] = [];
		let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

		for (const chunk of chunks) {
			if (isChunked) {
				onProgress?.(`Processing chunk ${chunk.index + 1} of ${chunk.total}...`);
			}

			try {
				const { systemPrompt, userPrompt } = buildPrompt(template, chunk.content);

				const response = await provider.complete([
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt },
				]);

				// Parse flashcards from this chunk
				const chunkFlashcards = parseFlashcards(response.content);
				allFlashcards.push(...chunkFlashcards);

				// Accumulate token usage
				if (response.usage) {
					totalUsage.promptTokens += response.usage.promptTokens;
					totalUsage.completionTokens += response.usage.completionTokens;
					totalUsage.totalTokens += response.usage.totalTokens;
				}

			} catch (error) {
				// If parsing fails for a chunk, log but continue with others
				if (error instanceof FlashcardError && error.type === 'parse_failure' && isChunked) {
					console.warn(`[AI Flashcards] Chunk ${chunk.index + 1} parsing failed, skipping`);
					continue;
				}
				throw error;
			}
		}

		// 6. Check we got at least some flashcards
		if (allFlashcards.length === 0) {
			throw new FlashcardError(
				'parse_failure',
				'Could not generate any flashcards. Try a different template or check if your note has enough content.'
			);
		}

		// 7. Format for output
		const header = createFlashcardHeader(sourceFile.basename, template.name);
		const formattedCards = formatForSpacedRepetition(allFlashcards);
		const outputContent = header + formattedCards;

		// 8. Write to file
		const outputFile = await this.outputHandler.writeFlashcards(
			outputContent,
			sourceFile,
			settings.outputMode,
			settings.outputFolderPath
		);

		return {
			flashcards: allFlashcards,
			outputFile,
			chunksProcessed: chunks.length,
			tokenUsage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
		};
	}
}
