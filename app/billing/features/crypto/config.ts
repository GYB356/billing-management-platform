type CryptoCurrency = 'btc' | 'eth' | 'usdc';

export interface CryptoPaymentConfig {
  enabled: boolean;
  supportedCurrencies: CryptoCurrency[];
  processors: {
    stripe: {
      enabled: boolean;
      cryptoPaymentMethodTypes: string[];
    };
    bitpay: {
      enabled: boolean;
      apiKey: string | undefined;
      notificationURL: string;
      redirectURL: string;
    };
    wyre: {
      enabled: boolean;
      apiKey: string | undefined;
      secretKey: string | undefined;
      accountId: string | undefined;
    };
  };
}

export const defaultCryptoConfig: CryptoPaymentConfig = {
  enabled: true,
  supportedCurrencies: ['btc', 'eth', 'usdc'],
  processors: {
    stripe: {
      enabled: true,
      cryptoPaymentMethodTypes: ['crypto'],
    },
    bitpay: {
      enabled: false,
      apiKey: process.env.BITPAY_API_KEY,
      notificationURL: '/api/webhooks/bitpay',
      redirectURL: '/billing/payment/confirmation',
    },
    wyre: {
      enabled: false,
      apiKey: process.env.WYRE_API_KEY,
      secretKey: process.env.WYRE_SECRET_KEY,
      accountId: process.env.WYRE_ACCOUNT_ID,
    },
  },
};