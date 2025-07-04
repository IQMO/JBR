import { ATRIndicator } from '../../../src/JabbrLabs/indicators/atr';

describe('ATRIndicator', () => {
  describe('constructor', () => {
    it('should create with default period', () => {
      const atr = new ATRIndicator();
      expect(atr.getPeriod()).toBe(14);
    });

    it('should create with custom period', () => {
      const atr = new ATRIndicator({ period: 20 });
      expect(atr.getPeriod()).toBe(20);
    });

    it('should throw for invalid period', () => {
      expect(() => new ATRIndicator({ period: 0 })).toThrow('ATR period must be at least 1');
      expect(() => new ATRIndicator({ period: -5 })).toThrow('ATR period must be at least 1');
    });
  });

  describe('calculate', () => {
    it('should calculate ATR correctly for basic data', () => {
      const atr = new ATRIndicator({ period: 3 });
      // Flat array format: [high, low, close, ...]
      const data = [
        10, 8, 9,    // Day 1: H=10, L=8, C=9
        11, 9, 10,   // Day 2: H=11, L=9, C=10
        12, 10, 11,  // Day 3: H=12, L=10, C=11
        13, 11, 12,  // Day 4: H=13, L=11, C=12
        14, 12, 13   // Day 5: H=14, L=12, C=13
      ];
      
      const result = atr.calculate(data);
      expect(result).toHaveLength(2); // ATR calculation with period 3 on 5 candles should give 2 values
      
      // With period 3, we need at least period+1 data points to calculate ATR
      // ATR starts from the period+1 position
      expect(result[0]).toBeCloseTo(2, 5);
    });

    it('should throw for invalid input format', () => {
      const atr = new ATRIndicator();
      expect(() => atr.calculate([1, 2])).toThrow('ATRIndicator.calculate expects a flat array');
      expect(() => atr.calculate([1, 2, 3, 4])).toThrow('ATRIndicator.calculate expects a flat array');
    });

    it('should throw for insufficient data', () => {
      const atr = new ATRIndicator({ period: 5 });
      const data = [10, 8, 9, 11, 9, 10]; // Only 2 data points
      expect(() => atr.calculate(data)).toThrow('Insufficient data for ATR calculation');
    });
  });

  describe('calculateRaw', () => {
    it('should calculate ATR correctly with object input', () => {
      const atr = new ATRIndicator({ period: 3 });
      const data = {
        highs: [10, 11, 12, 13, 14],
        lows: [8, 9, 10, 11, 12],
        closes: [9, 10, 11, 12, 13]
      };
      
      const result = atr.calculateRaw(data);
      expect(result).toHaveLength(2); // Same logic as above - period 3 on 5 candles gives 2 values
      expect(result[0]).toBeCloseTo(2, 5);
    });

    it('should handle real market data', () => {
      const atr = new ATRIndicator({ period: 14 });
      const data = {
        highs: [100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 111, 110, 112, 114, 113, 115],
        lows: [98, 99, 98, 100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 111, 110, 112],
        closes: [99, 101, 100, 102, 104, 103, 105, 107, 106, 108, 110, 109, 111, 113, 112, 114]
      };
      
      const result = atr.calculateRaw(data);
      expect(result).toHaveLength(2); // 16 data points - 14 period = 2 ATR values
      expect(result[0]).toBeGreaterThan(0);
      expect(result[1]).toBeGreaterThan(0);
    });

    it('should throw for mismatched array lengths', () => {
      const atr = new ATRIndicator();
      expect(() => atr.calculateRaw({
        highs: [1, 2, 3],
        lows: [1, 2],
        closes: [1, 2, 3]
      })).toThrow('High, low, and close arrays must be of the same length');
    });
  });

  describe('parameter updates', () => {
    it('should update period correctly', () => {
      const atr = new ATRIndicator({ period: 10 });
      atr.setPeriod(20);
      expect(atr.getPeriod()).toBe(20);
    });

    it('should throw for invalid period update', () => {
      const atr = new ATRIndicator();
      expect(() => atr.setPeriod(0)).toThrow('ATR period must be at least 1');
      expect(() => atr.updateParameters({ period: -1 })).toThrow('ATR period must be at least 1');
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const atr1 = new ATRIndicator({ period: 10 });
      const atr2 = atr1.clone() as ATRIndicator;
      
      expect(atr2.getPeriod()).toBe(10);
      
      atr1.setPeriod(20);
      expect(atr1.getPeriod()).toBe(20);
      expect(atr2.getPeriod()).toBe(10); // Should remain unchanged
    });
  });

  describe('static methods', () => {
    it('should calculate true range correctly', () => {
      expect(ATRIndicator.calculateTrueRange(10, 8, 9)).toBe(2); // max(10-8, |10-9|, |8-9|) = 2
      expect(ATRIndicator.calculateTrueRange(15, 10, 11)).toBe(5); // max(15-10, |15-11|, |10-11|) = 5
      expect(ATRIndicator.calculateTrueRange(20, 18, 25)).toBe(7); // max(20-18, |20-25|, |18-25|) = 7
    });
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      const atr = new ATRIndicator();
      const metadata = atr.getMetadata();
      
      expect(metadata.name).toBe('ATR');
      expect(metadata.category).toBe('volatility');
      expect(metadata.parameters).toHaveLength(1);
      expect(metadata.parameters[0].name).toBe('period');
      expect(metadata.minimumDataPoints).toBe(2);
    });
  });
}); 