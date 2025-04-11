'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, CreditCard, DollarSign, Users } from 'lucide-react';

export function MultilingualExample() {
  const { t, formatDate, formatCurrency, formatNumber, locale } = useI18n();
  const [currentTab, setCurrentTab] = useState('text');
  
  // Example data
  const today = new Date();
  const amount = 1234.56;
  const users = 42689;
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{t('examples.i18n.title')}</CardTitle>
            <CardDescription>{t('examples.i18n.description')}</CardDescription>
          </div>
          <LanguageSelector variant="minimal" />
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="text">
              <Users className="h-4 w-4 mr-2" />
              {t('examples.i18n.tabs.text')}
            </TabsTrigger>
            <TabsTrigger value="dates">
              <CalendarDays className="h-4 w-4 mr-2" />
              {t('examples.i18n.tabs.dates')}
            </TabsTrigger>
            <TabsTrigger value="numbers">
              <CreditCard className="h-4 w-4 mr-2" />
              {t('examples.i18n.tabs.numbers')}
            </TabsTrigger>
            <TabsTrigger value="currency">
              <DollarSign className="h-4 w-4 mr-2" />
              {t('examples.i18n.tabs.currency')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="text" className="space-y-4">
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.simpleText')}</h3>
                <p>{t('examples.i18n.welcomeMessage')}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.variableText')}</h3>
                <p>
                  {t('examples.i18n.greeting', { name: 'John Doe' })}
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.pluralization')}</h3>
                <p>
                  {t('examples.i18n.itemCount', { count: 0 })}
                </p>
                <p>
                  {t('examples.i18n.itemCount', { count: 1 })}
                </p>
                <p>
                  {t('examples.i18n.itemCount', { count: 5 })}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="dates" className="space-y-4">
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.shortDate')}</h3>
                <p>{formatDate(today, 'short')}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.longDate')}</h3>
                <p>{formatDate(today, 'long')}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.fullDateTime')}</h3>
                <p>{formatDate(today, 'full')}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.relativeDates')}</h3>
                <p>
                  {t('examples.i18n.createdAgo', { 
                    time: formatDate(new Date(today.getTime() - 3600000), 'relative')
                  })}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="numbers" className="space-y-4">
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.decimal')}</h3>
                <p>{formatNumber(1234.5678)}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.percentage')}</h3>
                <p>{formatNumber(0.4567, 'percent')}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.largeNumber')}</h3>
                <p>
                  {t('examples.i18n.userCount', { count: formatNumber(users) })}
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="currency" className="space-y-4">
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.localCurrency')}</h3>
                <p>{formatCurrency(amount)}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.specificCurrency')}</h3>
                <div className="space-y-2">
                  <p>USD: {formatCurrency(amount, 'USD')}</p>
                  <p>EUR: {formatCurrency(amount, 'EUR')}</p>
                  <p>GBP: {formatCurrency(amount, 'GBP')}</p>
                  <p>JPY: {formatCurrency(amount, 'JPY')}</p>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{t('examples.i18n.billing')}</h3>
                <p>
                  {t('examples.i18n.subscriptionCost', { 
                    cost: formatCurrency(19.99),
                    interval: t('examples.i18n.monthly')
                  })}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          {t('examples.i18n.currentLocale')}: <strong>{locale}</strong>
        </p>
        <Button onClick={() => setCurrentTab('text')}>
          {t('examples.i18n.reset')}
        </Button>
      </CardFooter>
    </Card>
  );
} 