'use client';

import { TestTranslator } from '@/components/i18n/TestTranslator';
import Link from 'next/link';

export default function TranslateDevelopmentPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Translation Testing Tool</h1>
        <p className="text-gray-600">
          This tool is designed for developers to test translations during development.
          You can use it to see how different translation keys render in various languages.
        </p>
        <div className="mt-4">
          <Link 
            href="/docs/internationalization" 
            className="text-blue-600 hover:underline"
          >
            View Internationalization Documentation
          </Link>
        </div>
      </div>

      <TestTranslator 
        defaultKey="common.save" 
        defaultParams={{ count: 5, name: "John" }}
      />
      
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">How to Use This Tool</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Enter a translation key in the <strong>Translation Key</strong> field
            (e.g., <code>invoice.total</code> or <code>settings.language.title</code>).
          </li>
          <li>
            Add parameters if needed, one per line in the format <code>key:value</code>.
            For example:
            <pre className="bg-gray-100 p-2 rounded mt-1 text-sm">
              name:John Doe
              count:5
            </pre>
          </li>
          <li>
            Switch between languages using the language selector to see how
            the translation renders in different locales.
          </li>
          <li>
            Check the date, number, and currency formatting examples to see
            how these are formatted based on the selected locale.
          </li>
        </ol>
        
        <div className="mt-6 pt-4 border-t border-gray-300">
          <h3 className="font-medium mb-2">Using the TestTranslator Component</h3>
          <p className="mb-3">
            You can also use the <code>TestTranslator</code> component in your own
            development pages or components:
          </p>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
{`import { TestTranslator } from '@/components/i18n/TestTranslator';

// Basic usage
<TestTranslator />

// With custom default values
<TestTranslator 
  defaultKey="dashboard.welcomeMessage" 
  defaultParams={{ 
    name: "Jane", 
    count: 3 
  }}
/>

// Customize which formatters to show
<TestTranslator 
  showDateFormatting={true}
  showNumberFormatting={false}
  showCurrencyFormatting={true}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
}