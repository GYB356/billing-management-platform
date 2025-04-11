#!/bin/bash

echo "Resolving merge conflicts..."

# List conflicts
CONFLICTS=$(git diff --name-only --diff-filter=U)
echo "Conflicts found in: $CONFLICTS"

# For each conflicted file, take our version
for FILE in $CONFLICTS; do
  echo "Resolving conflict in $FILE"
  git checkout --ours "$FILE"
  git add "$FILE"
done

# Commit the resolved conflicts
git commit -m "Resolve merge conflicts by keeping our changes"

echo "Conflicts resolved! Now you can pull and push."
