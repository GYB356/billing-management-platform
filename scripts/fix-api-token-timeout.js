const fs = require('fs');
const path = require('path');

// Path to schema file
const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

// Read the schema file
let schema = fs.readFileSync(schemaPath, 'utf8');

// Define the ApiToken models
const apiTokenModels = `
// API Token model for authentication
model ApiToken {
  id         String    @id @default(cuid())
  token      String    @unique
  userId     String
  scopes     String[]
  name       String
  expiresAt  DateTime?
  lastUsedAt DateTime?
  usageCount Int       @default(0)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  usages     ApiTokenUsage[]

  @@index([token])
  @@index([userId])
}

// API Token Usage model for tracking and analytics
model ApiTokenUsage {
  id           String   @id @default(cuid())
  tokenId      String
  endpoint     String
  method       String
  statusCode   Int
  ipAddress    String?
  userAgent    String?
  responseTime Int?
  timestamp    DateTime @default(now())
  token        ApiToken @relation(fields: [tokenId], references: [id], onDelete: Cascade)

  @@index([tokenId])
  @@index([timestamp])
}`;

// Add ApiToken models to the schema - insert it before the enum definitions
schema = schema.replace(/(\s*enum\s+UserRole\s+{)/, apiTokenModels + '\n$1');

// Add apiTokens relation to User model
schema = schema.replace(
  /(model\s+User\s+{[\s\S]+?userOrganizations\s+UserOrganization\[\])/,
  '$1\n  apiTokens            ApiToken[]'
);

// Write the updated schema back to the file
fs.writeFileSync(schemaPath, schema, 'utf8');

console.log('Schema updated with ApiToken models and User relation.');

// To run this script: node scripts/fix-api-token-timeout.js
// Then run: npx prisma generate 