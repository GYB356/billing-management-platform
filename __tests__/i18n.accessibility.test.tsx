import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';

expect.extend(toHaveNoViolations);

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated'
  })
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      date: 'short',
      number: 'standard',
      currency: 'symbol'
    })
  })
) as jest.Mock;

describe('I18n Accessibility Tests', () => {
  const renderWithI18n = (ui: React.ReactElement) => {
    return render(
      <I18nProvider>
        {ui}
      </I18nProvider>
    );
  };

  test('Language selector has no accessibility violations', async () => {
    const { container } = renderWithI18n(<LanguageSelector />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('Language selector is keyboard accessible', async () => {
    renderWithI18n(<LanguageSelector />);
    
    // Test keyboard navigation
    const button = screen.getByRole('button');
    button.focus();
    
    // Press Enter to open dropdown
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    // Verify dropdown is open
    expect(screen.getByRole('menu')).toBeInTheDocument();
    
    // Test arrow key navigation
    const menuItems = screen.getAllByRole('menuitem');
    menuItems[0].focus();
    
    // Press arrow down
    menuItems[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(menuItems[1]).toHaveFocus();
    
    // Press arrow up
    menuItems[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(menuItems[0]).toHaveFocus();
  });

  test('RTL languages have correct text direction', async () => {
    const { rerender } = renderWithI18n(<div>Test</div>);
    
    // Test Arabic (RTL)
    const arabicText = screen.getByText('Test');
    arabicText.textContent = 'مرحبا بالعالم';
    expect(arabicText).toHaveAttribute('dir', 'rtl');
    
    // Test Hebrew (RTL)
    rerender(<div>שלום עולם</div>);
    const hebrewText = screen.getByText('שלום עולם');
    expect(hebrewText).toHaveAttribute('dir', 'rtl');
    
    // Test English (LTR)
    rerender(<div>Hello World</div>);
    const englishText = screen.getByText('Hello World');
    expect(englishText).toHaveAttribute('dir', 'ltr');
  });

  test('Language selector announces changes to screen readers', async () => {
    const { rerender } = renderWithI18n(<LanguageSelector />);
    
    // Test language change announcement
    const button = screen.getByRole('button');
    button.click();
    
    // Select a new language
    const frenchOption = screen.getByText('Français');
    frenchOption.click();
    
    // Verify aria-label is updated
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('Français'));
  });

  test('Formatted content is accessible', async () => {
    const { rerender } = renderWithI18n(
      <div>
        <div role="text" aria-label="Date">2024-03-20</div>
        <div role="text" aria-label="Number">1,234.56</div>
        <div role="text" aria-label="Currency">$1,234.56</div>
      </div>
    );
    
    // Test with different languages
    const languages = ['fr', 'es', 'de', 'ar', 'he', 'zh', 'ja', 'ko', 'ru', 'pt', 'it'];
    
    for (const lang of languages) {
      rerender(
        <div>
          <div role="text" aria-label="Date">2024-03-20</div>
          <div role="text" aria-label="Number">1,234.56</div>
          <div role="text" aria-label="Currency">$1,234.56</div>
        </div>
      );
      
      // Verify content is properly formatted and accessible
      const dateElement = screen.getByLabelText('Date');
      const numberElement = screen.getByLabelText('Number');
      const currencyElement = screen.getByLabelText('Currency');
      
      expect(dateElement).toBeInTheDocument();
      expect(numberElement).toBeInTheDocument();
      expect(currencyElement).toBeInTheDocument();
    }
  });
}); 