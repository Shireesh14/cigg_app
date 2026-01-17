-- CigTracker Database Schema
-- Initialize database for cigarette tracking application

-- Create tables
CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    location VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX idx_entries_location ON entries(location);

-- Create view for daily stats
CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as entry_count,
    SUM(quantity) as total_quantity,
    AVG(quantity) as avg_quantity
FROM entries
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- Create view for location stats
CREATE OR REPLACE VIEW location_stats AS
SELECT 
    location,
    COUNT(*) as entry_count,
    SUM(quantity) as total_quantity
FROM entries
GROUP BY location
ORDER BY total_quantity DESC;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_update_trigger
BEFORE UPDATE ON entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON entries TO cigtracker;
GRANT USAGE, SELECT ON SEQUENCE entries_id_seq TO cigtracker;
GRANT SELECT ON daily_stats TO cigtracker;
GRANT SELECT ON location_stats TO cigtracker;

-- Sample data (optional)
INSERT INTO entries (quantity, location, notes) VALUES
(1, 'Office', 'Morning break'),
(2, 'Home', 'After lunch'),
(1, 'Car', 'Commute home')
ON CONFLICT DO NOTHING;
