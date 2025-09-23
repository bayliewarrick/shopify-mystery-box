const axios = require('axios');

const SERVER_URL = 'https://shopify-mystery-box-production.up.railway.app';

async function testLiveSync() {
  try {
    console.log('🚀 Testing live sync endpoint...');
    
    // First get the current shop
    console.log('🏪 Getting current shop from server...');
    const shopResponse = await axios.get(`${SERVER_URL}/api/auth/current-shop`, {
      timeout: 10000
    });
    
    console.log('✅ Shop response:', shopResponse.data);
    const shop = shopResponse.data.shop;
    
    if (!shop) {
      console.error('❌ No shop domain found. Is OAuth set up?');
      return;
    }
    
    // Now call sync with the shop parameter
    console.log(`🔄 Calling sync for shop: ${shop}`);
    const syncUrl = `${SERVER_URL}/api/inventory/sync?shop=${shop}`;
    console.log('📡 Calling:', syncUrl);
    
    const response = await axios.post(syncUrl, {}, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return status < 600; // Accept all HTTP status codes below 600
      }
    });
    
    console.log('✅ Response received!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Request failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Error setting up request:', error.message);
    }
  }
}

testLiveSync();