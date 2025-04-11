import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { TranslationProgress } from '@/components/i18n/TranslationProgress';
import { i18nMonitor } from '@/utils/i18n/monitoring';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated'
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('I18n Edge Cases and Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    i18nMonitor.clearMetrics();
  });

  it('should handle network errors when loading translations', async () => {
    // Mock fetch to simulate network error
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <I18nProvider>
        <div>
          <LanguageSelector />
          <TranslationProgress />
        </div>
      </I18nProvider>
    );

    // Switch to Japanese
    const langButton = screen.getByRole('button');
    fireEvent.click(langButton);
    const japaneseOption = screen.getByText('日本語');
    fireEvent.click(japaneseOption);

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText('Failed to load translations')).toBeInTheDocument();
    });
  });

  it('should handle malformed translation files', async () => {
    // Mock fetch to return invalid JSON
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON'))
    });

    render(
      <I18nProvider>
        <div>
          <LanguageSelector />
          <TranslationProgress />
        </div>
      </I18nProvider>
    );

    // Switch to French
    const langButton = screen.getByRole('button');
    fireEvent.click(langButton);
    const frenchOption = screen.getByText('Français');
    fireEvent.click(frenchOption);

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText('Invalid translation file')).toBeInTheDocument();
    });
  });

  it('should handle missing translation keys gracefully', async () => {
    // Mock fetch to return incomplete translations
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        common: {
          // Missing some required keys
          save: 'Save',
          cancel: 'Cancel'
        }
      })
    });

    render(
      <I18nProvider>
        <div>
          <LanguageSelector />
          <TranslationProgress />
        </div>
      </I18nProvider>
    );

    // Switch to Spanish
    const langButton = screen.getByRole('button');
    fireEvent.click(langButton);
    const spanishOption = screen.getByText('Español');
    fireEvent.click(spanishOption);

    // Verify fallback behavior
    await waitFor(() => {
      expect(screen.getByText('Missing translation')).toBeInTheDocument();
    });
  });

  it('should handle concurrent language switches', async () => {
    render(
      <I18nProvider>
        <div>
          <LanguageSelector />
          <TranslationProgress />
        </div>
      </I18nProvider>
    );

    // Start switching to multiple languages quickly
    const langButton = screen.getByRole('button');
    
    // Switch to French
    fireEvent.click(langButton);
    const frenchOption = screen.getByText('Français');
    fireEvent.click(frenchOption);

    // Immediately switch to Japanese
    fireEvent.click(langButton);
    const japaneseOption = screen.getByText('日本語');
    fireEvent.click(japaneseOption);

    // Verify only the last language is applied
    await waitFor(() => {
      expect(screen.getByText('日本語')).toBeInTheDocument();
      expect(screen.queryByText('Français')).not.toBeInTheDocument();
    });
  });

  it('should handle storage quota exceeded', async () => {
    // Mock localStorage to simulate quota exceeded
    const mockSetItem = jest.spyOn(Storage.prototype, 'setItem');
    mockSetItem.mockImplementationOnce(() => {
      throw new Error('Quota exceeded');
    });

    render(
      <I18nProvider>
        <div>
          <LanguageSelector />
          <TranslationProgress />
        </div>
      </I18nProvider>
    );

    // Switch to German
    const langButton = screen.getByRole('button');
    fireEvent.click(langButton);
    const germanOption = screen.getByText('Deutsch');
    fireEvent.click(germanOption);

    // Verify error handling
    await waitFor(() => {
      expect(screen.getByText('Storage quota exceeded')).toBeInTheDocument();
    });

    mockSetItem.mockRestore();
  });

  it('should handle RTL language switching', async () => {
    render(
      <I18nProvider>
        <div>
          <LanguageSelector />
          <TranslationProgress />
        </div>
      </I18nProvider>
    );

    // Switch to Arabic
    const langButton = screen.getByRole('button');
    fireEvent.click(langButton);
    const arabicOption = screen.getByText('العربية');
    fireEvent.click(arabicOption);

    // Verify RTL changes
    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar');
    });

    // Switch back to LTR
    fireEvent.click(langButton);
    const englishOption = screen.getByText('English');
    fireEvent.click(englishOption);

    // Verify LTR changes
    await waitFor(() => {
      expect(document.documentElement.dir).toBe('ltr');
      expect(document.documentElement.lang).toBe('en');
    });
  });
}); 