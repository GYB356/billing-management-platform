import { Client } from '@hubspot/api-client';

interface HubSpotConfig {
  apiKey: string;
  portalId?: string;
}

interface ContactData {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  [key: string]: any; // Allow additional custom properties
}

export class HubSpotClient {
  private client: Client;

  constructor(config: HubSpotConfig) {
    this.client = new Client({ accessToken: config.apiKey });
  }

  /**
   * Push contact data to HubSpot
   * @param contactData The contact data to push
   * @returns The created or updated contact
   */
  async pushToHubSpot(contactData: ContactData) {
    try {
      const properties = {
        email: contactData.email,
        firstname: contactData.firstName,
        lastname: contactData.lastName,
        company: contactData.company,
        phone: contactData.phone,
        ...Object.entries(contactData)
          .filter(([key]) => !['email', 'firstName', 'lastName', 'company', 'phone'].includes(key))
          .reduce((acc, [key, value]) => ({ ...acc, [key.toLowerCase()]: value }), {})
      };

      // Search for existing contact
      const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: contactData.email
          }]
        }]
      });

      if (searchResponse.total > 0) {
        // Update existing contact
        const contactId = searchResponse.results[0].id;
        return await this.client.crm.contacts.basicApi.update(contactId, {
          properties: properties
        });
      } else {
        // Create new contact
        return await this.client.crm.contacts.basicApi.create({
          properties: properties
        });
      }
    } catch (error) {
      console.error('Error pushing to HubSpot:', error);
      throw new Error('Failed to push contact to HubSpot');
    }
  }

  /**
   * Get a contact by email
   * @param email The email address to look up
   * @returns The contact if found, null otherwise
   */
  async getContactByEmail(email: string) {
    try {
      const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }]
      });

      return searchResponse.total > 0 ? searchResponse.results[0] : null;
    } catch (error) {
      console.error('Error getting contact from HubSpot:', error);
      throw new Error('Failed to get contact from HubSpot');
    }
  }
}

// Export a function to create a new client instance
export function createHubSpotClient(config: HubSpotConfig): HubSpotClient {
  return new HubSpotClient(config);
}

// Export the pushToHubSpot function for backward compatibility
export async function pushToHubSpot(contactData: ContactData) {
  const client = createHubSpotClient({
    apiKey: process.env.HUBSPOT_API_KEY || ''
  });
  return client.pushToHubSpot(contactData);
} 