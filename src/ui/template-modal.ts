import { App, Modal, Setting, TextAreaComponent, Notice } from 'obsidian';
import type { FlashcardTemplate } from '../types';

export type TemplateModalMode = 'view' | 'edit' | 'create';

export interface TemplateModalResult {
	action: 'save' | 'delete' | 'cancel';
	template?: FlashcardTemplate;
}

/**
 * Modal for viewing, editing, or creating flashcard templates.
 */
export class TemplateModal extends Modal {
	private mode: TemplateModalMode;
	private template: FlashcardTemplate;
	private originalTemplate: FlashcardTemplate | null;
	private onSubmit: (result: TemplateModalResult) => void;

	// Form fields
	private nameInput: HTMLInputElement | null = null;
	private descriptionInput: HTMLInputElement | null = null;
	private systemPromptArea: TextAreaComponent | null = null;
	private outputInstructionsArea: TextAreaComponent | null = null;

	constructor(
		app: App,
		mode: TemplateModalMode,
		template: FlashcardTemplate | null,
		onSubmit: (result: TemplateModalResult) => void
	) {
		super(app);
		this.mode = mode;
		this.onSubmit = onSubmit;

		if (mode === 'create') {
			// Create a blank template
			this.template = {
				id: `custom-${Date.now()}`,
				name: '',
				description: '',
				systemPrompt: '',
				userPromptPrefix: 'Create flashcards from the following content:\n\n---\n',
				userPromptSuffix: '\n---',
				outputInstructions: `Output each flashcard in this exact format:

Q: [question here]
A: [answer here]

Rules:
- Start each question with "Q: " and each answer with "A: "
- One question-answer pair per flashcard
- Keep answers concise but complete
- Generate 5-10 flashcards based on the content
`,
				isBuiltIn: false,
			};
			this.originalTemplate = null;
		} else {
			// View or edit existing template
			this.template = { ...template! };
			this.originalTemplate = template!;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ai-flashcards-template-modal');

		// Title
		const title = this.mode === 'create' ? 'Create New Template'
			: this.mode === 'edit' ? `Edit Template: ${this.template.name}`
			: `Template: ${this.template.name}`;
		contentEl.createEl('h2', { text: title });

		const isReadOnly = this.mode === 'view';

		// Name field
		new Setting(contentEl)
			.setName('Template name')
			.setDesc('A short name for this template')
			.addText(text => {
				this.nameInput = text.inputEl;
				text.setValue(this.template.name)
					.setPlaceholder('e.g., Medical terms')
					.setDisabled(isReadOnly)
					.onChange(value => {
						this.template.name = value;
					});
			});

		// Description field
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of what this template produces')
			.addText(text => {
				this.descriptionInput = text.inputEl;
				text.setValue(this.template.description)
					.setPlaceholder('e.g., Q&A cards for medical terminology')
					.setDisabled(isReadOnly)
					.onChange(value => {
						this.template.description = value;
					});
			});

		// System prompt (main instructions to the LLM)
		contentEl.createEl('h3', { text: 'System prompt' });
		contentEl.createEl('p', {
			text: 'Instructions that tell the AI how to generate flashcards. This sets the behavior and style.',
			cls: 'setting-item-description'
		});

		const systemPromptContainer = contentEl.createDiv({ cls: 'template-textarea-container' });
		this.systemPromptArea = new TextAreaComponent(systemPromptContainer);
		this.systemPromptArea
			.setValue(this.template.systemPrompt)
			.setPlaceholder('You are an expert at creating flashcards...')
			.setDisabled(isReadOnly)
			.onChange(value => {
				this.template.systemPrompt = value;
			});
		this.systemPromptArea.inputEl.rows = 8;
		this.systemPromptArea.inputEl.addClass('template-textarea');

		// Output instructions (format instructions)
		contentEl.createEl('h3', { text: 'Output format instructions' });
		contentEl.createEl('p', {
			text: 'Tell the AI exactly what format to output. This is appended to the system prompt.',
			cls: 'setting-item-description'
		});

		const outputContainer = contentEl.createDiv({ cls: 'template-textarea-container' });
		this.outputInstructionsArea = new TextAreaComponent(outputContainer);
		this.outputInstructionsArea
			.setValue(this.template.outputInstructions)
			.setPlaceholder('Output each flashcard in this format:\nQ: ...\nA: ...')
			.setDisabled(isReadOnly)
			.onChange(value => {
				this.template.outputInstructions = value;
			});
		this.outputInstructionsArea.inputEl.rows = 6;
		this.outputInstructionsArea.inputEl.addClass('template-textarea');

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'template-modal-buttons' });

		if (this.mode === 'view') {
			// View mode: Edit (copy) and Close buttons
			if (this.template.isBuiltIn) {
				const editCopyBtn = buttonContainer.createEl('button', { text: 'Edit as copy' });
				editCopyBtn.addEventListener('click', () => {
					this.close();
					// Create a copy for editing
					const copy: FlashcardTemplate = {
						...this.template,
						id: `custom-${Date.now()}`,
						name: `${this.template.name} (Custom)`,
						isBuiltIn: false,
					};
					new TemplateModal(this.app, 'create', null, this.onSubmit).open();
					// Pre-fill the new modal - we need to do this differently
					// Actually let's just switch to edit mode with a copy
					this.onSubmit({ action: 'save', template: copy });
				});
			}

			const closeBtn = buttonContainer.createEl('button', { text: 'Close', cls: 'mod-cta' });
			closeBtn.addEventListener('click', () => {
				this.close();
				this.onSubmit({ action: 'cancel' });
			});

		} else {
			// Edit/Create mode: Save, Delete (if custom), Cancel buttons
			if (this.mode === 'edit' && !this.template.isBuiltIn) {
				const deleteBtn = buttonContainer.createEl('button', { text: 'Delete', cls: 'mod-warning' });
				deleteBtn.addEventListener('click', () => {
					this.close();
					this.onSubmit({ action: 'delete', template: this.template });
				});
			}

			const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
			cancelBtn.addEventListener('click', () => {
				this.close();
				this.onSubmit({ action: 'cancel' });
			});

			const saveBtn = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
			saveBtn.addEventListener('click', () => {
				if (this.validateTemplate()) {
					this.close();
					this.onSubmit({ action: 'save', template: this.template });
				}
			});
		}
	}

	private validateTemplate(): boolean {
		if (!this.template.name.trim()) {
			new Notice('Please enter a template name');
			this.nameInput?.focus();
			return false;
		}
		if (!this.template.systemPrompt.trim()) {
			new Notice('Please enter a system prompt');
			this.systemPromptArea?.inputEl.focus();
			return false;
		}
		if (!this.template.outputInstructions.trim()) {
			new Notice('Please enter output format instructions');
			this.outputInstructionsArea?.inputEl.focus();
			return false;
		}
		return true;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
