import { App, PluginSettingTab, Setting, TextAreaComponent, Notice } from 'obsidian';
import type AIFlashcardsPlugin from './main';
import type { FlashcardSettings, FlashcardTemplate, LLMProviderType } from './types';
import { BUILT_IN_TEMPLATES, getAllTemplates } from './templates';
import { TemplateModal } from './ui/template-modal';
import { modelFetcher } from './services/model-fetcher';

export const DEFAULT_SETTINGS: FlashcardSettings = {
	// Provider selection
	activeProvider: 'openai',

	// OpenAI config
	openaiApiKey: '',
	openaiModel: 'gpt-4o-mini',

	// Anthropic config
	anthropicApiKey: '',
	anthropicModel: 'claude-sonnet-4-20250514',

	// Gemini config
	geminiApiKey: '',
	geminiModel: 'gemini-2.0-flash',

	// Custom endpoint config
	customEndpointUrl: '',
	customApiKey: '',
	customModel: '',

	// Output configuration
	outputMode: 'folder',
	outputFolderPath: 'Flashcards',

	// Template configuration
	activeTemplateId: 'basic-recall',
	customTemplates: [],

	// Generation parameters
	temperature: 0.7,
	maxTokens: 2048,
	maxInputTokens: 3000, // Conservative default for chunking

	// Cached model lists
	cachedModels: {
		openai: [],
		anthropic: [],
		gemini: [],
		custom: [],
		lastUpdated: {},
	},
};

const PROVIDER_DISPLAY_NAMES: Record<LLMProviderType, string> = {
	openai: 'OpenAI',
	anthropic: 'Anthropic (Claude)',
	gemini: 'Google Gemini',
	'openai-compatible': 'Custom Endpoint (OpenAI-compatible)',
};

export class FlashcardSettingTab extends PluginSettingTab {
	plugin: AIFlashcardsPlugin;

	constructor(app: App, plugin: AIFlashcardsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Header
		;

		// Provider Selection
		this.renderProviderSection(containerEl);

		// Provider-specific API settings
		this.renderApiKeySection(containerEl);

		// Output Settings
		this.renderOutputSection(containerEl);

		// Template Settings
		this.renderTemplateSection(containerEl);

		// Generation Parameters
		this.renderGenerationSection(containerEl);
	}

	private renderProviderSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("LLM provider").setHeading();

