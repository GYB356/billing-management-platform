import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { RegionSelector } from '@/components/i18n/RegionSelector';
import { TranslationProgress } from '@/components/i18n/TranslationProgress';
import { LanguageTour } from '@/components/i18n/LanguageTour';
import { LanguageStatus } from '@/components/i18n/LanguageStatus';
import { TranslationManager } from '@/components/i18n/TranslationManager';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated'
  })
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('I18n Integration Tests', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.clear.mockClear();
  });

  it('should handle language switching with region selection', async () => {
    render(
      <I18nProvider>
        <div>
          <LanguageSelector />
          <RegionSelector />
        </div>
      </I18nProvider>
    );

    // Open language selector
    const langButton = screen.getByRole('button');
    fireEvent.click(langButton);

    // Select French
    const frenchOption = screen.getByText('Français');
    fireEvent.click(frenchOption);

    // Wait for region selector to appear
    await waitFor(() => {
      expect(screen.getByText('Select Region')).toBeInTheDocument();
    });

    // Select a region
    const regionButton = screen.getByText('Select Region');
    fireEvent.click(regionButton);
    const franceOption = screen.getByText('France');
    fireEvent.click(franceOption);

    // Verify region was selected
    expect(screen.getByText('France')).toBeInTheDocument();
  });

  it('should show translation progress when switching languages', async () => {
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

    // Verify progress indicator appears
    expect(screen.getByText('Loading translations...')).toBeInTheDocument();
    
    // Wait for progress to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading translations...')).not.toBeInTheDocument();
    });
  });

  it('should show language tour for first-time visitors', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    render(
      <I18nProvider>
        <LanguageTour />
      </I18nProvider>
    );

    // Verify tour content
    expect(screen.getByText('Click here to change your language preferences')).toBeInTheDocument();
    
    // Skip tour
    const skipButton = screen.getByText('Skip Tour');
    fireEvent.click(skipButton);

    // Verify tour is hidden and preference is saved
    expect(screen.queryByText('Click here to change your language preferences')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('has-seen-language-tour', 'true');
  });

  it('should display language status dashboard', async () => {
    render(
      <I18nProvider>
        <LanguageStatus />
      </I18nProvider>
    );

    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('French')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    // Verify stats are displayed
    expect(screen.getByText('Translation Progress')).toBeInTheDocument();
    expect(screen.getByText('Total Keys:')).toBeInTheDocument();
    expect(screen.getByText('Translated:')).toBeInTheDocument();
  });

  it('should allow translation management', async () => {
    render(
      <I18nProvider>
        <TranslationManager />
      </I18nProvider>
    );

    // Wait for translations to load
    await waitFor(() => {
      expect(screen.getByText('Translation Manager')).toBeInTheDocument();
    });

    // Search for a translation
    const searchInput = screen.getByPlaceholderText('Search translations...');
    fireEvent.change(searchInput, { target: { value: 'settings' } });

    // Filter by status
    const missingButton = screen.getByText('Missing');
    fireEvent.click(missingButton);

    // Edit a translation
    const editButton = screen.getAllByRole('button').find(button => 
      button.querySelector('svg[data-icon="save"]')
    );
    if (editButton) {
      fireEvent.click(editButton);
      
      // Enter new translation
      const translationInput = screen.getByRole('textbox');
      fireEvent.change(translationInput, { target: { value: 'New translation' } });
      
      // Save translation
      const saveButton = screen.getByRole('button', { name: /check/i });
      fireEvent.click(saveButton);

      // Verify translation was updated
      expect(screen.getByText('New translation')).toBeInTheDocument();
    }
  });
}); 