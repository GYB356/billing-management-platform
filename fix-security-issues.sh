#!/bin/bash

echo "Fixing security vulnerabilities..."

# Step 1: Fix critical and moderate issues
npm audit fix --force

# Step 2: Replace xlsx with exceljs
npm uninstall xlsx
npm install exceljs

# Step 3: Install updated dependencies
npm install

echo "Security fixes applied!"
echo "Remember to update any code that uses xlsx to use the new exceljs utility functions in lib/utils/excel.ts"
echo "Check the report generator and any export functionality"
