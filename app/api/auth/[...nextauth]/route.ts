import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }

        // Fetch user from the database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error('Invalid email or password');
        }

        // Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
          throw new Error('Invalid email or password');
        }

        // Return the user object if authentication is successful
        return user;
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // If the URL is a relative path, redirect to it
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Otherwise, fallback to the base URL
      return baseUrl;
    },
  },
});

export { handler as GET, handler as POST };