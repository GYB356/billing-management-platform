import { useSession } from 'next-auth/react';
import { NextPage } from 'next';
import Head from 'next/head';
import TwoFactorSettings from '../../components/auth/TwoFactorSettings';

const SecuritySettingsPage: NextPage = () => {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Please sign in to access security settings.</div>;
  }

  return (
    <>
      <Head>
        <title>Security Settings - Your App Name</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Security Settings</h1>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>
            <TwoFactorSettings />
          </section>

          {/* Add other security settings sections here */}
        </div>
      </div>
    </>
  );
};

export default SecuritySettingsPage; 