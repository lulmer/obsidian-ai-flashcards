import type { Flashcard } from '../types';
import { FlashcardError } from '../types';

/**
 * Parse LLM output into structured flashcards.
 * Supports multiple formats:
 *
 * Format 1 (preferred - Spaced Repetition style):
 *   Question text
 *   ?
 *   Answer text
 *   #flashcard
 *
 * Format 2 (Q:/A: style):
 *   Q: Question text
 *   A: Answer text
 *
 * Format 3 (XML-style tags):
 *   <question>Question text</question>
 *   <answer>Answer text</answer>
 */
export function parseFlashcards(llmOutput: string): Flashcard[] {
	// Strip any <think>...</think> blocks (reasoning models like Qwen)
	const cleanedOutput = llmOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

	let flashcards: Flashcard[] = [];

	// Try Format 1: Question\n?\nAnswer\n#flashcard
	flashcards = parseSpacedRepetitionFormat(cleanedOutput);
	if (flashcards.length > 0) return flashcards;

	// Try Format 2: Q: / A: pairs
	flashcards = parseQAFormat(cleanedOutput);
	if (flashcards.length > 0) return flashcards;

	// Try Format 3: <question>/<answer> XML tags
	flashcards = parseXMLFormat(cleanedOutput);
	if (flashcards.length > 0) return flashcards;

	// Try Format 4: **Question:** / **Answer:** markdown
	flashcards = parseMarkdownFormat(cleanedOutput);
	if (flashcards.length > 0) return flashcards;

	throw new FlashcardError(
		'parse_failure',
		'Could not parse any flashcards from the response. Try a different template or check if your note has enough content.'
	);
}

/**
 * Parse Spaced Repetition format: Question\n?\nAnswer\n#flashcard
 */
function parseSpacedRepetitionFormat(output: string): Flashcard[] {
	const flashcards: Flashcard[] = [];
	const blocks = output.split('#flashcard');

	for (const block of blocks) {
		const trimmedBlock = block.trim();
		if (!trimmedBlock) continue;

		const parts = trimmedBlock.split(/\n\?\n/);

		if (parts.length >= 2) {
			const question = parts[0]?.trim() ?? '';
			const answer = parts.slice(1).join('\n?\n').trim();

			if (question && answer) {
				flashcards.push({ question, answer });
			}
		}
	}

	return flashcards;
}

/**
 * Parse Q:/A: format
 */
function parseQAFormat(output: string): Flashcard[] {
	const flashcards: Flashcard[] = [];

	// Match Q: ... A: ... patterns (multiline answers supported)
	const qaRegex = /Q:\s*(.+?)[\n\r]+A:\s*([\s\S]+?)(?=[\n\r]+Q:|$)/gi;
	let match;

	while ((match = qaRegex.exec(output)) !== null) {
		const question = match[1]?.trim() ?? '';
		const answer = match[2]?.trim() ?? '';

		if (question && answer) {
			flashcards.push({ question, answer });
		}
	}

	return flashcards;
}

/**
 * Parse XML-style <question>/<answer> tags
 */
function parseXMLFormat(output: string): Flashcard[] {
	const flashcards: Flashcard[] = [];

	// Match <question>...</question> <answer>...</answer> pairs
	const questionRegex = /<question>\s*([\s\S]*?)\s*<\/question>/gi;
	const answerRegex = /<answer>\s*([\s\S]*?)\s*<\/answer>/gi;

	const questions: string[] = [];
	const answers: string[] = [];

	let match;
	while ((match = questionRegex.exec(output)) !== null) {
		questions.push(match[1]?.trim() ?? '');
	}
	while ((match = answerRegex.exec(output)) !== null) {
		answers.push(match[1]?.trim() ?? '');
	}

	// Pair them up
	const count = Math.min(questions.length, answers.length);
	for (let i = 0; i < count; i++) {
		const q = questions[i];
		const a = answers[i];
		if (q && a) {
			flashcards.push({ question: q, answer: a });
		}
	}

	return flashcards;
}

/**
 * Parse Markdown format: **Question:** / **Answer:**
 */
function parseMarkdownFormat(output: string): Flashcard[] {
	const flashcards: Flashcard[] = [];

	// Match **Question:**/**Q:** ... **Answer:**/**A:** patterns
	const mdRegex = /\*\*(?:Question|Q):\*\*\s*(.+?)[\n\r]+\*\*(?:Answer|A):\*\*\s*([\s\S]+?)(?=[\n\r]+\*\*(?:Question|Q):|$)/gi;
	let match;

	while ((match = mdRegex.exec(output)) !== null) {
		const question = match[1]?.trim() ?? '';
		const answer = match[2]?.trim() ?? '';

		if (question && answer) {
			flashcards.push({ question, answer });
		}
	}

	return flashcards;
}

/**
 * Format flashcards for Spaced Repetition plugin output.
 */
export function formatForSpacedRepetition(flashcards: Flashcard[]): string {
	return flashcards
		.map(card => `${card.question}\n?\n${card.answer}\n#flashcard`)
		.join('\n\n');
}

/**
 * Create a header section for the flashcard file.
 */
export function createFlashcardHeader(sourceNoteName: string, templateName: string): string {
	const timestamp = new Date().toLocaleString();
	return `---
source: "[[${sourceNoteName}]]"
template: ${templateName}
generated: ${timestamp}
---

`;
}
