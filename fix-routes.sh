#!/bin/bash

# Find files with [invoiceId] and change them to [id]
find /workspaces/billing-management-platform/app -path "*[invoiceId]*" -type d | while read dir; do
  newdir=$(echo $dir | sed 's/\[invoiceId\]/\[id\]/g')
  echo "Renaming $dir to $newdir"
  mv "$dir" "$newdir"
done

# Update any references within files
grep -r "\[invoiceId\]" --include="*.ts" --include="*.tsx" /workspaces/billing-management-platform/app | cut -d: -f1 | uniq | while read file; do
  echo "Updating references in $file"
  sed -i 's/\[invoiceId\]/\[id\]/g' "$file"
  sed -i 's/params: { invoiceId: string }/params: { id: string }/g' "$file"
  sed -i 's/const { invoiceId }/const { id }/g' "$file"
done
