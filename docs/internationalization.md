# Internationalization Guide

This guide provides information about the internationalization features in our application, including how to use them, add new languages, and handle RTL support.

## Overview

Our application uses a comprehensive internationalization system that supports:
- Multiple languages
- Right-to-left (RTL) languages
- Customizable date, number, and currency formats
- User preferences for formatting
- Performance optimizations

## Supported Languages

Currently supported languages:
- English (en)
- French (fr)
- Spanish (es)
- German (de)
- Arabic (ar) - RTL
- Hebrew (he) - RTL
- Chinese (zh)
- Japanese (ja)

## Components

### I18nProvider

The main provider component that handles all internationalization features:

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

### LanguageSelector

A component for switching between languages:

```tsx
import { LanguageSelector } from '@/components/i18n/LanguageSelector';

// Default variant
<LanguageSelector />

// Minimal variant
<LanguageSelector variant="minimal" />

// Icon-only variant
<LanguageSelector variant="icon" />
```

### TestTranslator

A development tool for testing translations:

```tsx
import { TestTranslator } from '@/components/i18n/TestTranslator';

// Basic usage
<TestTranslator />

// With custom default values
<TestTranslator 
  defaultKey="dashboard.welcomeMessage" 
  defaultParams={{ name: "Jane" }}
/>
```

## Adding New Languages

1. Create a new translation file in `public/locales/[code]/translation.json`
2. Add the language to the `languages` array in `LanguageSelector.tsx`
3. Add the translation to the `resources` object in `I18nProvider.tsx`

Example:
```json
{
  "formats": {
    "title": "Format Settings",
    "description": "Customize how information is displayed"
  }
}
```

## RTL Support

The application automatically handles RTL languages. When a RTL language is selected:
- The document direction is set to `rtl`
- Margins and paddings are automatically flipped
- Text alignment is adjusted
- Flexbox directions are reversed

## Format Preferences

Users can customize how dates, numbers, and currencies are displayed:

### Date Formats
- Short (DD/MM/YYYY)
- Long (Day Month Year)
- Numeric (YYYY-MM-DD)

### Number Formats
- Standard (1,234.56)
- Compact (1.2K)
- Scientific (1.23e+3)

### Currency Formats
- Symbol (€1,234.56)
- Code (EUR 1,234.56)
- Name (1,234.56 Euros)

## Performance Optimizations

The internationalization system includes several performance optimizations:
- Formatter caching
- Memoized resources
- Preloaded translations
- Optimized context updates

## Testing

Run the internationalization tests:
```bash
npm test i18n
```

The tests cover:
- Language switching
- Format preferences
- RTL support
- User preferences
- Component rendering

## Best Practices

1. Always use translation keys instead of hardcoded strings
2. Use the `useI18n` hook to access internationalization features
3. Test your components with different languages and RTL support
4. Consider performance implications when adding new translations
5. Keep translation files organized and up to date

## Troubleshooting

Common issues and solutions:

1. Missing translations
   - Check if the translation key exists in all language files
   - Verify the translation file is properly imported

2. RTL layout issues
   - Ensure proper use of RTL-specific classes
   - Test with different content lengths

3. Performance issues
   - Check for unnecessary re-renders
   - Verify formatter caching is working
   - Monitor bundle size when adding new languages 