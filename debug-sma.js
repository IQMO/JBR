import { SMASignalProcessor } from './packages/backend/src/JabbrLabs/signals/sma/sma-signal-processor.js';
import { generateBullishCandles } from './packages/shared/src/test-utils/data-generators.js';

// Generate test data
const candles = generateBullishCandles(30, 100);
console.log('Generated candles:', candles.slice(-5));

// Test SMA processor
const processor = new SMASignalProcessor();
const result = processor.process(candles);

console.log('SMA Result:', result);
console.log('Config:', processor.getConfig());
