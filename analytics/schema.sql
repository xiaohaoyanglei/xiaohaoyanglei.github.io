-- Anonymous aggregates only. Receipts contain no IP, user agent or location.
CREATE TABLE IF NOT EXISTS event_receipts (
  event_id TEXT PRIMARY KEY CHECK (length(event_id) = 36),
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS receipts_expiry ON event_receipts(expires_at);

CREATE TABLE IF NOT EXISTS analytics_totals (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  total INTEGER NOT NULL DEFAULT 0,
  unknown INTEGER NOT NULL DEFAULT 0,
  location_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  updated_at TEXT
);
INSERT OR IGNORE INTO analytics_totals(singleton) VALUES (1);

CREATE TABLE IF NOT EXISTS country_aggregates (
  code TEXT PRIMARY KEY CHECK (length(code) IN (0, 2)),
  views INTEGER NOT NULL,
  last_seen TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS countries_by_views ON country_aggregates(views DESC, code);

CREATE TABLE IF NOT EXISTS location_aggregates (
  id TEXT PRIMARY KEY,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  views INTEGER NOT NULL,
  last_seen TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS locations_by_views ON location_aggregates(views DESC, id);

CREATE TRIGGER IF NOT EXISTS count_new_location
AFTER INSERT ON location_aggregates BEGIN
  UPDATE analytics_totals SET location_count = location_count + 1 WHERE singleton = 1;
END;

-- An insert-only view keeps input location metadata out of the receipt table.
-- SQLite executes this trigger atomically. Each accepted statement changes one
-- row, so changes() carries the accepted/not-accepted decision through the chain.
-- A duplicate receipt changes zero rows, and every aggregate write is skipped.
CREATE VIEW IF NOT EXISTS visit_ingest (
  event_id, expires_at, seen_at, country, region, city, latitude, longitude, location_id
) AS SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL WHERE 0;

CREATE TRIGGER IF NOT EXISTS ingest_visit
INSTEAD OF INSERT ON visit_ingest BEGIN
  INSERT OR IGNORE INTO event_receipts(event_id, expires_at)
    VALUES (NEW.event_id, NEW.expires_at);

  UPDATE analytics_totals
    SET total = total + 1,
        unknown = unknown + CASE WHEN NEW.country IS NULL THEN 1 ELSE 0 END,
        started_at = COALESCE(started_at, NEW.seen_at),
        updated_at = MAX(COALESCE(updated_at, NEW.seen_at), NEW.seen_at)
    WHERE singleton = 1 AND changes() = 1;

  INSERT INTO country_aggregates(code, views, last_seen)
    SELECT COALESCE(NEW.country, ''), 1, NEW.seen_at WHERE changes() = 1
    ON CONFLICT(code) DO UPDATE SET
      views = views + 1, last_seen = MAX(last_seen, excluded.last_seen);

  INSERT INTO location_aggregates(id, country, region, city, latitude, longitude, views, last_seen)
    SELECT NEW.location_id, NEW.country, NEW.region, NEW.city,
           NEW.latitude, NEW.longitude, 1, NEW.seen_at WHERE changes() = 1
    ON CONFLICT(id) DO UPDATE SET
      views = views + 1, last_seen = MAX(last_seen, excluded.last_seen);
END;
