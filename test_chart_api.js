const axios = require('axios');

const API_BASE_URL = 'http://192.168.1.164:3001/api';

async function testChartAPIs() {
  try {
    console.log('Testing Bitcoin Chart APIs...\n');
    
    // Test Bitcoin price endpoint
    console.log('1. Testing Bitcoin price endpoint...');
    const priceResponse = await axios.get(`${API_BASE_URL}/public/bitcoin/price`);
    console.log('✅ Bitcoin price:', priceResponse.data.success ? priceResponse.data.data.btc_usd : 'Failed');
    
    // Test Bitcoin chart data for different timeframes
    const timeframes = ['1d', '7d', '30d', '90d', '365d'];
    
    for (const timeframe of timeframes) {
      console.log(`\n2. Testing Bitcoin chart data for ${timeframe}...`);
      try {
        const chartResponse = await axios.get(`${API_BASE_URL}/public/bitcoin/charts?timeframe=${timeframe}`);
        if (chartResponse.data.success) {
          const data = chartResponse.data.data;
          console.log(`✅ ${timeframe} chart data:`, {
            timeframe: data.timeframe,
            dataPoints: data.data_points_count,
            dateFrom: data.date_from,
            dateTo: data.date_to,
            hasData: Array.isArray(data.price_data) && data.price_data.length > 0
          });
        } else {
          console.log(`❌ ${timeframe} chart data: Failed`);
        }
      } catch (error) {
        console.log(`❌ ${timeframe} chart data: Error -`, error.message);
      }
    }
    
    console.log('\n✅ All chart API tests completed!');
  } catch (error) {
    console.error('❌ Error during API testing:', error.message);
  }
}

testChartAPIs();
