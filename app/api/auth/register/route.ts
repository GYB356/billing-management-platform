import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    const normalizedEmail = email.toLowerCase(); // Normalize email to lowercase
    console.log('Normalized email during registration:', normalizedEmail);
    console.log('Plain text password during registration:', password);

    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      console.log('User already exists with email:', normalizedEmail);
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hashed password during registration:', hashedPassword);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'USER', // Default role
      },
    });

    console.log('User created successfully:', user);
    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Error in registration:', error);

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}