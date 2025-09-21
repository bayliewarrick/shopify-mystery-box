// Simple demo sync test using built-in fetch
async function testDemoSync() {
  try {
    console.log('🚀 Testing demo sync endpoint...');
    
    const response = await fetch('http://localhost:3000/api/inventory/sync-demo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Demo sync successful!');
    console.log('Response:', data);
    
    // Test getting products
    console.log('\n📦 Fetching synced products...');
    const productsResponse = await fetch('http://localhost:3000/api/inventory/products?shop=pack-peddlers-demo.myshopify.com');
    
    if (!productsResponse.ok) {
      throw new Error(`HTTP ${productsResponse.status}: ${productsResponse.statusText}`);
    }
    
    const productsData = await productsResponse.json();
    console.log(`✅ Found ${productsData.products.length} products:`);
    productsData.products.forEach(product => {
      console.log(`  - ${product.title} ($${product.price}) - ${product.vendor}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Only run if not being imported
if (require.main === module) {
  testDemoSync();
}

module.exports = testDemoSync;