import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { stripe } from './stripe';

async function refreshAccessToken(token: any) {
  try {
    // Add the refreshAccessToken logic
    const response = await fetch('YOUR_REFRESH_TOKEN_ENDPOINT', { // Replace with the refresh token endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    const refreshedTokens = await response.json();
    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      accessTokenExpires: Date.now() + 60 * 60 * 1000, // Expires in 1 hour
    };
  } catch (error) {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}
import { Config } from './config';
const config = Config.getConfig();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!user || !user.password) {
          throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    })
  ],
  secret: config.nextAuthSecret,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        // First log in
        token.role = user.role;
        token.userId = user.id;
        
        const subscription = await prisma.subscription.findFirst({
          where: { userId: user.id },
        });
        const currentPeriodEnd = subscription ? (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).current_period_end * 1000 : Date.now() + 60 * 60 * 1000; // 1 hour

        return {
          accessToken: account.access_token,
          accessTokenExpires: currentPeriodEnd,
          refreshToken: account.refresh_token,
          ...token
        };
      }
      
        const subscription = await prisma.subscription.findFirst({
          where: { userId: token.userId },
        });
        const currentPeriodEnd = subscription ? (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).current_period_end * 1000 : Date.now() + 60 * 60 * 1000; // 1 hour

      
        if (currentPeriodEnd < Date.now()) {
          //token expirted
        const newToken = await refreshAccessToken(token);
        if (newToken.error) {
          return { ...token, error: "RefreshAccessTokenError" as const };
        }
        return {
          ...newToken, accessTokenExpires: currentPeriodEnd
        };
      }
      // Check if the access token has expired
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to update it
      const newToken = await refreshAccessToken(token);
      if (newToken.error) {
        return { ...token, error: "RefreshAccessTokenError" as const };
      }

      token.role = token.role

      token.userId = user.id


      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: `${config.nextAuthUrl}/login`,
  },
};

export async function GET(req: NextRequest) {

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: session.user.id },
      include: { plan: true },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}