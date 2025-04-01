import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const normalizedEmail = email.toLowerCase(); // Normalize email to lowercase
    console.log('Normalized email during login:', normalizedEmail);

    // Find the user by email
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      console.log('User not found for email:', normalizedEmail);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    console.log('User found:', user);
    console.log('Plain text password during login:', password);
    console.log('Hashed password from DB:', user.password);

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password comparison result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Password mismatch for user:', normalizedEmail);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    console.log('Login successful for user:', user);
    // Return success response
    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error: any) {
    console.error('Error in login:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}