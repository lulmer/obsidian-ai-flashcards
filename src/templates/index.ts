import type { FlashcardTemplate } from '../types';

/**
 * Standard output instructions for Spaced Repetition plugin compatibility.
 * Uses Q:/A: format which works well with most LLMs including local models.
 */
const STANDARD_OUTPUT_INSTRUCTIONS = `
Output each flashcard in this exact format:

Q: [question here]
A: [answer here]

Q: [next question]
A: [next answer]

Rules:
- Start each question with "Q: " and each answer with "A: "
- One question-answer pair per flashcard
- Keep answers concise but complete
- Generate 5-10 flashcards based on the content
- Do not add any other text or explanation
`;

export const BUILT_IN_TEMPLATES: FlashcardTemplate[] = [
	{
		id: 'basic-recall',
		name: 'Basic Recall',
		description: 'Simple question-answer pairs for factual recall. Best for definitions, facts, and straightforward concepts.',
		isBuiltIn: true,
		systemPrompt: `You are an expert at creating effective flashcards for learning and retention.
Your goal is to create clear, concise question-answer pairs that test recall of key facts and concepts.

Guidelines:
- Focus on one concept per flashcard
- Questions should be specific and unambiguous
- Answers should be brief but complete
- Avoid yes/no questions when possible
- Target the most important information in the content`,
		userPromptPrefix: 'Create flashcards from the following note content:\n\n---\n',
		userPromptSuffix: '\n---',
		outputInstructions: STANDARD_OUTPUT_INSTRUCTIONS,
	},
	{
		id: 'concept-explanation',
		name: 'Concept Explanation',
		description: 'Questions that ask to explain concepts in your own words. Great for deeper understanding.',
		isBuiltIn: true,
		systemPrompt: `You are an expert educator creating flashcards that promote deep understanding.
Your goal is to create questions that require explaining concepts, not just recalling facts.

Guidelines:
- Ask "What is..." "Explain..." "How does..." "Why does..." questions
- Answers should provide clear explanations, not just definitions
- Focus on understanding mechanisms and relationships
- Encourage connections between concepts
- Suitable for concepts that benefit from explanation rather than rote memorization`,
		userPromptPrefix: 'Create explanation-focused flashcards from the following content:\n\n---\n',
		userPromptSuffix: '\n---',
		outputInstructions: STANDARD_OUTPUT_INSTRUCTIONS,
	},
	{
		id: 'cloze-deletion',
		name: 'Cloze Deletions',
		description: 'Fill-in-the-blank style cards using _____ for missing terms. Good for terminology and key phrases.',
		isBuiltIn: true,
		systemPrompt: `You are an expert at creating cloze deletion flashcards for effective learning.
Your goal is to create fill-in-the-blank questions that test recall of key terms and phrases.

Guidelines:
- Replace exactly ONE key term or short phrase with _____
- The blank should test a specific, important piece of information
- Provide enough context for the answer to be unambiguous
- The answer should be the exact word(s) that fill the blank
- Focus on terminology, names, numbers, and key concepts`,
		userPromptPrefix: 'Create cloze deletion flashcards from the following content:\n\n---\n',
		userPromptSuffix: '\n---',
		outputInstructions: `
Output each flashcard in this exact format:

Q: [sentence with _____ for the blank]
A: [word(s) that fill the blank]

Rules:
- Start each question with "Q: " and each answer with "A: "
- Use exactly _____ (5 underscores) for the blank
- The answer should be ONLY the word(s) that fill the blank
- Generate 5-10 flashcards based on the content
`,
	},
	{
		id: 'compare-contrast',
		name: 'Compare & Contrast',
		description: 'Questions about similarities and differences between concepts. Ideal for related topics.',
		isBuiltIn: true,
		systemPrompt: `You are an expert at creating flashcards that test understanding of relationships between concepts.
Your goal is to create questions about similarities, differences, and relationships.

Guidelines:
- Ask about differences between related concepts
- Ask about similarities between concepts that might seem different
- Focus on meaningful distinctions, not trivial ones
- Answers should clearly articulate the comparison
- Help learners avoid common confusions between similar concepts`,
		userPromptPrefix: 'Create comparison flashcards from the following content:\n\n---\n',
		userPromptSuffix: '\n---',
		outputInstructions: STANDARD_OUTPUT_INSTRUCTIONS,
	},
	{
		id: 'application-based',
		name: 'Application-Based',
		description: 'Questions about applying knowledge to scenarios. Best for practical skills and problem-solving.',
		isBuiltIn: true,
		systemPrompt: `You are an expert at creating flashcards that test practical application of knowledge.
Your goal is to create questions that ask how to use concepts in real situations.

Guidelines:
- Ask "How would you use X to..." "When would you..." "What approach would you take for..."
- Create realistic scenarios when possible
- Focus on practical application, not just theory
- Answers should explain the application or approach
- Test transfer of knowledge to new situations`,
		userPromptPrefix: 'Create application-focused flashcards from the following content:\n\n---\n',
		userPromptSuffix: '\n---',
		outputInstructions: STANDARD_OUTPUT_INSTRUCTIONS,
	},
];

/**
 * Get all available templates (built-in + custom).
 */
export function getAllTemplates(customTemplates: FlashcardTemplate[]): FlashcardTemplate[] {
	return [...BUILT_IN_TEMPLATES, ...customTemplates];
}

/**
 * Find a template by ID from all available templates.
 */
export function findTemplate(
	templateId: string,
	customTemplates: FlashcardTemplate[]
): FlashcardTemplate | undefined {
	return getAllTemplates(customTemplates).find(t => t.id === templateId);
}

/**
 * Build the complete prompt for the LLM from a template and note content.
 */
export function buildPrompt(
	template: FlashcardTemplate,
	noteContent: string
): { systemPrompt: string; userPrompt: string } {
	const systemPrompt = template.systemPrompt + '\n\n' + template.outputInstructions;
	const userPrompt = template.userPromptPrefix + noteContent + template.userPromptSuffix;

	return { systemPrompt, userPrompt };
}
