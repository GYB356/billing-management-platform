 
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        address: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      name: organization.name,
      email: organization.email,
      company: organization.name,
      phone: organization.phone || '',
      address: {
        line1: organization.address?.line1 || '',
        line2: organization.address?.line2 || '',
        city: organization.address?.city || '',
        state: organization.address?.state || '',
        postalCode: organization.address?.postalCode || '',
        country: organization.address?.country || ''
      }
    });
  } catch (error) {
    console.error('Error fetching account info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account information' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();

    const organization = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        name: data.company,
        email: data.email,
        phone: data.phone,
        address: {
          upsert: {
            create: {
              line1: data.address.line1,
              line2: data.address.line2,
              city: data.address.city,
              state: data.address.state,
              postalCode: data.address.postalCode,
              country: data.address.country
            },
            update: {
              line1: data.address.line1,
              line2: data.address.line2,
              city: data.address.city,
              state: data.address.state,
              postalCode: data.address.postalCode,
              country: data.address.country
            }
          }
        }
      },
      include: {
        address: true
      }
    });

    return NextResponse.json({
      name: organization.name,
      email: organization.email,
      company: organization.name,
      phone: organization.phone || '',
      address: {
        line1: organization.address?.line1 || '',
        line2: organization.address?.line2 || '',
        city: organization.address?.city || '',
        state: organization.address?.state || '',
        postalCode: organization.address?.postalCode || '',
        country: organization.address?.country || ''
      }
    });
  } catch (error) {
    console.error('Error updating account info:', error);
    return NextResponse.json(
      { error: 'Failed to update account information' },
      { status: 500 }
    );
  }
}