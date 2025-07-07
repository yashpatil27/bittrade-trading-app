-- ₿itTrade Chart Data Seed
-- Add sample Bitcoin chart data

USE bittrade;

-- Bitcoin chart data
INSERT INTO `bitcoin_chart_data` (`timeframe`, `price_data`, `data_points_count`, `date_from`, `date_to`) VALUES
('1d', '[[1751743006372,107986.47605901101],[1751743205789,107971.2174166763],[1751743518523,107983.2953391529],[1751743847662,108010.68656823284],[1751744203270,108057.07837350269],[1751744424011,108059.33529909748],[1751744734392,108092.40322074089],[1751745055777,108134.71250881087],[1751745387398,108153.45706811396],[1751745716746,108146.47997496236]]', 10, '2025-07-06 19:16:46', '2025-07-07 19:15:33'),
('7d', '[[1751223833425,107663.72774016614],[1751227430818,107457.44095461305],[1751231031610,107469.27173500716],[1751234627832,107632.63667243587],[1751238204033,108118.04751834349],[1751241631270,108387.33306224085],[1751245429375,108706.24104403128]]', 7, '2025-06-29 19:03:53', '2025-07-06 19:15:55'),
('30d', '[{"timestamp":1719792000000,"price":106000},{"timestamp":1719878400000,"price":107000},{"timestamp":1719964800000,"price":108000}]', 30, '2025-06-01 00:00:00', '2025-06-30 23:59:59'),
('90d', '[{"timestamp":1711929600000,"price":104000},{"timestamp":1713225600000,"price":105000},{"timestamp":1714521600000,"price":106000}]', 90, '2025-04-01 00:00:00', '2025-06-30 23:59:59'),
('365d', '[{"timestamp":1704067200000,"price":95000},{"timestamp":1709251200000,"price":100000},{"timestamp":1717200000000,"price":108000}]', 365, '2024-07-01 00:00:00', '2025-06-30 23:59:59');

-- Insert sample Bitcoin data for current price
INSERT INTO bitcoin_data (
  btc_usd_price, 
  price_change_24h, 
  price_change_24h_pct,
  market_cap_usd,
  volume_24h_usd,
  high_24h_usd,
  low_24h_usd,
  btc_dominance_pct,
  price_change_1h_pct,
  price_change_7d_pct,
  price_change_30d_pct
) VALUES (
  10800000, -- $108,000 USD (in cents)
  50000,    -- +$500 24h change
  0.46,     -- +0.46% 24h
  2140000000000, -- $2.14T market cap
  35000000000,   -- $35B volume
  10850000,      -- $108,500 high
  10750000,      -- $107,500 low
  56.78,         -- 56.78% dominance
  0.12,          -- +0.12% 1h
  2.34,          -- +2.34% 7d
  5.67           -- +5.67% 30d
);

-- Insert sample sentiment data
INSERT INTO bitcoin_sentiment (
  fear_greed_value,
  fear_greed_classification,
  data_date
) VALUES (
  72,
  'Greed',
  CURDATE()
);
