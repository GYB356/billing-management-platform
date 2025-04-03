import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 