'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ReferralData {
  referralCode: string;
  referralCount: number;
  referralRewards: number;
  referrals: Array<{
    name: string | null;
    email: string;
    subscription_status: string | null;
  }>;
}

export function ReferralSection() {
  const { data: session } = useSession();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');

  useEffect(() => {
    fetchReferralData();
  }, []);

  useEffect(() => {
    if (referralData?.referralCode) {
      setShareLink(`${window.location.origin}/r/${referralData.referralCode}`);
    }
  }, [referralData?.referralCode]);

  const fetchReferralData = async () => {
    try {
      const response = await fetch('/api/referral');
      if (!response.ok) {
        throw new Error('Failed to fetch referral data');
      }
      const data = await response.json();
      setReferralData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (!referralData?.referralCode) return;

    try {
      await navigator.clipboard.writeText(referralData.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy referral code');
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy share link');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Referral Program</h2>
      
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Your Referral Code</h3>
        <div className="flex items-center space-x-2">
          <code className="bg-gray-100 px-3 py-2 rounded-md text-sm font-mono">
            {referralData?.referralCode}
          </code>
          <button
            onClick={copyReferralCode}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Share Your Link</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={shareLink}
            className="flex-1 bg-gray-100 px-3 py-2 rounded-md text-sm font-mono"
          />
          <button
            onClick={copyShareLink}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-500">Total Referrals</h3>
          <p className="text-2xl font-semibold">{referralData?.referralCount || 0}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-500">Rewards Earned</h3>
          <p className="text-2xl font-semibold">{referralData?.referralRewards || 0}</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Your Referrals</h3>
        {referralData?.referrals.length === 0 ? (
          <p className="text-gray-500">No referrals yet</p>
        ) : (
          <div className="space-y-2">
            {referralData?.referrals.map((referral) => (
              <div
                key={referral.email}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">{referral.name || referral.email}</p>
                  <p className="text-sm text-gray-500">{referral.email}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    referral.subscription_status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {referral.subscription_status || 'Free'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 