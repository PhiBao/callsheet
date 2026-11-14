export {};

declare global {
  interface Window {
    LanguageModel?: {
      availability(): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
      create(options?: {
        initialPrompts?: Array<{ role: string; content: string }>;
        expectedInputs?: Array<{ type: string; languages: string[] }>;
        expectedOutputs?: Array<{ type: string; languages: string[] }>;
      }): Promise<{
        prompt(
          text: string,
          options?: { responseConstraint?: unknown; signal?: AbortSignal },
        ): Promise<string>;
        destroy?(): void;
      }>;
    };
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean;
  }
}
