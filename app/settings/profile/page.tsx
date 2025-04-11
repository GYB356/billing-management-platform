'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { Separator } from '@/components/ui/separator';

export default function SettingsProfilePage() {
  const { t } = useI18n();
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('settings.profile.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.profile.description')}
        </p>
      </div>
      <Separator />
      
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t('settings.profile.language')}</h4>
          <p className="text-sm text-muted-foreground">
            {t('settings.profile.languageDescription')}
          </p>
        </div>
        <LanguageSelector />
      </div>
      
      <Separator />
    </div>
  );
} 