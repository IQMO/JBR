/**
 * Real WebSocket Connectivity Test
 * This script tests actual connectivity to Bybit WebSocket without mocks
 */

import BybitWebSocketClient from '../src/websocket/bybit-websocket.client';

async function testRealWebSocketConnectivity() {
  console.log('🧪 Testing REAL WebSocket connectivity to Bybit...\n');

  // Test both testnet and mainnet
  const clients = [
    { name: 'Testnet', client: new BybitWebSocketClient(true) },
    { name: 'Mainnet', client: new BybitWebSocketClient(false) }
  ];

  for (const { name, client } of clients) {
    console.log(`\n📡 Testing ${name} connection...`);
    
    try {
      // Set up event listeners
      client.on('connected', () => {
        console.log(`✅ ${name}: Connected successfully!`);
      });

      client.on('error', (error) => {
        console.error(`❌ ${name}: Connection error:`, error.message);
      });

      client.on('disconnected', () => {
        console.log(`🔌 ${name}: Disconnected`);
      });

      client.on('data', (data) => {
        console.log(`📊 ${name}: Received data:`, JSON.stringify(data, null, 2));
      });

      // Attempt connection with timeout
      const connectPromise = client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout (30s)')), 30000);
      });

      await Promise.race([connectPromise, timeoutPromise]);
      
      // If connected, try subscribing to some data
      console.log(`📺 ${name}: Attempting to subscribe to BTCUSDT ticker...`);
      client.subscribe('tickers', 'BTCUSDT');
      
      // Wait for some data
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Cleanup
      client.disconnect();
      
    } catch (error) {
      console.error(`💥 ${name}: Failed to connect:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n🏁 Real connectivity test completed!');
  process.exit(0);
}

// Run the test
testRealWebSocketConnectivity().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
