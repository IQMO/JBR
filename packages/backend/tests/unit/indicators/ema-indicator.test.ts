import { EMAIndicator } from '../../../src/JabbrLabs/indicators/ema-indicator';

describe('EMAIndicator', () => {
  it('calculates EMA correctly for known data', () => {
    const ema = new EMAIndicator({ period: 3, smoothing: 2 });
    const data = [2, 4, 6, 8, 10];
    // For period=3, smoothing=2, multiplier=0.5
    // EMA[0]=2, EMA[1]=3, EMA[2]=4.5, EMA[3]=6.25, EMA[4]=8.125
    const expected = [2, 3, 4.5, 6.25, 8.125];
    const result = ema.calculate(data);
    expect(result.length).toBe(expected.length);
    result.forEach((val, i) => expect(val).toBeCloseTo(expected[i], 5));
  });

  it('throws if not enough data', () => {
    const ema = new EMAIndicator({ period: 5 });
    expect(() => ema.calculate([1, 2])).toThrow(/Insufficient data/);
  });

  it('validates parameters', () => {
    const ema = new EMAIndicator();
    expect(() => ema.setPeriod(0)).toThrow(/at least 1/);
    expect(() => ema.setSmoothing(0)).toThrow(/positive/);
    expect(() => new EMAIndicator({ period: -2 })).toThrow();
  });

  it('clones itself with same parameters', () => {
    const ema = new EMAIndicator({ period: 4, smoothing: 2 });
    const clone = ema.clone();
    expect(clone.getParameters()).toEqual(ema.getParameters());
    expect(clone.calculate([1,2,3,4,5,6,7,8,9])).toEqual(ema.calculate([1,2,3,4,5,6,7,8,9]));
  });

  it('handles empty input gracefully', () => {
    const ema = new EMAIndicator({ period: 2 });
    expect(() => ema.calculate([])).toThrow(/Insufficient data/);
  });
}); 