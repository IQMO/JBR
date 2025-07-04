/**
 * Extended Real Data Test
 * Test actual market data reception from Bybit WebSocket
 */

import BybitWebSocketClient from '../src/websocket/bybit-websocket.client';

async function testRealMarketData() {
  console.log('📊 Testing REAL market data reception from Bybit...\n');

  const client = new BybitWebSocketClient(true); // Use testnet
  let dataReceived = 0;
  let subscriptionSuccessful = false;

  // Set up detailed event listeners
  client.on('connected', () => {
    console.log('✅ Connected to Bybit testnet WebSocket');
    console.log('📺 Subscribing to BTCUSDT ticker data...');
    client.subscribe('tickers', 'BTCUSDT');
  });

  client.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  client.on('subscribed', (topic) => {
    console.log(`✅ Successfully subscribed to: ${topic}`);
    subscriptionSuccessful = true;
  });

  client.on('data', (data) => {
    dataReceived++;
    console.log(`📊 [${dataReceived}] Market data received:`, {
      topic: data.topic,
      type: data.type,
      timestamp: new Date().toISOString(),
      data: data.data ? JSON.stringify(data.data).slice(0, 200) + '...' : 'No data'
    });
  });

  client.on('disconnected', () => {
    console.log('🔌 Disconnected from Bybit WebSocket');
  });

  try {
    // Connect
    console.log('📡 Connecting to Bybit testnet...');
    await client.connect();
    
    // Wait for data for 30 seconds
    console.log('⏳ Waiting for market data (30 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Report results
    console.log('\n📈 Test Results:');
    console.log(`- Connection: ✅ Successful`);
    console.log(`- Subscription: ${subscriptionSuccessful ? '✅ Successful' : '❌ Failed'}`);
    console.log(`- Data received: ${dataReceived} messages`);
    
    if (dataReceived === 0) {
      console.log('\n🔍 Possible issues:');
      console.log('- Symbol might not exist or not active');
      console.log('- Topic format might be incorrect');
      console.log('- Market might be closed');
      console.log('- Bybit might not send ticker data immediately');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error instanceof Error ? error.message : error);
  } finally {
    // Cleanup
    client.disconnect();
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run the test
testRealMarketData().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
