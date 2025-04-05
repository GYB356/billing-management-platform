import { i18nMonitor } from './monitoring';

// Define common and less common languages
const COMMON_LANGUAGES = ['en', 'fr', 'es', 'de'];
const LESS_COMMON_LANGUAGES = ['ar', 'he', 'zh', 'ja', 'ko', 'ru', 'pt', 'it', 'nl', 'pl'];

interface TranslationStats {
  language: string;
  usageCount: number;
  lastUsed: number;
}

class TranslationLoader {
  private static instance: TranslationLoader;
  private stats: Map<string, TranslationStats> = new Map();
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private readonly STORAGE_KEY = 'translation_stats';

  private constructor() {
    this.loadStats();
  }

  static getInstance(): TranslationLoader {
    if (!TranslationLoader.instance) {
      TranslationLoader.instance = new TranslationLoader();
    }
    return TranslationLoader.instance;
  }

  private loadStats(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.stats = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load translation stats:', error);
    }
  }

  private saveStats(): void {
    try {
      const serialized = Object.fromEntries(this.stats);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to save translation stats:', error);
    }
  }

  private updateStats(language: string): void {
    const now = Date.now();
    const currentStats = this.stats.get(language) || {
      language,
      usageCount: 0,
      lastUsed: now
    };

    this.stats.set(language, {
      ...currentStats,
      usageCount: currentStats.usageCount + 1,
      lastUsed: now
    });

    this.saveStats();
  }

  private async loadTranslation(language: string): Promise<void> {
    const startTime = performance.now();
    let cacheHit = false;

    try {
      // Check if translation is already loaded
      if (i18next.hasResourceBundle(language, 'translation')) {
        cacheHit = true;
        return;
      }

      // Load translation file
      const response = await fetch(`/locales/${language}/translation.json`);
      if (!response.ok) {
        throw new Error(`Failed to load translation for ${language}`);
      }

      const translations = await response.json();
      i18next.addResourceBundle(language, 'translation', translations, true, true);

      // Track performance metrics
      const loadTime = performance.now() - startTime;
      i18nMonitor.trackTranslationLoad(
        language,
        loadTime,
        cacheHit,
        JSON.stringify(translations).length
      );
    } catch (error) {
      console.error(`Failed to load translation for ${language}:`, error);
      throw error;
    }
  }

  async loadLanguage(language: string): Promise<void> {
    // Update usage statistics
    this.updateStats(language);

    // If it's a common language, load immediately
    if (COMMON_LANGUAGES.includes(language)) {
      return this.loadTranslation(language);
    }

    // For less common languages, check if we have a loading promise
    if (!this.loadingPromises.has(language)) {
      const promise = this.loadTranslation(language);
      this.loadingPromises.set(language, promise);

      // Clean up promise after completion or error
      promise.finally(() => {
        this.loadingPromises.delete(language);
      });
    }

    return this.loadingPromises.get(language);
  }

  preloadCommonLanguages(): void {
    COMMON_LANGUAGES.forEach(language => {
      if (!i18next.hasResourceBundle(language, 'translation')) {
        this.loadLanguage(language);
      }
    });
  }

  preloadBasedOnUsage(): void {
    // Sort languages by usage count and last used time
    const sortedLanguages = Array.from(this.stats.entries())
      .sort(([, a], [, b]) => {
        // Prioritize frequently used languages
        if (a.usageCount !== b.usageCount) {
          return b.usageCount - a.usageCount;
        }
        // Then prioritize recently used languages
        return b.lastUsed - a.lastUsed;
      })
      .map(([language]) => language);

    // Preload top 3 most used languages that aren't already loaded
    sortedLanguages
      .filter(lang => !i18next.hasResourceBundle(lang, 'translation'))
      .slice(0, 3)
      .forEach(language => {
        this.loadLanguage(language);
      });
  }

  getLanguageStats(): TranslationStats[] {
    return Array.from(this.stats.values());
  }

  clearStats(): void {
    this.stats.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const translationLoader = TranslationLoader.getInstance(); 