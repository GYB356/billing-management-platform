 # API Token Timeout Fix

## Issue

The application is experiencing timeouts related to API token operations. After analyzing the codebase, we found that the problem is a missing Prisma model definition for `ApiToken` and `ApiTokenUsage`. 

The code in `lib/auth/apiToken.ts` imports `ApiToken` from `@prisma/client` and performs operations on `prisma.apiToken` but there's no corresponding model definition in the Prisma schema. This leads to errors and timeouts when the code tries to access the non-existent model.

## Solution

We need to add the missing model definitions to the Prisma schema and update the User model to include the relationship with ApiToken.

### Option 1: Manual Schema Update

1. Add the following models to your `prisma/schema.prisma` file:

```prisma
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
}
```

2. Add the `apiTokens` relation to the User model:

```prisma
model User {
  // existing fields...
  apiTokens            ApiToken[]
  // other existing fields...
}
```

### Option 2: Automated Fix

1. Run the provided script to update the schema:

```bash
node scripts/fix-api-token-timeout.js
```

2. Generate the Prisma client:

```bash
npx prisma generate
```

3. Create the database migration:

```bash
npx prisma migrate dev --name add_api_token_models
```

## Verification

After applying the fix, you should:

1. Restart your application
2. Verify that API token operations work without timeouts
3. Test token creation, verification, and usage tracking

## Related Files

- `lib/auth/apiToken.ts`: Contains the API token operations that expect these models
- `prisma/schema.prisma`: The database schema where the models were missing

## Note

If you're experiencing other issues with the database schema, you may need to run `npx prisma db push` or manually migrate the database structure to match the updated schema.