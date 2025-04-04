import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { act } from 'react-dom/test-utils';

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

describe('I18n Performance Tests', () => {
  const renderWithI18n = (ui: React.ReactElement) => {
    return render(
      <I18nProvider>
        {ui}
      </I18nProvider>
    );
  };

  test('Language switching performance', async () => {
    const { rerender } = renderWithI18n(<LanguageSelector />);
    const startTime = performance.now();

    // Switch languages multiple times
    for (const lang of ['fr', 'es', 'de', 'ar', 'he', 'zh', 'ja', 'ko', 'ru', 'pt', 'it']) {
      await act(async () => {
        const button = screen.getByRole('button');
        button.click();
        const langOption = screen.getByText(new RegExp(lang, 'i'));
        langOption.click();
      });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Assert that language switching is performant
    expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
  });

  test('Formatter caching performance', async () => {
    const { rerender } = renderWithI18n(<div>Test</div>);
    
    // Test date formatting performance
    const date = new Date();
    const startTime = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      await act(async () => {
        rerender(<div>{date.toLocaleDateString()}</div>);
      });
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 1000;
    
    // Assert that formatting is performant
    expect(avgTime).toBeLessThan(0.1); // Should average less than 0.1ms per format
  });

  test('Translation loading performance', async () => {
    const startTime = performance.now();
    
    // Load all translations
    const translations = await Promise.all([
      import('../../../public/locales/en/translation.json'),
      import('../../../public/locales/fr/translation.json'),
      import('../../../public/locales/es/translation.json'),
      import('../../../public/locales/de/translation.json'),
      import('../../../public/locales/ar/translation.json'),
      import('../../../public/locales/he/translation.json'),
      import('../../../public/locales/zh/translation.json'),
      import('../../../public/locales/ja/translation.json'),
      import('../../../public/locales/ko/translation.json'),
      import('../../../public/locales/ru/translation.json'),
      import('../../../public/locales/pt/translation.json'),
      import('../../../public/locales/it/translation.json')
    ]);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Assert that translation loading is performant
    expect(totalTime).toBeLessThan(500); // Should load all translations within 500ms
  });

  test('Memory usage during language switching', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Switch languages multiple times
    const { rerender } = renderWithI18n(<LanguageSelector />);
    
    for (let i = 0; i < 100; i++) {
      await act(async () => {
        const button = screen.getByRole('button');
        button.click();
        const langOption = screen.getByText(/English/i);
        langOption.click();
      });
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Assert that memory usage is reasonable
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
  });
}); 