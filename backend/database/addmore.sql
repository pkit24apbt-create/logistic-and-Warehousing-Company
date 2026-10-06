-- Sprint 3 completion: adds competency level tracking, the one remaining
-- item from the SRS's Sprint 3 requirements ("Progress tracking... will
-- record: ...Competency level").

CREATE TABLE IF NOT EXISTS competency_levels (
    competency_id   SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    module_id       INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    level           VARCHAR(20) NOT NULL DEFAULT 'novice' CHECK (level IN ('novice', 'competent', 'proficient')),
    overall_score   INTEGER,
    calculated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_competency_user ON competency_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_competency_module ON competency_levels(module_id);

-- Adds optional 3D coordinates to your existing hazard_hotspots table, so
-- the SAME hazard data (label + explanation) used by the 2D photo puzzle
-- can ALSO be placed as real markers in the 3D warehouse model. A hotspot
-- can have a 2D position (x_percent/y_percent, for the photo), a 3D
-- position (x_3d/y_3d/z_3d, for the model), or both — nothing about the
-- existing 2D puzzles changes.

ALTER TABLE hazard_hotspots ADD COLUMN IF NOT EXISTS x_3d NUMERIC(6,2);
ALTER TABLE hazard_hotspots ADD COLUMN IF NOT EXISTS y_3d NUMERIC(6,2);
ALTER TABLE hazard_hotspots ADD COLUMN IF NOT EXISTS z_3d NUMERIC(6,2);

UPDATE hazard_hotspots SET x_3d = -3.5, y_3d = 0.6, z_3d = -2.0
WHERE label = 'Unmarked walkway obstruction'
AND scene_id = (SELECT scene_id FROM hazard_scenes WHERE title = 'Spot the Hazards: Warehouse Floor');

UPDATE hazard_hotspots SET x_3d = 2.0, y_3d = 2.2, z_3d = -4.0
WHERE label = 'Racking overload'
AND scene_id = (SELECT scene_id FROM hazard_scenes WHERE title = 'Spot the Hazards: Warehouse Floor');

UPDATE hazard_hotspots SET x_3d = 4.0, y_3d = 0.8, z_3d = 1.5
WHERE label = 'Forklift operating near pedestrians'
AND scene_id = (SELECT scene_id FROM hazard_scenes WHERE title = 'Spot the Hazards: Warehouse Floor');

UPDATE hazard_hotspots SET x_3d = -2.0, y_3d = 1.0, z_3d = 3.5
WHERE label = 'Blocked emergency exit route'
AND scene_id = (SELECT scene_id FROM hazard_scenes WHERE title = 'Spot the Hazards: Warehouse Floor');

SELECT label, x_3d, y_3d, z_3d FROM hazard_hotspots
WHERE scene_id = (SELECT scene_id FROM hazard_scenes WHERE title = 'Spot the Hazards: Warehouse Floor');

ALTER TABLE hazard_hotspots DROP COLUMN IF EXISTS x_3d;
ALTER TABLE hazard_hotspots DROP COLUMN IF EXISTS y_3d;
ALTER TABLE hazard_hotspots DROP COLUMN IF EXISTS z_3d;

CREATE TABLE IF NOT EXISTS competency_levels (
    competency_id   SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    module_id       INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    level           VARCHAR(20) NOT NULL DEFAULT 'novice' CHECK (level IN ('novice', 'competent', 'proficient')),
    overall_score   INTEGER,
    calculated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_competency_user ON competency_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_competency_module ON competency_levels(module_id);

-- ---------------------------------------------------------------------------
-- 1. System settings (editable by the Administrator)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    setting_id     SERIAL PRIMARY KEY,
    setting_key    VARCHAR(100) NOT NULL UNIQUE,
    setting_value  VARCHAR(255) NOT NULL,
    description    VARCHAR(255),
    updated_by     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
    ('organisation_name',           'Safestack Health and Safety Training', 'Printed on every certificate'),
    ('certificate_validity_months', '12',                                   'How long a certificate stays valid (0 = never expires)'),
    ('competent_threshold',         '70',                                   'Overall module score needed for Competent'),
    ('proficient_threshold',        '85',                                   'Overall module score needed for Proficient')
ON CONFLICT (setting_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Digital certificates (one per employee per module)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
    certificate_id    SERIAL PRIMARY KEY,
    cert_code         VARCHAR(30) NOT NULL UNIQUE,
    user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    module_id         INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    competency_level  VARCHAR(20) NOT NULL CHECK (competency_level IN ('competent', 'proficient')),
    overall_score     INTEGER,
    issued_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date       DATE,
    status            VARCHAR(20) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked')),
    UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_module ON certificates(module_id);

-- ---------------------------------------------------------------------------
-- 3. Backfill: certificates for modules already completed at Competent or
--    Proficient level before this sprint existed.
-- ---------------------------------------------------------------------------
INSERT INTO certificates (cert_code, user_id, module_id, competency_level, overall_score, issued_date, expiry_date)
SELECT
    'SS-' || to_char(NOW(), 'YYYY') || '-' || upper(substr(md5(random()::text || cl.user_id::text || '-' || cl.module_id::text), 1, 8)),
    cl.user_id,
    cl.module_id,
    cl.level,
    cl.overall_score,
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '12 months')::date
FROM competency_levels cl
JOIN module_progress mp
  ON mp.user_id = cl.user_id AND mp.module_id = cl.module_id AND mp.status = 'completed'
WHERE cl.level IN ('competent', 'proficient')
ON CONFLICT (user_id, module_id) DO NOTHING;

-- Confirm.
SELECT setting_key, setting_value FROM system_settings ORDER BY setting_id;
SELECT c.cert_code, u.full_name, m.title, c.competency_level, c.expiry_date
FROM certificates c
JOIN users u ON u.user_id = c.user_id
JOIN training_modules m ON m.module_id = c.module_id
ORDER BY c.certificate_id;

-- Virtual Tour markers for the Blender panorama (generated by safestack_warehouse_scene.py)
-- Keep a copy of the current markers first (only created once, so re-running never overwrites it).
CREATE TABLE IF NOT EXISTS tour_hotspots_backup AS SELECT * FROM tour_hotspots;
DELETE FROM tour_hotspots;
INSERT INTO tour_hotspots (x_percent, y_percent, label, description, sort_order) VALUES
  (22.85, 49.14, 'Loading Dock', 'Goods arrive and leave here. Keep the doors and the bollard zone clear, and never walk behind a reversing vehicle.', 0),
  (39.68, 44.67, 'Racking Aisle', 'Pallets are stored on beam racking up to six metres high. Check load stability and never climb the racking.', 1),
  (72.86, 47.87, 'Emergency Exit', 'This exit and the route to it must stay clear at all times so everyone can leave quickly in an emergency.', 2),
  (62.50, 51.50, 'Forklift Operating Zone', 'Forklifts work in this area. Stay on the marked walkway, make eye contact with the driver and obey the speed limit.', 3),
  (12.50, 61.15, 'Pedestrian Walkway', 'The yellow lines mark the safe route for people on foot. Nothing may be stored or left inside the lines.', 4);