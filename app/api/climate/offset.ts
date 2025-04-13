import { NextRequest, NextResponse } from 'next/server';

// Mock Patch.io API client
// In a real app, you would use the Patch SDK or API directly
class PatchClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.patch.io/v1';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async createOrder(params: {
    amount: number;
    currency: string;
    project_id?: string;
  }) {
    // In a real implementation, we would make an actual API call
    // For demo purposes, we'll simulate a successful response
    console.log('Creating Patch.io order:', params);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock response
    return {
      id: `ord_${Math.random().toString(36).substring(2, 10)}`,
      state: 'created',
      amount: params.amount,
      currency: params.currency,
      project_id: params.project_id || 'proj_verified_mix',
      created_at: new Date().toISOString()
    };
  }
  
  async createPaymentIntent(orderId: string) {
    // In a real implementation, we would make an actual API call
    console.log('Creating payment intent for order:', orderId);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock response
    return {
      id: `pi_${Math.random().toString(36).substring(2, 10)}`,
      client_secret: `pi_${Math.random().toString(36).substring(2, 15)}_secret_${Math.random().toString(36).substring(2, 10)}`,
      order_id: orderId,
      amount: 500, // Amount in cents
      currency: 'USD',
      created_at: new Date().toISOString()
    };
  }
  
  async completeOrder(orderId: string) {
    // In a real implementation, we would make an actual API call
    console.log('Completing order:', orderId);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Return mock response
    return {
      id: orderId,
      state: 'completed',
      completed_at: new Date().toISOString()
    };
  }
  
  async getProjects() {
    // In a real implementation, we would make an actual API call
    // Return mock projects
    return [
      {
        id: 'proj_forest_conservation',
        name: 'Forest Conservation',
        description: 'Protects forest lands from conversion to agriculture',
        type: 'nature',
        country: 'BR',
        price_per_tonne: 1500, // in cents
      },
      {
        id: 'proj_direct_air_capture',
        name: 'Direct Air Capture',
        description: 'Technology that captures CO2 directly from the atmosphere',
        type: 'technology',
        country: 'US',
        price_per_tonne: 2500, // in cents
      },
      {
        id: 'proj_verified_mix',
        name: 'Verified Project Mix',
        description: 'Portfolio of verified carbon offset projects',
        type: 'mix',
        country: 'GLOBAL',
        price_per_tonne: 1800, // in cents
      }
    ];
  }
}

// Initialize Patch client
const patchApiKey = process.env.PATCH_API_KEY || 'test_key';
const patchClient = new PatchClient(patchApiKey);

// This API route creates and processes a carbon offset order
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { amount, currency = 'USD', project_id, customerId } = body;
    
    // Validate request
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }
    
    // Convert to tonnes of CO2
    const tonnes = amount / 10; // Assuming $10 per tonne
    
    // Log customer info
    const customerReference = customerId 
      ? `for customer ${customerId}` 
      : 'for anonymous customer';
    console.log(`Processing offset of ${tonnes} tonnes CO2e ${customerReference}`);
    
    // Create order
    const order = await patchClient.createOrder({
      amount: tonnes,
      currency,
      project_id
    });
    
    // For real payment processing, we would:
    // 1. Create a payment intent
    // 2. Return the client secret for the frontend to collect payment
    // For this demo, we'll simulate completing the order directly
    
    const completedOrder = await patchClient.completeOrder(order.id);
    
    // Store record in database (would be implemented in a real app)
    // await saveOffsetRecord({
    //   orderId: order.id,
    //   customerId,
    //   amount,
    //   currency,
    //   tonnes,
    //   status: 'completed',
    //   date: new Date()
    // });
    
    // Return success response
    return NextResponse.json({
      success: true,
      order: completedOrder,
      certificate: {
        id: `cert_${Math.random().toString(36).substring(2, 10)}`,
        url: `https://example.com/certificates/${order.id}`,
        tonnes,
        issued_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error processing carbon offset:', error);
    return NextResponse.json(
      { error: 'Failed to process carbon offset' },
      { status: 500 }
    );
  }
}

// Get available offset projects
export async function GET(req: NextRequest) {
  try {
    const projects = await patchClient.getProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching offset projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offset projects' },
      { status: 500 }
    );
  }
} 