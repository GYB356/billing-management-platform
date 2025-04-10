#!/bin/bash

echo "Verifying core implementation files..."

# Core files to check
FILES=(
  "app/api/subscriptions/route.ts"
  "app/api/usage/route.ts"
  "app/api/analytics/route.ts"
  "lib/services/currency.ts"
  "lib/services/tax.ts"
  "lib/services/webhook.ts"
  "components/analytics/AdvancedAnalytics.tsx"
  "components/reports/ReportGenerator.tsx"
)

MISSING=0
for FILE in "${FILES[@]}"; do
  if [ ! -f "/workspaces/billing-management-platform/$FILE" ]; then
    echo "❌ Missing: $FILE"
    MISSING=$((MISSING+1))
  else
    echo "✅ Found: $FILE"
  fi
done

if [ $MISSING -eq 0 ]; then
  echo "All critical files are present!"
else
  echo "$MISSING critical files are missing."
fi