		new Setting(containerEl)
			.setName('Active provider')
			.setDesc('Select which LLM provider to use for generating flashcards')
			.addDropdown(dropdown => {
				for (const [value, name] of Object.entries(PROVIDER_DISPLAY_NAMES)) {
					dropdown.addOption(value, name);
				}
				dropdown.setValue(this.plugin.settings.activeProvider);
				dropdown.onChange(async (value) => {
					this.plugin.settings.activeProvider = value as LLMProviderType;
					await this.plugin.saveSettings();
					this.display(); // Re-render to show relevant API key field
				});
			});
	}

	private renderApiKeySection(containerEl: HTMLElement): void {
		const provider = this.plugin.settings.activeProvider;

		new Setting(containerEl).setName("API configuration").setHeading();

		switch (provider) {
			case 'openai':
				this.renderOpenAISettings(containerEl);
				break;
			case 'anthropic':
				this.renderAnthropicSettings(containerEl);
				break;
			case 'gemini':
				this.renderGeminiSettings(containerEl);
				break;
			case 'openai-compatible':
				this.renderCustomEndpointSettings(containerEl);
				break;
		}
	}

	private renderOpenAISettings(containerEl: HTMLElement): void {
		// API Key
		new Setting(containerEl)
			.setName('OpenAI API key')
			.setDesc('Your OpenAI API key')
			.addText(text => {
				text.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		// Model selection with refresh
		this.renderModelSelector(
			containerEl,
			'openai',
			this.plugin.settings.openaiModel,
			this.plugin.settings.cachedModels.openai,
			['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'], // defaults
			async (value) => {
				this.plugin.settings.openaiModel = value;
				await this.plugin.saveSettings();
			}
		);
	}

	private renderAnthropicSettings(containerEl: HTMLElement): void {
		// API Key
		new Setting(containerEl)
			.setName('Anthropic API key')
			.setDesc('Your Anthropic API key')
			.addText(text => {
				text.setPlaceholder('sk-ant-...')
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async (value) => {
						this.plugin.settings.anthropicApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		// Model selection with refresh
		this.renderModelSelector(
			containerEl,
			'anthropic',
			this.plugin.settings.anthropicModel,
			this.plugin.settings.cachedModels.anthropic,
			['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
			async (value) => {
				this.plugin.settings.anthropicModel = value;
				await this.plugin.saveSettings();
			}
		);
	}

	private renderGeminiSettings(containerEl: HTMLElement): void {
		// API Key
		new Setting(containerEl)
			.setName('Gemini API key')
			.setDesc('Your Google AI Studio API key')
			.addText(text => {
				text.setPlaceholder('AI...')
					.setValue(this.plugin.settings.geminiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.geminiApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		// Model selection with refresh
		this.renderModelSelector(
			containerEl,
			'gemini',
			this.plugin.settings.geminiModel,
			this.plugin.settings.cachedModels.gemini,
			['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
			async (value) => {
				this.plugin.settings.geminiModel = value;
				await this.plugin.saveSettings();
			}
		);
	}

	private renderCustomEndpointSettings(containerEl: HTMLElement): void {
		// Endpoint URL
		new Setting(containerEl)
			.setName('Endpoint URL')
			.setDesc('Base URL for the OpenAI-compatible API (e.g., http://localhost:11434 for Ollama)')
			.addText(text => text
				.setPlaceholder('http://localhost:11434')
				.setValue(this.plugin.settings.customEndpointUrl)
				.onChange(async (value) => {
					this.plugin.settings.customEndpointUrl = value;
					await this.plugin.saveSettings();
				}));

		// API Key (optional)
		new Setting(containerEl)
			.setName('API key (optional)')
			.setDesc('API key if required by your endpoint')
			.addText(text => text
				.setPlaceholder('Optional')
				.setValue(this.plugin.settings.customApiKey)
				.onChange(async (value) => {
					this.plugin.settings.customApiKey = value;
					await this.plugin.saveSettings();
				}));

		// Model selection with refresh (for custom endpoint)
		this.renderModelSelector(
			containerEl,
			'openai-compatible',
			this.plugin.settings.customModel,
			this.plugin.settings.cachedModels.custom,
			[], // No defaults for custom
			async (value) => {
				this.plugin.settings.customModel = value;
				await this.plugin.saveSettings();
			},
			true // Allow custom input
		);
	}

	/**
	 * Render a model selector with dropdown, refresh button, and optional custom input.
	 */
	private renderModelSelector(
		containerEl: HTMLElement,
		provider: LLMProviderType,
		currentValue: string,
		cachedModels: string[],
		defaultModels: string[],
		onChange: (value: string) => Promise<void>,
		allowCustomInput = false
	): void {
		// Combine cached and default models, removing duplicates
		const allModels = [...new Set([...cachedModels, ...defaultModels])];

		// Show last updated time if available
		const lastUpdated = this.plugin.settings.cachedModels.lastUpdated[provider];
		const lastUpdatedText = lastUpdated
			? ` (Updated: ${new Date(lastUpdated).toLocaleDateString()})`
			: '';

		const setting = new Setting(containerEl)
			.setName('Model')
			.setDesc(`Select a model${lastUpdatedText}`);

		setting.addDropdown(dd => {

			// Add models to dropdown
			if (allModels.length > 0) {
				for (const model of allModels) {
					dd.addOption(model, model);
				}
			} else {
				dd.addOption('', 'Click refresh to load models');
			}

			// Add current value if not in list
			if (currentValue && !allModels.includes(currentValue)) {
				dd.addOption(currentValue, currentValue + ' (current)');
			}

			dd.setValue(currentValue);
			dd.onChange(onChange);
		});

		// Refresh button
		setting.addButton(btn => {
			btn.setIcon('refresh-cw')
				.setTooltip('Fetch available models from API')
				.onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText('...');

					await this.refreshModels(provider);

					btn.setDisabled(false);
					btn.setButtonText('');
					btn.setIcon('refresh-cw');

					// Re-render to show updated models
					this.display();
				});
		});

		// Custom input option
		if (allowCustomInput) {
			new Setting(containerEl)
				.setName('Or enter model name manually')
				.setDesc('Type a model name if not listed above')
				.addText(text => text
					.setPlaceholder('e.g., llama3.2')
					.setValue(currentValue)
					.onChange(onChange));
		}
	}

	/**
	 * Fetch models from the provider API and update cache.
	 */
	private async refreshModels(provider: LLMProviderType): Promise<void> {
		let apiKey = '';
		let endpoint: string | undefined;

		switch (provider) {
			case 'openai':
				apiKey = this.plugin.settings.openaiApiKey;
				break;
			case 'anthropic':
				apiKey = this.plugin.settings.anthropicApiKey;
				break;
			case 'gemini':
				apiKey = this.plugin.settings.geminiApiKey;
				break;
			case 'openai-compatible':
				apiKey = this.plugin.settings.customApiKey;
				endpoint = this.plugin.settings.customEndpointUrl;
				break;
		}

		const result = await modelFetcher.fetchModels(provider, apiKey, endpoint);

		if (result.success && result.models.length > 0) {
			const modelIds = result.models.map(m => m.id);

			// Update cache based on provider
			switch (provider) {
				case 'openai':
					this.plugin.settings.cachedModels.openai = modelIds;
					break;
				case 'anthropic':
					this.plugin.settings.cachedModels.anthropic = modelIds;
					break;
				case 'gemini':
					this.plugin.settings.cachedModels.gemini = modelIds;
					break;
				case 'openai-compatible':
					this.plugin.settings.cachedModels.custom = modelIds;
					break;
			}

			this.plugin.settings.cachedModels.lastUpdated[provider] = Date.now();
			await this.plugin.saveSettings();

			new Notice(`Found ${result.models.length} models`);
		} else {
			new Notice(result.error || 'Failed to fetch models');
		}
	}

	private renderOutputSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Output").setHeading();

		new Setting(containerEl)
			.setName('Output mode')
			.setDesc('Where to save generated flashcards')
			.addDropdown(dropdown => {
				dropdown.addOption('folder', 'Create new file in folder');
				dropdown.addOption('append', 'Append to current note');
				dropdown.setValue(this.plugin.settings.outputMode);
				dropdown.onChange(async (value) => {
					this.plugin.settings.outputMode = value as 'folder' | 'append';
					await this.plugin.saveSettings();
					this.display();
				});
			});

		if (this.plugin.settings.outputMode === 'folder') {
			new Setting(containerEl)
				.setName('Output folder')
				.setDesc('Folder where flashcard files will be created')
				.addText(text => text
					.setPlaceholder('Flashcards')
					.setValue(this.plugin.settings.outputFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.outputFolderPath = value;
						await this.plugin.saveSettings();
					}));
		}
	}

	private renderTemplateSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Templates").setHeading();

		const templates = getAllTemplates(this.plugin.settings.customTemplates);
		const activeTemplate = templates.find(t => t.id === this.plugin.settings.activeTemplateId)
			?? BUILT_IN_TEMPLATES[0];

		// Template selection dropdown
		new Setting(containerEl)
			.setName('Active template')
			.setDesc('Template to use for flashcard generation')
			.addDropdown(dropdown => {
				for (const template of templates) {
					const prefix = template.isBuiltIn ? '' : '(Custom) ';
					dropdown.addOption(template.id, prefix + template.name);
				}
				dropdown.setValue(this.plugin.settings.activeTemplateId);
				dropdown.onChange(async (value) => {
					this.plugin.settings.activeTemplateId = value;
					await this.plugin.saveSettings();
					this.display(); // Re-render to show new template preview
				});
			});

		// Description
		if (activeTemplate) {
			containerEl.createEl('p', {
				text: activeTemplate.description,
				cls: 'setting-item-description template-description',
			});
		}

		// Template action buttons
		const buttonContainer = containerEl.createDiv({ cls: 'template-buttons' });

		if (activeTemplate) {
			// View/Edit button
			const editBtn = buttonContainer.createEl('button', {
				text: activeTemplate.isBuiltIn ? 'View template' : 'Edit template',
			});
			editBtn.addEventListener('click', () => {
				this.openTemplateModal(activeTemplate.isBuiltIn ? 'view' : 'edit', activeTemplate);
			});

			// Duplicate button (for built-in templates to create editable copy)
			if (activeTemplate.isBuiltIn) {
				const duplicateBtn = buttonContainer.createEl('button', { text: 'Duplicate & edit' });
				duplicateBtn.addEventListener('click', () => {
					this.duplicateTemplate(activeTemplate);
				});
			}

			// Delete button (only for custom templates)
			if (!activeTemplate.isBuiltIn) {
				const deleteBtn = buttonContainer.createEl('button', { text: 'Delete', cls: 'mod-warning' });
				deleteBtn.addEventListener('click', () => {
					void this.deleteTemplate(activeTemplate);
				});
			}
		}

		// Create new template button
		const createBtn = buttonContainer.createEl('button', { text: 'Create new template', cls: 'mod-cta' });
		createBtn.addEventListener('click', () => {
			this.openTemplateModal('create', null);
		});

		// Template preview section
		if (activeTemplate) {
			new Setting(containerEl).setName("Template preview").setHeading();

			// System prompt preview
			containerEl.createEl('label', { text: 'System prompt:', cls: 'template-label' });
			const systemPromptContainer = containerEl.createDiv({ cls: 'template-preview-container' });
			const systemPromptArea = new TextAreaComponent(systemPromptContainer);
			systemPromptArea
				.setValue(activeTemplate.systemPrompt)
				.setDisabled(true);
			systemPromptArea.inputEl.rows = 6;
			systemPromptArea.inputEl.addClass('template-preview-textarea');

			// Output instructions preview
			containerEl.createEl('label', { text: 'Output format instructions:', cls: 'template-label' });
			const outputContainer = containerEl.createDiv({ cls: 'template-preview-container' });
			const outputArea = new TextAreaComponent(outputContainer);
			outputArea
				.setValue(activeTemplate.outputInstructions)
				.setDisabled(true);
			outputArea.inputEl.rows = 5;
			outputArea.inputEl.addClass('template-preview-textarea');
		}
	}

	/**
	 * Open the template modal for viewing, editing, or creating.
	 */
	private openTemplateModal(mode: 'view' | 'edit' | 'create', template: FlashcardTemplate | null): void {
		new TemplateModal(this.app, mode, template, (result) => {
			if (result.action === 'save' && result.template) {
				void this.saveTemplate(result.template);
			} else if (result.action === 'delete' && result.template) {
				void this.deleteTemplate(result.template);
			}
		}).open();
	}

	/**
	 * Save a template (create new or update existing).
	 */
	private async saveTemplate(template: FlashcardTemplate): Promise<void> {
		const customTemplates = [...this.plugin.settings.customTemplates];
		const existingIndex = customTemplates.findIndex(t => t.id === template.id);

		if (existingIndex >= 0) {
			// Update existing
			customTemplates[existingIndex] = template;
		} else {
			// Add new
			customTemplates.push(template);
		}

		this.plugin.settings.customTemplates = customTemplates;
		this.plugin.settings.activeTemplateId = template.id;
		await this.plugin.saveSettings();
		new Notice(`Template "${template.name}" saved`);
		this.display();
	}

	/**
	 * Duplicate a template (creates an editable copy).
	 */
	private duplicateTemplate(template: FlashcardTemplate): void {
		const copy: FlashcardTemplate = {
			...template,
			id: `custom-${Date.now()}`,
			name: `${template.name} (Copy)`,
			isBuiltIn: false,
		};
		this.openTemplateModal('edit', copy);
	}

	/**
	 * Delete a custom template.
	 */
	private async deleteTemplate(template: FlashcardTemplate): Promise<void> {
		if (template.isBuiltIn) {
			new Notice('Cannot delete built-in templates');
			return;
		}

		this.plugin.settings.customTemplates = this.plugin.settings.customTemplates
			.filter(t => t.id !== template.id);

		// Switch to default template if we deleted the active one
		if (this.plugin.settings.activeTemplateId === template.id) {
			this.plugin.settings.activeTemplateId = 'basic-recall';
		}

		await this.plugin.saveSettings();
		new Notice(`Template "${template.name}" deleted`);
		this.display();
	}

	private renderGenerationSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Generation parameters").setHeading();

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('Higher values = more creative, lower = more deterministic (0.0-1.0)')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.temperature)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.temperature = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max output tokens')
			.setDesc('Maximum number of tokens in the response')
			.addSlider(slider => slider
				.setLimits(512, 4096, 256)
				.setValue(this.plugin.settings.maxTokens)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.maxTokens = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max input tokens')
			.setDesc('Maximum tokens per chunk for long documents. Lower = more chunks but safer for smaller models. (1000-8000)')
			.addSlider(slider => slider
				.setLimits(1000, 8000, 500)
				.setValue(this.plugin.settings.maxInputTokens)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.maxInputTokens = value;
					await this.plugin.saveSettings();
				}));

		// Help text for context limits
		containerEl.createEl('p', {
			text: 'Tip: If you get errors with long documents, try lowering "Max input tokens". Local models typically need 2000-3000, while cloud APIs can handle 4000-8000.',
			cls: 'setting-item-description',
		});
	}
}
