#!/bin/bash

echo "🚀 Deploying Mystery Box App to Railway"
echo "======================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit - ready for deployment"
else
    echo "📝 Committing latest changes..."
    git add .
    git commit -m "Prepare for deployment - $(date)"
fi

echo ""
echo "✅ Your app is ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Push to GitHub: git push origin main"
echo "2. Go to railway.app and create new project"
echo "3. Connect your GitHub repo"
echo "4. Add PostgreSQL database"
echo "5. Set environment variables (see .env.production.example)"
echo "6. Deploy!"
echo ""
echo "📖 Full instructions in DEPLOYMENT_GUIDE.md"