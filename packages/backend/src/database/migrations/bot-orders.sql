-- Bot Orders Table
-- Tracks all orders placed by trading bots on exchanges
-- Stores order lifecycle data for auditing and analysis

CREATE TABLE IF NOT EXISTS bot_orders (
  id SERIAL PRIMARY KEY,
  bot_id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  exchange_order_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
  type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop', 'stop-limit')),
  amount DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8),
  filled DECIMAL(20, 8) DEFAULT 0,
  remaining DECIMAL(20, 8) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'open', 'partial', 'filled', 'cancelled', 'rejected', 'expired')),
  fee DECIMAL(20, 8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key to bots table
  CONSTRAINT fk_bot_orders_bot
    FOREIGN KEY (bot_id)
    REFERENCES bots(id)
    ON DELETE CASCADE,
  
  -- Unique constraint on order_id per bot
  CONSTRAINT unique_bot_order
    UNIQUE (bot_id, order_id)
);

-- Indexes for performance
CREATE INDEX idx_bot_orders_bot_id ON bot_orders(bot_id);
CREATE INDEX idx_bot_orders_status ON bot_orders(status);
CREATE INDEX idx_bot_orders_symbol ON bot_orders(symbol);
CREATE INDEX idx_bot_orders_created_at ON bot_orders(created_at);
CREATE INDEX idx_bot_orders_exchange_order_id ON bot_orders(exchange_order_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bot_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bot_orders_updated_at
BEFORE UPDATE ON bot_orders
FOR EACH ROW
EXECUTE FUNCTION update_bot_orders_updated_at();

-- Example order record:
-- {
--   bot_id: 'bot-123',
--   order_id: 'bot-123-1234567890',
--   exchange_order_id: 'BYBIT-ORDER-XYZ',
--   symbol: 'BTC/USDT',
--   side: 'buy',
--   type: 'limit',
--   amount: 0.01,
--   price: 50000,
--   filled: 0.005,
--   remaining: 0.005,
--   status: 'partial',
--   fee: 0.05,
--   created_at: '2024-01-01 12:00:00',
--   updated_at: '2024-01-01 12:01:00'
-- } 