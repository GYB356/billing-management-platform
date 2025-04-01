import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="bg-white">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center">
            <div className="text-indigo-600 font-bold text-2xl">BillingPro</div>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/features" className="text-base text-gray-500 hover:text-gray-900">
              Features
            </Link>
            <Link href="/pricing" className="text-base text-gray-500 hover:text-gray-900">
              Pricing
            </Link>
            <Link href="/about" className="text-base text-gray-500 hover:text-gray-900">
              About
            </Link>
            <Link href="/contact" className="text-base text-gray-500 hover:text-gray-900">
              Contact
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/auth/signin" 
              className="text-base font-medium text-gray-500 hover:text-gray-900"
            >
              Sign in
            </Link>
            <Link 
              href="/auth/signup" 
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>
      {/* ...existing code... */}
    </div>
  );
}