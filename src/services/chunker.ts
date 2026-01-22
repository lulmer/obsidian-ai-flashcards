/**
 * Service for splitting long documents into manageable chunks.
 * Uses a simple token estimation (1 token ≈ 4 characters).
 */

export interface ChunkOptions {
	maxTokens: number;       // Max tokens per chunk (default: 3000)
	overlapTokens: number;   // Overlap between chunks for context (default: 200)
}

export interface Chunk {
	content: string;
	index: number;
	total: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
	maxTokens: 3000,      // Conservative default, leaves room for prompt + response
	overlapTokens: 200,   // Small overlap for context continuity
};

/**
 * Estimate token count from text.
 * Rough approximation: 1 token ≈ 4 characters for English text.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Check if content needs to be chunked.
 */
export function needsChunking(content: string, maxTokens: number = DEFAULT_OPTIONS.maxTokens): boolean {
	return estimateTokens(content) > maxTokens;
}

/**
 * Split content into chunks, trying to preserve logical boundaries.
 */
export function chunkContent(content: string, options: Partial<ChunkOptions> = {}): Chunk[] {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const maxChars = opts.maxTokens * 4;
	const overlapChars = opts.overlapTokens * 4;

	// If content fits in one chunk, return as-is
	if (content.length <= maxChars) {
		return [{ content, index: 0, total: 1 }];
	}

	const chunks: Chunk[] = [];

	// First, try to split by markdown headers (## or ###)
	const sections = splitByHeaders(content);

	if (sections.length > 1) {
		// Combine sections into chunks that fit within maxChars
		chunks.push(...combineSectionsIntoChunks(sections, maxChars, overlapChars));
	} else {
		// No headers, split by paragraphs
		const paragraphs = splitByParagraphs(content);
		chunks.push(...combineParagraphsIntoChunks(paragraphs, maxChars, overlapChars));
	}

	// Update total count
	const total = chunks.length;
	return chunks.map((chunk, index) => ({
		...chunk,
		index,
		total,
	}));
}

/**
 * Split content by markdown headers (## level).
 */
function splitByHeaders(content: string): string[] {
	// Split on ## headers, keeping the header with its content
	const headerRegex = /(?=^## )/gm;
	const sections = content.split(headerRegex).filter(s => s.trim());

	// If we only got one section, try splitting by any header level
	if (sections.length <= 1) {
		const anyHeaderRegex = /(?=^#{1,6} )/gm;
		return content.split(anyHeaderRegex).filter(s => s.trim());
	}

	return sections;
}

/**
 * Split content by paragraphs (double newlines).
 */
function splitByParagraphs(content: string): string[] {
	return content.split(/\n\n+/).filter(p => p.trim());
}

/**
 * Combine sections into chunks that fit within maxChars.
 */
function combineSectionsIntoChunks(sections: string[], maxChars: number, overlapChars: number): Chunk[] {
	const chunks: Chunk[] = [];
	let currentChunk = '';
	let lastSection = '';

	for (const section of sections) {
		const sectionLength = section.length;

		// If single section exceeds max, split it by paragraphs
		if (sectionLength > maxChars) {
			// Save current chunk if any
			if (currentChunk) {
				chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });
				currentChunk = '';
			}

			// Split large section by paragraphs
			const paragraphs = splitByParagraphs(section);
			const subChunks = combineParagraphsIntoChunks(paragraphs, maxChars, overlapChars);
			chunks.push(...subChunks);
			lastSection = paragraphs[paragraphs.length - 1] || '';
			continue;
		}

		// Check if adding this section would exceed max
		if (currentChunk.length + sectionLength > maxChars) {
			// Save current chunk
			chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });

			// Start new chunk with overlap from last section
			const overlap = lastSection.length > overlapChars
				? lastSection.slice(-overlapChars)
				: lastSection;
			currentChunk = overlap + '\n\n' + section;
		} else {
			currentChunk += (currentChunk ? '\n\n' : '') + section;
		}

		lastSection = section;
	}

	// Don't forget the last chunk
	if (currentChunk.trim()) {
		chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });
	}

	return chunks;
}

/**
 * Combine paragraphs into chunks that fit within maxChars.
 */
function combineParagraphsIntoChunks(paragraphs: string[], maxChars: number, overlapChars: number): Chunk[] {
	const chunks: Chunk[] = [];
	let currentChunk = '';
	let lastParagraph = '';

	for (const para of paragraphs) {
		const paraLength = para.length;

		// If single paragraph exceeds max, force-split it
		if (paraLength > maxChars) {
			if (currentChunk) {
				chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });
				currentChunk = '';
			}

			// Force split at sentence boundaries or character limit
			const subChunks = forceSplitLongText(para, maxChars, overlapChars);
			chunks.push(...subChunks);
			lastParagraph = para.slice(-overlapChars);
			continue;
		}

		if (currentChunk.length + paraLength + 2 > maxChars) {
			chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });

			// Add overlap
			const overlap = lastParagraph.length > overlapChars
				? lastParagraph.slice(-overlapChars)
				: lastParagraph;
			currentChunk = overlap ? overlap + '\n\n' + para : para;
		} else {
			currentChunk += (currentChunk ? '\n\n' : '') + para;
		}

		lastParagraph = para;
	}

	if (currentChunk.trim()) {
		chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });
	}

	return chunks;
}

/**
 * Force-split very long text that doesn't have natural boundaries.
 */
function forceSplitLongText(text: string, maxChars: number, overlapChars: number): Chunk[] {
	const chunks: Chunk[] = [];

	// Try to split at sentence boundaries (avoiding lookbehind for iOS compatibility)
	const sentences = text.split(/([.!?])\s+/).reduce<string[]>((acc, part, i, arr) => {
		// Combine each sentence ending with the preceding text
		if (i % 2 === 0) {
			// Text part
			const ending = arr[i + 1] ?? '';
			acc.push(part + ending);
		}
		return acc;
	}, []);

	let currentChunk = '';

	for (const sentence of sentences) {
		if (currentChunk.length + sentence.length > maxChars) {
			if (currentChunk) {
				chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });
			}
			// If single sentence is too long, just hard cut
			if (sentence.length > maxChars) {
				let remaining = sentence;
				while (remaining.length > 0) {
					chunks.push({ content: remaining.slice(0, maxChars).trim(), index: 0, total: 0 });
					remaining = remaining.slice(maxChars - overlapChars);
				}
				currentChunk = '';
			} else {
				currentChunk = sentence;
			}
		} else {
			currentChunk += (currentChunk ? ' ' : '') + sentence;
		}
	}

	if (currentChunk.trim()) {
		chunks.push({ content: currentChunk.trim(), index: 0, total: 0 });
	}

	return chunks;
}
