const axios = require('axios');

async function testChartAPI() {
  try {
    console.log('Testing chart API endpoints...\n');
    
    const timeframes = ['1d', '7d', '30d'];
    
    for (const timeframe of timeframes) {
      try {
        console.log(`Testing ${timeframe}...`);
        const response = await axios.get(`http://localhost:3001/api/public/bitcoin/charts?timeframe=${timeframe}`);
        
        if (response.data.success && response.data.data) {
          const data = response.data.data;
          console.log(`✅ ${timeframe}: ${data.data_points_count} data points`);
          console.log(`   Price data type: ${typeof data.price_data}`);
          console.log(`   Price data length: ${Array.isArray(data.price_data) ? data.price_data.length : 'Not array'}`);
          if (Array.isArray(data.price_data) && data.price_data.length > 0) {
            console.log(`   First point: [${data.price_data[0][0]}, $${data.price_data[0][1].toFixed(2)}]`);
            console.log(`   Last point: [${data.price_data[data.price_data.length-1][0]}, $${data.price_data[data.price_data.length-1][1].toFixed(2)}]`);
          }
        } else {
          console.log(`❌ ${timeframe}: No data returned`);
        }
        console.log('');
      } catch (error) {
        console.log(`❌ ${timeframe}: Error - ${error.message}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testChartAPI();
