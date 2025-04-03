# Internationalization Tutorial

## Overview
This tutorial will guide you through the internationalization features of our application, including language switching, RTL support, and format preferences.

## Table of Contents
1. [Basic Usage](#basic-usage)
2. [Language Switching](#language-switching)
3. [RTL Support](#rtl-support)
4. [Format Preferences](#format-preferences)
5. [Performance Optimization](#performance-optimization)
6. [Accessibility](#accessibility)

## Basic Usage

### Setting Up I18nProvider
```tsx
import { I18nProvider } from '@/components/i18n/I18nProvider';

export default function RootLayout({ children }) {
  return (
    <I18nProvider>
      {children}
    </I18nProvider>
  );
}
```

### Using Translations
```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('formats.title')}</h1>
    </div>
  );
}
```

## Language Switching

### Using LanguageSelector
```tsx
import { LanguageSelector } from '@/components/i18n/LanguageSelector';

function Header() {
  return (
    <header>
      <LanguageSelector variant="default" />
    </header>
  );
}
```

### Available Variants
- `default`: Full language name with icon
- `minimal`: Language code with icon
- `icon`: Only globe icon

## RTL Support

### Automatic RTL Detection
The application automatically handles RTL languages (Arabic and Hebrew):
```tsx
function MyComponent() {
  const { dir } = useI18n();
  
  return (
    <div dir={dir}>
      {/* Content will automatically flow RTL or LTR */}
    </div>
  );
}
```

### RTL-Specific Styles
```css
/* RTL-specific styles are automatically applied */
.rtl {
  text-align: right;
  direction: rtl;
}
```

## Format Preferences

### Date Formatting
```tsx
function DateDisplay() {
  const { formatDate } = useI18n();
  
  return (
    <div>
      {formatDate(new Date())}
    </div>
  );
}
```

### Number Formatting
```tsx
function NumberDisplay() {
  const { formatNumber } = useI18n();
  
  return (
    <div>
      {formatNumber(1234.56)}
    </div>
  );
}
```

### Currency Formatting
```tsx
function CurrencyDisplay() {
  const { formatCurrency } = useI18n();
  
  return (
    <div>
      {formatCurrency(1234.56, 'USD')}
    </div>
  );
}
```

## Performance Optimization

### Lazy Loading
Less common languages are loaded on demand:
```tsx
// Common languages are preloaded
const COMMON_LANGUAGES = ['en', 'fr', 'es', 'de'];

// Less common languages are lazy loaded
const LAZY_LOADED_LANGUAGES = ['ar', 'he', 'zh', 'ja', 'ko', 'ru', 'pt', 'it'];
```

### Formatter Caching
Formatters are cached for better performance:
```tsx
const formatterCache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
```

## Accessibility

### Keyboard Navigation
The language selector supports full keyboard navigation:
- Tab to focus
- Enter to open
- Arrow keys to navigate
- Escape to close

### Screen Reader Support
```tsx
<button
  aria-label={`Select language: ${currentLanguage.name}`}
  role="combobox"
  aria-expanded={isOpen}
  aria-controls="language-menu"
>
  {/* Button content */}
</button>
```

### RTL Announcements
Screen readers automatically announce text direction changes:
```tsx
<div dir={dir} lang={language}>
  {/* Content */}
</div>
```

## Best Practices

1. **Translation Keys**
   - Use nested keys for organization
   - Keep keys consistent across languages
   - Use interpolation for dynamic content

2. **Performance**
   - Use lazy loading for less common languages
   - Cache formatters
   - Preload common translations

3. **Accessibility**
   - Always provide aria-labels
   - Support keyboard navigation
   - Test with screen readers

4. **RTL Support**
   - Use logical properties (start/end)
   - Test with RTL languages
   - Consider bidirectional text

## Troubleshooting

### Common Issues

1. **Missing Translations**
   ```tsx
   // Check if translation exists
   if (t('key', { returnObjects: true }) === 'key') {
     console.warn('Missing translation for key');
   }
   ```

2. **RTL Layout Issues**
   ```css
   /* Use logical properties */
   .element {
     margin-inline-start: 1rem;
     padding-inline-end: 1rem;
   }
   ```

3. **Performance Issues**
   ```tsx
   // Use memoization for expensive operations
   const formattedDate = useMemo(() => 
     formatDate(date), 
     [date, formatDate]
   );
   ```

## Video Tutorials

1. [Basic Setup and Usage](https://example.com/i18n-basic)
2. [RTL Support and Layout](https://example.com/i18n-rtl)
3. [Performance Optimization](https://example.com/i18n-performance)
4. [Accessibility Features](https://example.com/i18n-accessibility)

## Additional Resources

- [i18next Documentation](https://www.i18next.com/)
- [RTL Styling Guide](https://rtlstyling.com/)
- [Accessibility Guidelines](https://www.w3.org/WAI/)
- [Performance Best Practices](https://web.dev/performance/) 