import { MarkdownView, Notice, Plugin } from 'obsidian';
import type { FlashcardSettings } from './types';
import { FlashcardError } from './types';
import { DEFAULT_SETTINGS, FlashcardSettingTab } from './settings';
import { FlashcardGenerator } from './services/flashcard-generator';

export default class AIFlashcardsPlugin extends Plugin {
	settings: FlashcardSettings;
	private generator: FlashcardGenerator;
	private isGenerating = false;
	private ribbonIconEl: HTMLElement | null = null;
	private statusBarEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.generator = new FlashcardGenerator(this.app);

		// Main command: Generate flashcards from current note
		this.addCommand({
			id: 'generate-flashcards',
			name: 'Generate flashcards from current note',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView?.file) {
					if (!checking) {
						void this.generateFlashcards();
					}
					return true;
				}
				return false;
			},
		});

		// Ribbon icon - deck of cards style (using "copy" icon which looks like stacked cards)
		this.ribbonIconEl = this.addRibbonIcon('copy', 'Generate AI flashcards', () => {
			void this.generateFlashcards();
		});

		// Add custom styling to make it look more like cards
		this.ribbonIconEl.addClass('ai-flashcards-ribbon');

		// Status bar for showing generation progress
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass('ai-flashcards-status');
		this.statusBarEl.hide();

		// Settings tab
		this.addSettingTab(new FlashcardSettingTab(this.app, this));
	}

	onunload(): void {
		// Cleanup if needed
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FlashcardSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Main workflow: Generate flashcards from the current note.
	 * Runs in the background without blocking the UI.
	 */
	private generateFlashcards(): void {
		// Prevent multiple concurrent generations
		if (this.isGenerating) {
			new Notice('Flashcard generation already in progress...');
			return;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = activeView?.file;

		if (!file) {
			new Notice('No active note found. Please open a note first.');
			return;
		}

		// Start generation (non-blocking)
		this.isGenerating = true;
		this.updateUI(true, file.basename);

		// Run generation in background - don't await to keep UI responsive
		void this.runGenerationInBackground(file);
	}

	/**
	 * Run the generation process in the background.
	 */
	private async runGenerationInBackground(file: import('obsidian').TFile): Promise<void> {
		try {
			// Progress callback to update status bar
			const onProgress = (message: string) => {
				this.updateStatusBar(message);
			};

			const result = await this.generator.generate(file, this.settings, onProgress);

			// Show success message with chunk info if applicable
			const count = result.flashcards.length;
			const outputPath = result.outputFile.path;
			const chunkInfo = result.chunksProcessed && result.chunksProcessed > 1
				? ` (from ${result.chunksProcessed} chunks)`
				: '';
			new Notice(`Generated ${count} flashcard${count !== 1 ? 's' : ''}${chunkInfo} in ${outputPath}`);

			// Open the output file if it's different from source
			if (result.outputFile.path !== file.path) {
				await this.app.workspace.openLinkText(result.outputFile.path, '', false);
			}

		} catch (error) {
			this.handleError(error);
		} finally {
			this.isGenerating = false;
			this.updateUI(false);
		}
	}

	/**
	 * Update UI elements to reflect generation state.
	 */
	private updateUI(generating: boolean, noteName?: string): void {
		if (this.ribbonIconEl) {
			if (generating) {
				this.ribbonIconEl.addClass('is-generating');
				this.ribbonIconEl.setAttribute('aria-label', 'Generating flashcards...');
			} else {
				this.ribbonIconEl.removeClass('is-generating');
				this.ribbonIconEl.setAttribute('aria-label', 'Generate AI flashcards');
			}
		}

		if (this.statusBarEl) {
			if (generating && noteName) {
				this.statusBarEl.setText(`Generating flashcards for "${noteName}"...`);
				this.statusBarEl.show();
			} else {
				this.statusBarEl.hide();
			}
		}
	}

	/**
	 * Update just the status bar text (for progress updates).
	 */
	private updateStatusBar(message: string): void {
		if (this.statusBarEl) {
			this.statusBarEl.setText(message);
		}
	}

	/**
	 * Handle errors with user-friendly messages.
	 */
	private handleError(error: unknown): void {
		if (error instanceof FlashcardError) {
			new Notice(error.message);
			console.error(`[AI Flashcards] ${error.type}:`, error.message, error.originalError);
		} else if (error instanceof Error) {
			new Notice(`Error: ${error.message}`);
			console.error('[AI Flashcards] Unexpected error:', error);
		} else {
			new Notice('An unexpected error occurred. Check the console for details.');
			console.error('[AI Flashcards] Unknown error:', error);
		}
	}
}
