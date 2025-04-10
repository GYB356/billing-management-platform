import React from 'react';
import TwoFactorSetup from '@/components/auth/TwoFactorSetup';

const SettingsPage = () => {
  return (
    <div>
      <h1>Account Settings</h1>
      <TwoFactorSetup />
    </div>
  );
};

export default SettingsPage;