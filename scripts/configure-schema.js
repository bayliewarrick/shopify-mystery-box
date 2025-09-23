// Smart schema selector for development vs production
const fs = require('fs');
const path = require('path');

function selectSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('No DATABASE_URL found, using SQLite schema');
    return 'sqlite';
  }
  
  if (databaseUrl.includes('postgresql') || databaseUrl.includes('postgres')) {
    console.log('PostgreSQL detected, using PostgreSQL schema');
    return 'postgresql';
  }
  
  if (databaseUrl.includes('file:') || databaseUrl.includes('.db')) {
    console.log('SQLite detected, using SQLite schema');
    return 'sqlite';
  }
  
  // Default to PostgreSQL for production
  console.log('Unknown database type, defaulting to PostgreSQL');
  return 'postgresql';
}

function generateSchema() {
  const schemaType = selectSchema();
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  
  // Read the template schema
  let schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  // Replace the datasource provider
  if (schemaType === 'sqlite') {
    schemaContent = schemaContent.replace(
      /provider = "postgresql"/,
      'provider = "sqlite"'
    );
  }
  
  // Write back the schema
  fs.writeFileSync(schemaPath, schemaContent);
  console.log(`✅ Schema configured for ${schemaType}`);
}

// Run if this script is executed directly
if (require.main === module) {
  generateSchema();
}

module.exports = { selectSchema, generateSchema };