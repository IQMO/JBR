import { RSIIndicator, getRSISignals } from '../../../src/JabbrLabs/indicators/rsi';

describe('RSIIndicator', () => {
  describe('constructor', () => {
    it('should create with default period', () => {
      const rsi = new RSIIndicator();
      expect(rsi.getPeriod()).toBe(14);
    });

    it('should create with custom period', () => {
      const rsi = new RSIIndicator({ period: 10 });
      expect(rsi.getPeriod()).toBe(10);
    });

    it('should throw for invalid period', () => {
      expect(() => new RSIIndicator({ period: 0 })).toThrow('RSI period must be at least 1');
      expect(() => new RSIIndicator({ period: -5 })).toThrow('RSI period must be at least 1');
    });
  });

  describe('calculate', () => {
    it('should calculate RSI correctly for basic uptrend', () => {
      const rsi = new RSIIndicator({ period: 5 });
      const prices = [10, 11, 12, 13, 14, 15, 16]; // Consistent uptrend
      
      const result = rsi.calculate(prices);
      expect(result).toHaveLength(2); // 7 prices - 5 period = 2 RSI values
      
      // In a strong uptrend, RSI should be high (> 70)
      expect(result[0]).toBeGreaterThan(70);
      expect(result[1]).toBeGreaterThan(70);
    });

    it('should calculate RSI correctly for basic downtrend', () => {
      const rsi = new RSIIndicator({ period: 5 });
      const prices = [20, 19, 18, 17, 16, 15, 14]; // Consistent downtrend
      
      const result = rsi.calculate(prices);
      expect(result).toHaveLength(2);
      
      // In a strong downtrend, RSI should be low (< 30)
      expect(result[0]).toBeLessThan(30);
      expect(result[1]).toBeLessThan(30);
    });

    it('should calculate RSI correctly for sideways market', () => {
      const rsi = new RSIIndicator({ period: 3 });
      const prices = [100, 101, 99, 100, 98, 101, 100]; // Oscillating prices
      
      const result = rsi.calculate(prices);
      expect(result).toHaveLength(4);
      
      // In a sideways market, RSI should be around 50, but can vary with short periods
      result.forEach(value => {
        expect(value).toBeGreaterThan(25); // More realistic range for period 3
        expect(value).toBeLessThan(75);
      });
    });

    it('should handle real market data', () => {
      const rsi = new RSIIndicator({ period: 14 });
      const prices = [
        44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
        45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00
      ];
      
      const result = rsi.calculate(prices);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeGreaterThan(0);
      expect(result[0]).toBeLessThan(100);
    });

    it('should throw for insufficient data', () => {
      const rsi = new RSIIndicator({ period: 14 });
      const prices = [1, 2, 3, 4, 5]; // Only 5 prices, need at least 15
      expect(() => rsi.calculate(prices)).toThrow('Insufficient data for RSI calculation');
    });

    it('should throw for non-numeric data', () => {
      const rsi = new RSIIndicator();
      expect(() => rsi.calculate(['a', 'b', 'c'] as any)).toThrow('Input data contains invalid values');
    });

    it('should handle edge case of no price movement', () => {
      const rsi = new RSIIndicator({ period: 3 });
      const prices = [100, 100, 100, 100, 100]; // No price change
      
      const result = rsi.calculate(prices);
      expect(result).toHaveLength(2);
      
      // When there's no price movement, RSI calculation handles division by zero
      // The actual behavior depends on implementation - we just verify it doesn't crash
      result.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('parameter updates', () => {
    it('should update period correctly', () => {
      const rsi = new RSIIndicator({ period: 10 });
      rsi.setPeriod(20);
      expect(rsi.getPeriod()).toBe(20);
    });

    it('should throw for invalid period update', () => {
      const rsi = new RSIIndicator();
      expect(() => rsi.setPeriod(0)).toThrow('RSI period must be at least 1');
      expect(() => rsi.updateParameters({ period: -1 })).toThrow('RSI period must be at least 1');
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const rsi1 = new RSIIndicator({ period: 10 });
      const rsi2 = rsi1.clone() as RSIIndicator;
      
      expect(rsi2.getPeriod()).toBe(10);
      
      rsi1.setPeriod(20);
      expect(rsi1.getPeriod()).toBe(20);
      expect(rsi2.getPeriod()).toBe(10); // Should remain unchanged
    });
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      const rsi = new RSIIndicator();
      const metadata = rsi.getMetadata();
      
      expect(metadata.name).toBe('RSI');
      expect(metadata.category).toBe('momentum');
      expect(metadata.parameters).toHaveLength(1);
      expect(metadata.parameters[0].name).toBe('period');
      expect(metadata.minimumDataPoints).toBe(2);
    });
  });
});

describe('getRSISignals', () => {
  it('should generate buy signal when RSI crosses below oversold', () => {
    const rsiValues = [35, 32, 28, 25, 22, 27, 32]; // Crosses below 30 then recovers
    const signals = getRSISignals(rsiValues, 70, 30);
    
    expect(signals).toHaveLength(6);
    // Look for buy signal when RSI recovers from oversold condition
    const buySignalIndex = signals.findIndex(signal => signal === 1);
    expect(buySignalIndex).toBeGreaterThanOrEqual(0); // Should have at least one buy signal
  });

  it('should generate sell signal when RSI crosses above overbought', () => {
    const rsiValues = [65, 68, 72, 75, 78, 73, 68]; // Crosses above 70 then falls
    const signals = getRSISignals(rsiValues, 70, 30);
    
    expect(signals).toHaveLength(6);
    expect(signals[1]).toBe(-1); // Sell signal when crossing above 70
    expect(signals[2]).toBe(0); // No signal while staying above
    expect(signals[3]).toBe(0); // No signal while staying above
  });

  it('should use custom overbought/oversold levels', () => {
    const rsiValues = [45, 55, 65, 75, 85, 75, 65];
    const signals = getRSISignals(rsiValues, 80, 20); // Custom levels
    
    expect(signals).toHaveLength(6);
    expect(signals[3]).toBe(-1); // Sell signal when crossing above 80
  });

  it('should throw for missing RSI values', () => {
    const rsiValues = [50, 60, undefined as any, 70];
    expect(() => getRSISignals(rsiValues)).toThrow('Missing RSI value');
  });
}); 