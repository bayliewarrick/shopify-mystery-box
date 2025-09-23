const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { generateSchema } = require('./configure-schema');

async function setupProductionDatabase() {
  console.log('🚀 Setting up database...');
  
  // Configure schema based on environment
  generateSchema();
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not set - skipping database setup (this is normal during build)');
    console.log('📦 Generating Prisma client...');
    
    try {
      // Just generate the client during build
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('✅ Prisma client generated successfully');
      return;
    } catch (error) {
      console.error('❌ Failed to generate Prisma client:', error.message);
      process.exit(1);
    }
  }
  
  console.log('✅ DATABASE_URL is configured');
  
  try {
    // Copy production schema temporarily
    const prodSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.production.prisma');
    const tempSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.temp.prisma');
    
    if (fs.existsSync(prodSchemaPath)) {
      fs.copyFileSync(prodSchemaPath, tempSchemaPath);
      console.log('📄 Using production schema');
    } else {
      console.log('📄 Using default schema');
    }
    
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    if (fs.existsSync(tempSchemaPath)) {
      execSync(`npx prisma generate --schema=${tempSchemaPath}`, { stdio: 'inherit' });
    } else {
      execSync('npx prisma generate', { stdio: 'inherit' });
    }
    
    // Push database schema (creates tables)
    console.log('🗄️ Creating database tables...');
    if (fs.existsSync(tempSchemaPath)) {
      execSync(`npx prisma db push --schema=${tempSchemaPath} --accept-data-loss`, { stdio: 'inherit' });
    } else {
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    }
    
    // Clean up temporary file
    if (fs.existsSync(tempSchemaPath)) {
      fs.unlinkSync(tempSchemaPath);
    }
    
    console.log('✅ Production database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  setupProductionDatabase();
}

module.exports = { setupProductionDatabase };