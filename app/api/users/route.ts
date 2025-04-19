import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { sanitizeInput } from '@/lib/api/security';
import { rateLimit } from '@/lib/utils/rate-limit';

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/users - List users
export const GET = createHandler(
  async (req,params,user) => {
    
    const { searchParams } = new URL(req.url);

    const limitId = user ? user.id : 'user'

    rateLimit(limitId, 'user')

    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
  {
    method: 'GET',
    roles: ['ADMIN'],
  }
);

// POST /api/users - Create user
export const POST = createHandler(
  async (req,params,user) => {

    const data = await req.json();
    
    const limitId = user ? user.id : 'user'
    rateLimit(limitId, 'user')

    const validatedData = createUserSchema.parse(data);

    const user = await prisma.user.create({
      data: {
        ...validatedData,
        name: sanitizeInput(validatedData.name),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  },
  {
    method: 'POST',
    roles: ['ADMIN'],
    schema: createUserSchema,
  }
);

// PUT /api/users/:id - Update user
export const PUT = createHandler(
  async (req, params,user) => {
    const userId = params.id as string;
    
    const limitId = user ? user.id : 'user'
    rateLimit(limitId, 'user')
    const data = await req.json();
    const validatedData = updateUserSchema.parse(data);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...validatedData,
        name: validatedData.name ? sanitizeInput(validatedData.name) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  },
  {
    method: 'PUT',
    roles: ['ADMIN'],
    schema: updateUserSchema,
  }
);

// DELETE /api/users/:id - Delete user
export const DELETE = createHandler(
  async (req, params, user) => {
    const userId = params.id as string;

    const limitId = user ? user.id : 'user'
    rateLimit(limitId, 'user')

    await prisma.user.delete({
      where: { id: userId },
    });

    return new NextResponse(null, { status: 204 });
  },
  {
    method: 'DELETE',
    roles: ['ADMIN'],
  }
); 