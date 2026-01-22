import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Disable lint-staged ban for package.json (we intentionally use lint-staged)
		files: ['package.json'],
		rules: {
			'depend/ban-dependencies': 'off',
		},
	},
	{
		// Disable sentence-case rule for settings UI (requires proper nouns like "OpenAI", "API", etc.)
		files: ['src/settings.ts', 'src/ui/**/*.ts'],
		rules: {
			'obsidianmd/ui/sentence-case': 'off',
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
