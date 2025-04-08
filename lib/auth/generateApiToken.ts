import { v4 as uuidv4 } from 'uuid';
import { ApiToken, createApiToken, getApiToken, updateApiToken } from './apiToken';

/**
 * Generates a new API token with the specified scopes
 * @param userId The user ID to associate with the token
 * @param scopes Array of scopes to grant to the token
 * @param name Optional name for the token
 * @param expiresIn Optional expiration time in seconds (default: 30 days)
 * @returns The generated API token
 */
export async function generateApiToken(
  userId: string,
  scopes: string[],
  name?: string,
  expiresIn: number = 30 * 24 * 60 * 60 // 30 days in seconds
): Promise<ApiToken> {
  // Generate a random token
  const token = `sk_${uuidv4()}`;
  
  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  
  // Create the token in the database
  const apiToken = await createApiToken({
    token,
    userId,
    scopes,
    name: name || `API Token ${new Date().toISOString()}`,
    expiresAt,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  return apiToken;
}

/**
 * Revokes an API token
 * @param token The API token to revoke
 * @returns True if the token was revoked, false otherwise
 */
export async function revokeApiToken(token: string): Promise<boolean> {
  try {
    const apiToken = await getApiToken(token);
    if (!apiToken) {
      return false;
    }
    
    // Update the token to expire immediately
    await updateApiToken(token, {
      ...apiToken,
      expiresAt: new Date(),
      updatedAt: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Error revoking API token:', error);
    return false;
  }
} 