import { customAlphabet } from 'nanoid';
import prisma from '@/lib/prisma';

// Create a custom nanoid generator with only uppercase letters and numbers
const generateReferralCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export async function createReferralCode(userId: string) {
  let referralCode: string;
  let isUnique = false;

  // Keep generating codes until we find a unique one
  while (!isUnique) {
    referralCode = generateReferralCode();
    const existing = await prisma.user.findUnique({
      where: { referralCode },
    });
    if (!existing) {
      isUnique = true;
    }
  }

  // Update user with the new referral code
  await prisma.user.update({
    where: { id: userId },
    data: { referralCode },
  });

  return referralCode;
}

export async function processReferral(referralCode: string, newUserId: string) {
  const referrer = await prisma.user.findUnique({
    where: { referralCode },
  });

  if (!referrer) {
    return null;
  }

  // Update the new user with the referrer's code
  await prisma.user.update({
    where: { id: newUserId },
    data: { referredBy: referralCode },
  });

  // Increment referrer's count
  await prisma.user.update({
    where: { id: referrer.id },
    data: {
      referralCount: {
        increment: 1,
      },
    },
  });

  return referrer;
}

export async function checkReferralReward(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: true,
    },
  });

  if (!user || !user.referredBy) {
    return null;
  }

  // Check if user has an active subscription
  const hasActiveSubscription = user.subscriptions.some(
    (sub) => sub.status === 'active'
  );

  if (!hasActiveSubscription) {
    return null;
  }

  // Check if referrer has already received a reward for this referral
  if (user.referralRewards > 0) {
    return null;
  }

  // Award the referrer
  const referrer = await prisma.user.findUnique({
    where: { referralCode: user.referredBy },
  });

  if (!referrer) {
    return null;
  }

  // Update referrer's rewards count
  await prisma.user.update({
    where: { id: referrer.id },
    data: {
      referralRewards: {
        increment: 1,
      },
    },
  });

  return referrer;
} 