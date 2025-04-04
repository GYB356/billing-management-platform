import speakeasy from 'speakeasy';

export function generate2FAToken(secret: string) {
  return speakeasy.totp({
    secret,
    encoding: 'base32',
  });
}

export function verify2FAToken(secret: string, token: string) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}
