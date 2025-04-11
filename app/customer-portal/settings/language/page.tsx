'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function LanguageSettingsPage() {
  const { locale, setLocale, availableLocales, t } = useI18n();
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { data: session } = useSession();
  
  const handleSave = async () => {
    if (!session?.user?.id) return;
    
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      // Update language preference
      await fetch('/api/user/preferences/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: selectedLocale }),
      });
      
      // Update the application's locale
      setLocale(selectedLocale);
      setSaveSuccess(true);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{t('settings.language.title')}</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600 mb-6">{t('settings.language.description')}</p>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('settings.language.selectLabel')}
          </label>
          
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {availableLocales.map(loc => (
              <div 
                key={loc.code}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-colors
                  ${selectedLocale === loc.code 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'}
                `}
                onClick={() => setSelectedLocale(loc.code)}
              >
                <div className="font-medium">{loc.nativeName}</div>
                <div className="text-sm text-gray-500">{loc.name}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Button onClick={handleSave} disabled={isSaving || selectedLocale === locale}>
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
          
          {saveSuccess && (
            <p className="text-green-600 text-sm">{t('settings.language.saveSuccess')}</p>
          )}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {t('settings.language.examples')}
          </h3>
          
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-gray-500 mr-2">{t('settings.language.dateExample')}:</span>
              {new Date().toLocaleDateString(locale)}
            </p>
            <p>
              <span className="text-gray-500 mr-2">{t('settings.language.currencyExample')}:</span>
              {new Intl.NumberFormat(locale, { 
                style: 'currency', 
                currency: 'USD',
              }).format(1234.56)}
            </p>
            <p>
              <span className="text-gray-500 mr-2">{t('settings.language.numberExample')}:</span>
              {new Intl.NumberFormat(locale).format(1234567.89)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 