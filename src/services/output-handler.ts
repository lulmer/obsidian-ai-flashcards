import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import type { OutputMode } from '../types';

/**
 * Handle writing flashcards to files.
 */
export class OutputHandler {
	constructor(private app: App) {}

	/**
	 * Write flashcards based on the output mode.
	 */
	async writeFlashcards(
		content: string,
		sourceFile: TFile,
		mode: OutputMode,
		folderPath: string
	): Promise<TFile> {
		if (mode === 'append') {
			return this.appendToFile(sourceFile, content);
		} else {
			return this.createFlashcardFile(content, sourceFile, folderPath);
		}
	}

	/**
	 * Append flashcards to the end of the source file.
	 */
	private async appendToFile(file: TFile, content: string): Promise<TFile> {
		const existingContent = await this.app.vault.read(file);
		const separator = '\n\n---\n\n## Flashcards\n\n';
		const newContent = existingContent + separator + content;
		await this.app.vault.modify(file, newContent);
		return file;
	}

	/**
	 * Create a new flashcard file in the specified folder.
	 * If a file with the same name exists, adds a number suffix: (2), (3), etc.
	 */
	private async createFlashcardFile(
		content: string,
		sourceFile: TFile,
		folderPath: string
	): Promise<TFile> {
		// Ensure the folder exists
		await this.ensureFolderExists(folderPath);

		// Generate base filename
		const baseName = sourceFile.basename;
		const baseFileName = `Flashcards - ${baseName}`;

		// Find available filename
		const availablePath = this.findAvailableFilename(folderPath, baseFileName);

		// Create new file
		const file = await this.app.vault.create(availablePath, content);
		return file;
	}

	/**
	 * Find an available filename by adding (2), (3), etc. if needed.
	 */
	private findAvailableFilename(folderPath: string, baseFileName: string): string {
		let candidatePath = `${folderPath}/${baseFileName}.md`;

		// Check if base name is available
		if (!this.app.vault.getAbstractFileByPath(candidatePath)) {
			return candidatePath;
		}

		// Try numbered suffixes: (2), (3), (4), ...
		let counter = 2;
		while (counter < 1000) { // Safety limit
			candidatePath = `${folderPath}/${baseFileName} (${counter}).md`;
			if (!this.app.vault.getAbstractFileByPath(candidatePath)) {
				return candidatePath;
			}
			counter++;
		}

		// Fallback with timestamp if somehow we hit 1000 duplicates
		const timestamp = Date.now();
		return `${folderPath}/${baseFileName} (${timestamp}).md`;
	}

	/**
	 * Ensure a folder exists, creating it if necessary.
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}
	}
}
