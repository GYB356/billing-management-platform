import speakeasy from 'speakeasy';

// Function to generate a two-factor authentication secret
export function generateTwoFactorSecret() {
  return speakeasy.generateSecret({ length: 20 });
}

// Function to verify a two-factor authentication token
export function verifyTwoFactorToken(secret: string, token: string) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
  });
} 