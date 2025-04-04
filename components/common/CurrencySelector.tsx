import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CurrencyDollarIcon, CheckIcon } from '@heroicons/react/outline';
import { Menu, Transition } from '@headlessui/react';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useCustomer } from '@/hooks/useCustomer';
import { updateCustomerCurrency } from '@/services/customerService';

interface CurrencySelectorProps {
  variant?: 'dropdown' | 'buttons';
  size?: 'small' | 'medium' | 'large';
  onChange?: (currencyCode: string) => void;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  variant = 'dropdown',
  size = 'medium',
  onChange,
}) => {
  const router = useRouter();
  const { currencies, isLoading: currenciesLoading } = useCurrencies();
  const { customer, isLoading: customerLoading, mutate: mutateCustomer } = useCustomer();
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  // Set initial selected currency
  useEffect(() => {
    if (!currenciesLoading && !customerLoading && currencies && currencies.length > 0) {
      if (customer?.preferredCurrency) {
        setSelectedCurrency(customer.preferredCurrency);
      } else {
        const defaultCurrency = currencies.find(currency => currency.isDefault);
        if (defaultCurrency) {
          setSelectedCurrency(defaultCurrency.code);
        } else if (currencies.length > 0) {
          setSelectedCurrency(currencies[0].code);
        }
      }
    }
  }, [currencies, currenciesLoading, customer, customerLoading]);

  // Handle currency change
  const handleCurrencyChange = async (currencyCode: string) => {
    if (isChanging || currencyCode === selectedCurrency) return;

    setIsChanging(true);

    try {
      if (customer?.id) {
        await updateCustomerCurrency(customer.id, currencyCode);
        mutateCustomer();
      }

      setSelectedCurrency(currencyCode);

      if (onChange) {
        onChange(currencyCode);
      } else {
        router.reload();
      }
    } catch (error) {
      console.error('Error changing currency:', error);
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

  // Get currency display
  const getCurrencyDisplay = (code: string) => {
    const currency = currencies?.find(c => c.code === code);
    if (!currency) return code;
    return `${currency.symbol} ${currency.code}`;
  };

  if (currenciesLoading || !currencies || currencies.length <= 1) {
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
            <CurrencyDollarIcon className="h-5 w-5 mr-2 text-gray-400" aria-hidden="true" />
            {selectedCurrency ? getCurrencyDisplay(selectedCurrency) : 'Select currency'}
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
              {currencies.map((currency) => (
                <Menu.Item key={currency.code}>
                  {({ active }) => (
                    <button
                      onClick={() => handleCurrencyChange(currency.code)}
                      className={`${
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                      } group flex items-center w-full px-4 py-2 ${getSizeClasses()}`}
                    >
                      {selectedCurrency === currency.code && (
                        <CheckIcon className="h-5 w-5 mr-2 text-indigo-600" aria-hidden="true" />
                      )}
                      {!selectedCurrency === currency.code && <span className="h-5 w-5 mr-2" />}
                      {currency.symbol} {currency.code} - {currency.name}
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
      {currencies.map((currency) => (
        <button
          key={currency.code}
          onClick={() => handleCurrencyChange(currency.code)}
          className={`inline-flex items-center px-3 py-1.5 border ${
            selectedCurrency === currency.code
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          } rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${getSizeClasses()}`}
          disabled={isChanging}
        >
          {currency.symbol} {currency.code}
        </button>
      ))}
    </div>
  );
};

export default CurrencySelector;