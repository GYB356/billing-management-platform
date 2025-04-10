'use client';

import { ReactNode } from 'react';
import { useI18n } from './I18nProvider';

const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur'];

export function RTLProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const isRTL = RTL_LANGUAGES.includes(locale);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  );
}
