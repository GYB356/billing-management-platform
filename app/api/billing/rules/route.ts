import { NextResponse } from 'next/server';
import { RuleBuilderService } from '@/app/billing/features/rule-builder/RuleBuilderService';
import { auth } from '@/lib/auth';

const ruleBuilder = new RuleBuilderService();

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const rule = await ruleBuilder.createRule(data);
    
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error creating billing rule:', error);
    return NextResponse.json(
      { error: 'Failed to create billing rule' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId');

    if (templateId) {
      const rule = await ruleBuilder.applyTemplate(templateId);
      return NextResponse.json(rule);
    }

    // In a real implementation, fetch rules from database
    return NextResponse.json({ rules: [] });
  } catch (error) {
    console.error('Error fetching billing rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing rules' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const validation = await ruleBuilder.validateRule(data);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid rule', details: validation.errors },
        { status: 400 }
      );
    }

    // In a real implementation, update rule in database
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating billing rule:', error);
    return NextResponse.json(
      { error: 'Failed to update billing rule' },
      { status: 500 }
    );
  }
} 
import { RuleBuilderService } from '@/app/billing/features/rule-builder/RuleBuilderService';
import { auth } from '@/lib/auth';

const ruleBuilder = new RuleBuilderService();

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const rule = await ruleBuilder.createRule(data);
    
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error creating billing rule:', error);
    return NextResponse.json(
      { error: 'Failed to create billing rule' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId');

    if (templateId) {
      const rule = await ruleBuilder.applyTemplate(templateId);
      return NextResponse.json(rule);
    }

    // In a real implementation, fetch rules from database
    return NextResponse.json({ rules: [] });
  } catch (error) {
    console.error('Error fetching billing rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing rules' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const validation = await ruleBuilder.validateRule(data);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid rule', details: validation.errors },
        { status: 400 }
      );
    }

    // In a real implementation, update rule in database
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating billing rule:', error);
    return NextResponse.json(
      { error: 'Failed to update billing rule' },
      { status: 500 }
    );
  }
}