# API Token Timeout Fix

## Issue
The application is experiencing timeouts because the API token models are missing from the Prisma schema. The code is attempting to use `prisma.apiToken` operations, but these models don't exist in the database schema.

## Solution

1. Add the ApiToken and ApiTokenUsage models to the schema
2. Add the apiTokens relation to the User model
3. Generate the Prisma client
4. Create a database migration

### Step 1: Run the fix script

```bash
node scripts/fix-api-token-timeout.js
```

### Step 2: Generate the Prisma client

```bash
npx prisma generate
```

### Step 3: Create the database migration

```bash
npx prisma migrate dev --name add_api_token_models
```

## Manual Fix (if the script doesn't work)

Add these models to your schema.prisma file:

```prisma
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
}
```

Then add this to the User model:
```
apiTokens  ApiToken[]
``` 