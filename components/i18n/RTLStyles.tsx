'use client';

import { useI18n } from './I18nProvider';

const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur'];

export function RTLStyles() {
  const { locale } = useI18n();
  const isRTL = RTL_LANGUAGES.includes(locale);

  if (!isRTL) return null;

  return (
    <style jsx global>{`
      body {
        direction: rtl;
        text-align: right;
      }
    `}</style>
  );
}
