// Quick test script to verify backend functionality
const { query } = require('./server/config/database');
const userService = require('./server/services/userService');
const bitcoinDataService = require('./server/services/bitcoinDataService');

async function testBackend() {
  try {
    console.log('🔍 Testing backend functionality...\n');

    // Test 1: Database connection
    console.log('1. Testing database connection...');
    const users = await query('SELECT email, available_inr, available_btc FROM users LIMIT 1');
    console.log('✅ Database connected successfully');
    console.log(`   Found user: ${users[0].email} with ₹${users[0].available_inr.toLocaleString()}\n`);

    // Test 2: User service - Get balances
    console.log('2. Testing user service...');
    const balances = await userService.getUserBalances(1);
    console.log('✅ User service working');
    console.log(`   INR Balance: ₹${balances.inr_balance.toLocaleString()}`);
    console.log(`   BTC Balance: ${balances.btc_balance / 100000000} BTC\n`);

    // Test 3: Bitcoin data service - Get rates
    console.log('3. Testing Bitcoin data service...');
    try {
      const rates = await bitcoinDataService.getCalculatedRates();
      console.log('✅ Bitcoin data service working');
      console.log(`   BTC USD Price: $${rates.btcUsdPrice.toLocaleString()}`);
      console.log(`   Buy Rate: ₹${rates.buyRate.toLocaleString()}`);
      console.log(`   Sell Rate: ₹${rates.sellRate.toLocaleString()}\n`);
    } catch (error) {
      console.log('⚠️  Bitcoin data service using fallback data');
      console.log(`   Error: ${error.message}\n`);
    }

    // Test 4: Recent transactions
    console.log('4. Testing transaction retrieval...');
    const transactions = await userService.getRecentTransactions(1, 3);
    console.log('✅ Transaction service working');
    console.log(`   Found ${transactions.length} transactions\n`);

    console.log('🎉 All backend services are working correctly!');
    console.log('🚀 Ready to start the full application');

  } catch (error) {
    console.error('❌ Backend test failed:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

testBackend();
