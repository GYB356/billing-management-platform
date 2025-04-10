import { NextResponse } from "next/server";
import { generateApiToken, listUserApiTokens, revokeApiToken } from "@/lib/auth/apiToken";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const token = await generateApiToken({
      userId: session.user.id,
      name
    });

    // Return everything except the token itself
    const { token: actualToken, ...tokenData } = token;
    
    return NextResponse.json({
      ...tokenData,
      token: actualToken // Include the actual token only on creation
    });
  } catch (error) {
    console.error('Error creating API token:', error);
    return NextResponse.json(
      { error: "Failed to create API token" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tokens = await listUserApiTokens(session.user.id);
    
    // Remove the actual tokens from the response
    const sanitizedTokens = tokens.map(({ token, ...rest }) => rest);
    
    return NextResponse.json(sanitizedTokens);
  } catch (error) {
    console.error('Error listing API tokens:', error);
    return NextResponse.json(
      { error: "Failed to list API tokens" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('id');

    if (!tokenId) {
      return NextResponse.json(
        { error: "Token ID is required" },
        { status: 400 }
      );
    }

    await revokeApiToken(tokenId, session.user.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API token:', error);
    return NextResponse.json(
      { error: "Failed to revoke API token" },
      { status: 500 }
    );
  }
} 