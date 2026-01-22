import { App, Modal } from 'obsidian';

/**
 * Modal that displays while flashcards are being generated.
 */
export class LoadingModal extends Modal {
	private messageEl: HTMLElement;

	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ai-flashcards-loading-modal');

		// Create loading content
		const container = contentEl.createDiv({ cls: 'loading-container' });

		// Spinner
		container.createDiv({ cls: 'loading-spinner' });

		// Message
		this.messageEl = container.createEl('p', {
			text: 'Generating flashcards...',
			cls: 'loading-message',
		});

		// Tip
		container.createEl('p', {
			text: 'This may take a moment depending on the note length.',
			cls: 'loading-tip',
		});
	}

	/**
	 * Update the loading message.
	 */
	setMessage(message: string): void {
		if (this.messageEl) {
			this.messageEl.setText(message);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
