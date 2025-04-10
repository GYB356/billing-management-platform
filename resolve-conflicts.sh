#!/bin/bash

echo "Resolving merge conflicts..."

# Resolve conflicts by taking our changes
git checkout --ours lib/metrics/advanced/AdvancedMetricsCollector.ts
git checkout --ours lib/reports/advancedTemplates.ts
git checkout --ours lib/services/currency.ts
git checkout --ours lib/services/webhook.ts
git checkout --ours package-lock.json
git checkout --ours package.json

# Mark as resolved
git add lib/metrics/advanced/AdvancedMetricsCollector.ts
git add lib/reports/advancedTemplates.ts
git add lib/services/currency.ts
git add lib/services/webhook.ts
git add package-lock.json
git add package.json

# Remove the conflicted .package-lock.json in node_modules
rm -f node_modules/.package-lock.json
git add node_modules/.package-lock.json

# Commit the merge resolution
git commit -m "Merge temp-merge-branch: resolve conflicts"

# Push to remote
echo "Pushing to remote repository..."
git push origin main

echo "Done!"
