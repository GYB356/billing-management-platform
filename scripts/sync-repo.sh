#!/bin/bash
# This script handles syncing local and remote repositories

echo "Syncing local repository with remote..."

# Store current changes if any
git stash

# Pull from remote with merge strategy
git pull --no-rebase origin main

# Restore stashed changes if any were stashed
git stash pop || echo "No stashed changes to restore"

# Push changes to remote
git push origin main

echo "Repository sync complete!"
