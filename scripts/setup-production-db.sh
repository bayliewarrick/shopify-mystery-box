#!/bin/bash

# Production database setup script
# This script sets up the database schema for production PostgreSQL

echo "🚀 Setting up production database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable is not set"
  exit 1
fi

echo "✅ DATABASE_URL is configured"

# Copy production schema temporarily
cp prisma/schema.production.prisma prisma/schema.temp.prisma

# Generate Prisma client with production schema
echo "📦 Generating Prisma client..."
npx prisma generate --schema=prisma/schema.temp.prisma

# Push database schema (creates tables)
echo "🗄️ Creating database tables..."
npx prisma db push --schema=prisma/schema.temp.prisma --accept-data-loss

# Clean up temporary file
rm prisma/schema.temp.prisma

echo "✅ Production database setup complete!"