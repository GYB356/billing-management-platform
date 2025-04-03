import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { TestTranslator } from '@/components/i18n/TestTranslator';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated'
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('I18nProvider', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        date: 'short',
        number: 'standard',
        currency: 'symbol'
      })
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default language', () => {
    render(
      <I18nProvider>
        <div>Test Content</div>
      </I18nProvider>
    );
    expect(document.documentElement.lang).toBe('en');
  });

  it('changes language when setLanguage is called', () => {
    render(
      <I18nProvider>
        <LanguageSelector />
      </I18nProvider>
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    const frenchOption = screen.getByText('Français');
    fireEvent.click(frenchOption);

    expect(document.documentElement.lang).toBe('fr');
  });

  it('formats date according to preferences', () => {
    render(
      <I18nProvider>
        <TestTranslator />
      </I18nProvider>
    );

    const dateFormat = screen.getByLabelText('Date Format');
    fireEvent.click(dateFormat);

    const longFormat = screen.getByText('Long');
    fireEvent.click(longFormat);

    const dateDisplay = screen.getByText(/Long:/);
    expect(dateDisplay).toBeInTheDocument();
  });

  it('formats number according to preferences', () => {
    render(
      <I18nProvider>
        <TestTranslator />
      </I18nProvider>
    );

    const numberFormat = screen.getByLabelText('Number Format');
    fireEvent.click(numberFormat);

    const compactFormat = screen.getByText('Compact');
    fireEvent.click(compactFormat);

    const numberDisplay = screen.getByText(/Compact:/);
    expect(numberDisplay).toBeInTheDocument();
  });

  it('formats currency according to preferences', () => {
    render(
      <I18nProvider>
        <TestTranslator />
      </I18nProvider>
    );

    const currencyFormat = screen.getByLabelText('Currency Format');
    fireEvent.click(currencyFormat);

    const codeFormat = screen.getByText('Code');
    fireEvent.click(codeFormat);

    const currencyDisplay = screen.getByText(/Code:/);
    expect(currencyDisplay).toBeInTheDocument();
  });

  it('handles RTL languages correctly', () => {
    render(
      <I18nProvider>
        <LanguageSelector />
      </I18nProvider>
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    const arabicOption = screen.getByText('العربية');
    fireEvent.click(arabicOption);

    expect(document.documentElement.dir).toBe('rtl');
  });

  it('fetches and applies user preferences', async () => {
    const mockPreferences = {
      date: 'long',
      number: 'compact',
      currency: 'code'
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences)
    });

    render(
      <I18nProvider>
        <TestTranslator />
      </I18nProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const dateDisplay = screen.getByText(/Long:/);
    expect(dateDisplay).toBeInTheDocument();
  });
}); 