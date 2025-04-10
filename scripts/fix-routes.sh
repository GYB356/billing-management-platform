#!/bin/bash

echo "Standardizing route parameters..."

# Find all route files with [invoiceId]
find /workspaces/billing-management-platform/app -path "*\[invoiceId\]*" -type d | while read dir; do
  newdir=$(echo $dir | sed 's/\[invoiceId\]/\[id\]/g')
  echo "Renaming directory: $dir -> $newdir"
  [ "$dir" != "$newdir" ] && mv "$dir" "$newdir"
done

# Fix parameter references in files
grep -r "params: { invoiceId" --include="*.ts" --include="*.tsx" /workspaces/billing-management-platform | cut -d: -f1 | sort -u | while read file; do
  echo "Fixing parameters in: $file"
  sed -i 's/params: { invoiceId/params: { id/g' "$file"
  sed -i 's/const { invoiceId }/const { id }/g' "$file"
  sed -i 's/params\.invoiceId/params.id/g' "$file"
done
