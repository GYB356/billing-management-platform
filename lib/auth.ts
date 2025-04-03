import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';
import { sendVerificationEmail } from '@/lib/email';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { generateSecret } from 'speakeasy';
import QRCode from 'qrcode';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error('Invalid credentials');
        }

        const isValid = await compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        if (!user.emailVerified) {
          await sendVerificationEmail(user.email);
          throw new Error('Please verify your email');
        }

        // Handle 2FA if enabled
        if (user.twoFactorEnabled) {
          if (!credentials.code) {
            throw new Error('2FA code required');
          }

          const isValidCode = authenticator.verify({
            token: credentials.code,
            secret: user.twoFactorSecret!,
          });

          if (!isValidCode) {
            throw new Error('Invalid 2FA code');
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
        };
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.twoFactorEnabled = token.twoFactorEnabled;
      }
      return session;
    },
    async jwt({ token, user }) {
      const dbUser = await prisma.user.findFirst({
        where: { email: token.email },
      });

      if (!dbUser) {
        if (user) {
          token.id = user?.id;
          token.role = user?.role;
          token.twoFactorEnabled = user?.twoFactorEnabled;
        }
        return token;
      }

      return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        twoFactorEnabled: dbUser.twoFactorEnabled,
      };
    },
  },
  events: {
    async createUser({ user }) {
      // Create default organization for new user
      await prisma.organization.create({
        data: {
          name: `${user.name}'s Organization`,
          users: {
            connect: { id: user.id },
          },
        },
      });
    },
  },
};

// Helper function to generate 2FA secret and QR code
export function generateTwoFactorSecret() {
  const secret = generateSecret({
    length: 20,
    name: 'Billing Platform',
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

// Helper function to verify 2FA code
export function verifyTwoFactorCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({
      token: code,
      secret,
    });
  } catch (error) {
    return false;
  }
}

// Helper function to generate backup codes
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(generateSecret({ length: 10 }).base32);
  }
  return codes;
}

export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
} 