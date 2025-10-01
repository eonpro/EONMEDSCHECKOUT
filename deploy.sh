#!/bin/bash

# Automatic Deployment Script for EONMeds Checkout Platform
# This script commits changes and pushes to GitHub, which triggers Vercel deployment

echo "🚀 Starting automatic deployment process for Checkout..."
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository!"
    exit 1
fi

# Check for changes
if git diff-index --quiet HEAD --; then
    echo "ℹ️  No changes detected. Nothing to deploy."
    exit 0
fi

# Show status
echo "📝 Current changes:"
git status --short
echo ""

# Add all changes
echo "➕ Adding all changes..."
git add -A

# Get commit message
if [ -z "$1" ]; then
    COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "📝 Using default commit message: $COMMIT_MSG"
else
    COMMIT_MSG="$1"
    echo "📝 Using commit message: $COMMIT_MSG"
fi

# Commit changes
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG"

# Push to GitHub (triggers Vercel deployment)
echo "🔄 Pushing to GitHub (this will trigger Vercel deployment)..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo "🚀 Vercel deployment has been triggered automatically."
    echo ""
    echo "📊 Monitor deployment at:"
    echo "   https://vercel.com/eonpro/eonmedscheckout"
    echo ""
    echo "🌐 Production URL:"
    echo "   https://eonmedscheckout.vercel.app"
else
    echo "❌ Failed to push changes. Please check your connection and try again."
    exit 1
fi
