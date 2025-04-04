import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const { email, password, name } = await req.json();

  if (!email || !password) {
    return new Response('Email and password are required', { status: 400 });
  }

  // Hash the password before saving it to the database
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return new Response(JSON.stringify(user), { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response('Error creating user', { status: 500 });
  }
}