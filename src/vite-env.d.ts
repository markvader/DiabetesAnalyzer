/// <reference types="vite/client" />

declare global {
	interface Window {
		VITE_OPENAI_API_KEY?: string;
		VITE_GEMINI_API_KEY?: string;
		VITE_DEEPSEEK_API_KEY?: string;
		VITE_ANTHROPIC_API_KEY?: string;
	}
}

export {};
