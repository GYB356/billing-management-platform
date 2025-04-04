'use client';

import { ReactNode } from 'react';
import { useI18n } from './I18nProvider';

// List of RTL languages
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

export function RTLProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const isRTL = RTL_LANGUAGES.includes(locale);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  );
}