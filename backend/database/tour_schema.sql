-- Sprint 3 addition: 360° Warehouse Tour hotspots.
-- One shared, global tour (not per-module) that every logged-in user can
-- open from their dashboard, regardless of role. Run after sprint3_schema.sql.
-- Safe to re-run — idempotent.

CREATE TABLE IF NOT EXISTS tour_hotspots (
    hotspot_id  SERIAL PRIMARY KEY,
    x_percent   NUMERIC(5,2) NOT NULL,
    y_percent   NUMERIC(5,2) NOT NULL,
    label       VARCHAR(200) NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO tour_hotspots (x_percent, y_percent, label, description, sort_order)
SELECT * FROM (VALUES
  (12.0, 55.0, 'Racking Area A', 'Primary pallet racking for automotive parts. Maximum load per bay is marked on each shelf label.', 1),
  (35.0, 60.0, 'Pedestrian Walkway', 'Yellow-marked walkway separating foot traffic from vehicle lanes. Always stay within the marked lines.', 2),
  (55.0, 45.0, 'Picking & Packing Station', 'Where orders are picked, checked, and packed for dispatch. Hi-vis vests required at all times.', 3),
  (78.0, 50.0, 'Staging Area', 'Completed pallets wait here before loading. Keep this area clear of unrelated stock.', 4),
  (92.0, 40.0, 'Loading Docks', 'Vehicle loading and unloading zone. Forklifts have right of way — pedestrians must use the marked crossing.', 5)
) AS v(x_percent, y_percent, label, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM tour_hotspots);