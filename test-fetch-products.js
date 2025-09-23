const axios = require('axios');

const SERVER_URL = 'https://shopify-mystery-box-production.up.railway.app';

async function testFetchProducts() {
  try {
    console.log('🚀 Testing product fetch...');
    
    // First get the current shop
    const shopResponse = await axios.get(`${SERVER_URL}/api/auth/current-shop`, {
      timeout: 10000
    });
    
    const shop = shopResponse.data.shop;
    console.log(`📦 Fetching products for shop: ${shop}`);
    
    const response = await axios.get(`${SERVER_URL}/api/inventory/products?shop=${shop}`, {
      timeout: 10000
    });
    
    console.log('✅ Response received!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Request failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testFetchProducts();