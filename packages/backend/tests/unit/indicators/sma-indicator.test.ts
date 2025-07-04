import { SMAIndicator } from '../../../src/JabbrLabs/indicators/sma-indicator';

describe('SMAIndicator', () => {
  it('calculates SMA correctly for known data', () => {
    const sma = new SMAIndicator({ period: 3 });
    const data = [1, 2, 3, 4, 5, 6];
    // SMA(3): [ (1+2+3)/3, (2+3+4)/3, (3+4+5)/3, (4+5+6)/3 ]
    expect(sma.calculate(data)).toEqual([2, 3, 4, 5]);
  });

  it('throws if not enough data', () => {
    const sma = new SMAIndicator({ period: 5 });
    expect(() => sma.calculate([1, 2, 3])).toThrow(/Insufficient data/);
  });

  it('validates parameters', () => {
    const sma = new SMAIndicator();
    expect(() => sma.setPeriod(0)).toThrow(/at least 1/);
    expect(() => new SMAIndicator({ period: -2 })).toThrow();
  });

  it('clones itself with same parameters', () => {
    const sma = new SMAIndicator({ period: 7 });
    const clone = sma.clone();
    expect(clone.getParameters()).toEqual(sma.getParameters());
    expect(clone.calculate([1,2,3,4,5,6,7,8,9])).toEqual(sma.calculate([1,2,3,4,5,6,7,8,9]));
  });

  it('handles empty input gracefully', () => {
    const sma = new SMAIndicator({ period: 2 });
    expect(() => sma.calculate([])).toThrow(/Insufficient data/);
  });
}); 