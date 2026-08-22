-- Warehouse Zones
CREATE TABLE IF NOT EXISTS warehouse_zones (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Warehouse Bins
CREATE TABLE IF NOT EXISTS warehouse_bins (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  zone_id BIGINT NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  capacity DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bin Stock
CREATE TABLE IF NOT EXISTS bin_stock (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  bin_id BIGINT NOT NULL REFERENCES warehouse_bins(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bin_id, item_id)
);

-- Row Level Security
ALTER TABLE warehouse_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE bin_stock ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON warehouse_zones FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON warehouse_zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON warehouse_zones FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON warehouse_zones FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON warehouse_bins FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON warehouse_bins FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON warehouse_bins FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON warehouse_bins FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON bin_stock FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON bin_stock FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON bin_stock FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON bin_stock FOR DELETE USING (true);
