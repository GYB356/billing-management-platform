import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { GlobeAltIcon, CheckIcon } from '@heroicons/react/outline';
import { Menu, Transition } from '@headlessui/react';
import { useLocales } from '@/hooks/useLocales';
import { useCustomer } from '@/hooks/useCustomer';
import { updateCustomerLocale } from '@/services/localizationService';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'buttons';
  size?: 'small' | 'medium' | 'large';
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  size = 'medium',
}) => {
  const router = useRouter();
  const { locales, isLoading: localesLoading } = useLocales();
  const { customer, isLoading: customerLoading, mutate: mutateCustomer } = useCustomer();
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  // Set initial selected locale
  useEffect(() => {
    if (!localesLoading && !customerLoading && locales && locales.length > 0) {
      if (customer?.preferredLocale) {
        setSelectedLocale(customer.preferredLocale);
      } else if (typeof navigator !== 'undefined') {
        const browserLocale = navigator.language;
        const matchingLocale = locales.find(locale => 
          locale.code === browserLocale || locale.code.split('-')[0] === browserLocale.split('-')[0]
        );

        if (matchingLocale) {
          setSelectedLocale(matchingLocale.code);
        } else {
          const defaultLocale = locales.find(locale => locale.isDefault);
          if (defaultLocale) {
            setSelectedLocale(defaultLocale.code);
          } else if (locales.length > 0) {
            setSelectedLocale(locales[0].code);
          }
        }
      }
    }
  }, [locales, localesLoading, customer, customerLoading]);

  // Handle locale change
  const handleLocaleChange = async (localeCode: string) => {
    if (isChanging || localeCode === selectedLocale) return;

    setIsChanging(true);

    try {
      if (customer?.id) {
        await updateCustomerLocale(customer.id, localeCode);
        mutateCustomer();
      }

      setSelectedLocale(localeCode);
      router.reload();
    } catch (error) {
      console.error('Error changing locale:', error);
    } finally {
      setIsChanging(false);
    }
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'text-xs';
      case 'large':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  if (localesLoading || !locales || locales.length <= 1) {
    return null;
  }

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button
            className={`inline-flex items-center justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${getSizeClasses()}`}
            disabled={isChanging}
          >
            <GlobeAltIcon className="h-5 w-5 mr-2 text-gray-400" aria-hidden="true" />
            {selectedLocale ? locales.find(l => l.code === selectedLocale)?.name : 'Select language'}
          </Menu.Button>
        </div>

        <Transition
          as={React.Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
            <div className="py-1">
              {locales.map((locale) => (
                <Menu.Item key={locale.code}>
                  {({ active }) => (
                    <button
                      onClick={() => handleLocaleChange(locale.code)}
                      className={`${
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                      } group flex items-center w-full px-4 py-2 ${getSizeClasses()}`}
                    >
                      {selectedLocale === locale.code && (
                        <CheckIcon className="h-5 w-5 mr-2 text-indigo-600" aria-hidden="true" />
                      )}
                      {!selectedLocale === locale.code && <span className="h-5 w-5 mr-2" />}
                      {locale.name}
                    </button>
                  )}
                </Menu.Item>
              ))}
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
    );
  }

  // Buttons variant
  return (
    <div className="flex space-x-2">
      {locales.map((locale) => (
        <button
          key={locale.code}
          onClick={() => handleLocaleChange(locale.code)}
          className={`inline-flex items-center px-3 py-1.5 border ${
            selectedLocale === locale.code
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          } rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${getSizeClasses()}`}
          disabled={isChanging}
        >
          {selectedLocale === locale.code && <CheckIcon className="h-4 w-4 mr-1" />}
          {locale.name.split(' ')[0]}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;