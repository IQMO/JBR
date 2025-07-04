/**
 * Bybit WebSocket API Format Test
 * Testing with correct Bybit V5 WebSocket API format
 */

import BybitWebSocketClient from '../src/websocket/bybit-websocket.client';

async function testCorrectBybitFormat() {
  console.log('🔍 Testing with CORRECT Bybit V5 WebSocket API format...\n');

  const client = new BybitWebSocketClient(true); // Use testnet
  let dataReceived = 0;
  let connectionOpened = false;

  // Set up detailed event listeners
  client.on('connected', () => {
    console.log('✅ Connected to Bybit testnet WebSocket');
    connectionOpened = true;
    
    // Test different subscription formats based on Bybit V5 API
    console.log('\n📺 Testing various subscription formats...');
    
    // Format 1: tickers.BTCUSDT (our current format)
    console.log('1. Testing: tickers.BTCUSDT');
    client.subscribe('tickers', 'BTCUSDT');
    
    setTimeout(() => {
      // Format 2: publicTrade.BTCUSDT
      console.log('2. Testing: publicTrade.BTCUSDT');
      client.subscribe('publicTrade', 'BTCUSDT');
    }, 2000);
    
    setTimeout(() => {
      // Format 3: orderbook.1.BTCUSDT (depth 1)
      console.log('3. Testing: orderbook.1.BTCUSDT');
      client.subscribe('orderbook.1', 'BTCUSDT');
    }, 4000);
    
    setTimeout(() => {
      // Format 4: kline.1.BTCUSDT (1-minute kline)
      console.log('4. Testing: kline.1.BTCUSDT');
      client.subscribe('kline.1', 'BTCUSDT');
    }, 6000);
  });

  client.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  client.on('data', (data) => {
    dataReceived++;
    console.log(`\n📊 [${dataReceived}] REAL DATA RECEIVED!`);
    console.log('Topic:', data.topic);
    console.log('Type:', data.type);
    console.log('Timestamp:', new Date().toISOString());
    
    if (data.data) {
      console.log('Data sample:', JSON.stringify(data.data, null, 2).slice(0, 300) + '...');
    }
  });

  // Listen for specific events
  client.on('ticker', (tickerData) => {
    console.log(`\n🎯 TICKER DATA for ${tickerData.symbol}:`, tickerData.data);
  });

  client.on('trade', (tradeData) => {
    console.log(`\n💰 TRADE DATA for ${tradeData.symbol}:`, tradeData);
  });

  client.on('orderbook', (orderbookData) => {
    console.log(`\n📚 ORDERBOOK DATA for ${orderbookData.symbol}:`, {
      bids: orderbookData.bids.slice(0, 3),
      asks: orderbookData.asks.slice(0, 3)
    });
  });

  client.on('disconnected', () => {
    console.log('🔌 Disconnected from Bybit WebSocket');
  });

  try {
    // Connect
    console.log('📡 Connecting to Bybit testnet...');
    await client.connect();
    
    // Wait for data for 20 seconds
    console.log('⏳ Waiting for market data (20 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Report results
    console.log('\n' + '='.repeat(50));
    console.log('📈 FINAL TEST RESULTS:');
    console.log(`- Connection opened: ${connectionOpened ? '✅ YES' : '❌ NO'}`);
    console.log(`- Total data messages: ${dataReceived}`);
    
    if (dataReceived > 0) {
      console.log('🎉 SUCCESS: Real market data is flowing!');
    } else {
      console.log('🔍 NO DATA: Check subscription format or market activity');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error instanceof Error ? error.message : error);
  } finally {
    // Cleanup
    client.disconnect();
    setTimeout(() => process.exit(0), 2000);
  }
}

// Run the test
testCorrectBybitFormat().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
