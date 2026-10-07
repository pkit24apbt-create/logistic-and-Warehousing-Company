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

  -- ============================================================================
-- Sprint 5: advanced puzzle system  (SAFE TO RUN MORE THAN ONCE)
--
-- Keeps the existing tables so progress, competency, certificates and all six
-- reports keep working, and adds:
--   * four puzzle types: hazard_hunt, hazard_hunt_360, sequence, match
--   * attempts limits (per rolling 24 hours) and optional timed challenges
--   * hazard severity (points) and per-hazard radius
--   * server-side puzzle sessions (anti-cheat)
--   * wrong marks and duration recorded on every attempt
--
-- Existing puzzles are NOT changed: they stay "hazard_hunt" with unlimited
-- attempts and no timer, exactly as before.
-- Run in pgAdmin: Tools > Query Tool > paste > Execute (F5).
-- ============================================================================

-- 1. Puzzle settings live on hazard_scenes (one row = one puzzle) ------------
ALTER TABLE hazard_scenes ADD COLUMN IF NOT EXISTS puzzle_type    VARCHAR(20) NOT NULL DEFAULT 'hazard_hunt';
ALTER TABLE hazard_scenes ADD COLUMN IF NOT EXISTS time_limit_sec INTEGER;
ALTER TABLE hazard_scenes ADD COLUMN IF NOT EXISTS config         TEXT NOT NULL DEFAULT '{}';
ALTER TABLE hazard_scenes ALTER COLUMN image_url DROP NOT NULL;   -- sequence / match puzzles have no image

DO $$
BEGIN
  -- Existing puzzles keep unlimited attempts (0); NEW puzzles default to 3 per 24 hours.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'hazard_scenes' AND column_name = 'max_attempts') THEN
    ALTER TABLE hazard_scenes ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE hazard_scenes ALTER COLUMN max_attempts SET DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hazard_scenes_puzzle_type_check') THEN
    ALTER TABLE hazard_scenes
      ADD CONSTRAINT hazard_scenes_puzzle_type_check
      CHECK (puzzle_type IN ('hazard_hunt', 'hazard_hunt_360', 'sequence', 'match'));
  END IF;
END $$;

-- 2. Hazards: severity and an optional "how close counts" radius -------------
ALTER TABLE hazard_hotspots ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 1;   -- 1 minor, 2 serious, 3 critical
ALTER TABLE hazard_hotspots ADD COLUMN IF NOT EXISTS radius NUMERIC(5,2);                 -- NULL = default (8)

-- 3. Attempts: what happened, and how long it took ---------------------------
ALTER TABLE hazard_attempts ADD COLUMN IF NOT EXISTS wrong_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hazard_attempts ADD COLUMN IF NOT EXISTS duration_sec INTEGER;
ALTER TABLE hazard_attempts ADD COLUMN IF NOT EXISTS timed_out    BOOLEAN NOT NULL DEFAULT FALSE;

-- Deleting a puzzle used to fail whenever anyone had attempted it (the attempts
-- row blocked it). Attempts now go with the puzzle; the app asks for confirmation.
ALTER TABLE hazard_attempts DROP CONSTRAINT IF EXISTS hazard_attempts_scene_id_fkey;
ALTER TABLE hazard_attempts
  ADD CONSTRAINT hazard_attempts_scene_id_fkey
  FOREIGN KEY (scene_id) REFERENCES hazard_scenes(scene_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_hazard_attempts_scene_user ON hazard_attempts(scene_id, user_id, attempted_at);

-- 4. Steps (sequence) and items to sort (match) ------------------------------
CREATE TABLE IF NOT EXISTS puzzle_items (
    item_id     SERIAL PRIMARY KEY,
    scene_id    INTEGER NOT NULL REFERENCES hazard_scenes(scene_id) ON DELETE CASCADE,
    item_key    VARCHAR(16) NOT NULL,       -- random id sent to the browser; reveals nothing about the order
    position    INTEGER NOT NULL,           -- the correct position (sequence puzzles)
    item_text   TEXT NOT NULL,
    explanation TEXT,
    category    VARCHAR(60),                -- the correct category (match puzzles)
    UNIQUE (scene_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_puzzle_items_scene ON puzzle_items(scene_id);

-- 5. Puzzle sessions: the server remembers when each attempt started ---------
CREATE TABLE IF NOT EXISTS puzzle_sessions (
    session_token VARCHAR(40) PRIMARY KEY,
    scene_id      INTEGER NOT NULL REFERENCES hazard_scenes(scene_id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    submitted_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_user ON puzzle_sessions(scene_id, user_id);

-- Confirm
SELECT puzzle_type, COUNT(*) AS puzzles FROM hazard_scenes GROUP BY puzzle_type;

-- ============================================================================
-- Sprint 5: DEMO PUZZLES  (optional - run sprint5_puzzles.sql FIRST)
--
-- Creates ONE new module, "Safety Puzzle Challenge", holding one example of
-- every puzzle type, and assigns it to every active employee. Your existing
-- modules are not touched, so nobody who has already finished them is affected.
-- Safe to run more than once. To remove the demo later:
--   DELETE FROM training_modules WHERE title = 'Safety Puzzle Challenge';
-- ============================================================================

-- 1. The demo module (no quiz: it completes when every puzzle has been played) ----
INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Safety Puzzle Challenge', 'Puzzle Demo', 'text',
       'Four short puzzles that test what you know: find the risks inside the 360 degree warehouse, '
    || 'put the safe lifting steps in order, race the clock on the evacuation steps, and sort controls '
    || 'by type. Wrong marks cost points, so look carefully before you click.',
       FALSE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Safety Puzzle Challenge');

-- 2. Puzzle 1 - 360 degree hazard hunt on the warehouse panorama --------------------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec)
SELECT m.module_id, '360 Risk Walk: Warehouse Floor', '/assets/photos/warehouse-360-preview.png',
       'Drag to look all the way around the warehouse. Click where you see a risk. You can place a few more marks than there are risks, but every wrong mark costs 10 points.',
       'hazard_hunt_360', 3, NULL
FROM training_modules m
WHERE m.title = 'Safety Puzzle Challenge'
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = '360 Risk Walk: Warehouse Floor');

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation, points, radius)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation, h.points, h.radius
FROM hazard_scenes s
CROSS JOIN (VALUES
  (33.5, 52.5, 'Forklift working in the aisle',
   'Forklifts and pedestrians share this aisle. Stay inside the marked walkway, make eye contact with the driver before crossing, and never walk behind a moving truck.', 3, 8.0),
  (84.0, 47.0, 'Loading dock with a truck backed in',
   'Reversing vehicles, open dock edges and moving trailers make the dock one of the most dangerous areas. Keep clear of the dock edge and use a banksman or signals.', 3, 9.0),
  (72.0, 54.0, 'Powered pallet truck being driven',
   'Pallet trucks are heavy and silent. Never ride on one, keep your feet clear of the wheels, and give the operator space to stop.', 2, 8.0),
  (47.0, 17.0, 'Heavy pallets stored at the top of the racking',
   'Loads stored at height can fall if they are damaged or poorly stacked. Check pallets are stable, within the beam rating, and never stand underneath a load being moved.', 2, 9.0),
  (58.5, 54.5, 'Goods stored on the floor beside the walkway',
   'Stock left outside the racking is a trip hazard and narrows the walkway. Everything should be returned to its marked storage area.', 1, 9.0)
) AS h(x, y, label, explanation, points, radius)
WHERE s.title = '360 Risk Walk: Warehouse Floor'
  AND NOT EXISTS (SELECT 1 FROM hazard_hotspots x WHERE x.scene_id = s.scene_id);

-- 3. Puzzle 2 - sequence: safe lifting procedure -----------------------------------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec)
SELECT m.module_id, 'Safe Lifting: Put the Steps in Order', NULL,
       'Use the arrows (or drag the steps) to put the lifting procedure into the correct order, first step at the top.',
       'sequence', 3, NULL
FROM training_modules m
WHERE m.title = 'Safety Puzzle Challenge'
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Safe Lifting: Put the Steps in Order');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl
FROM hazard_scenes s
CROSS JOIN (VALUES
  (1, 'Stop and assess the load: its weight, shape and where it is going.',
      'Never lift before you know what you are lifting. If it looks too heavy or awkward, get help or use equipment.'),
  (2, 'Plan the route and clear any obstructions or trip hazards.',
      'Check the whole route, including doors and steps, before you pick the load up.'),
  (3, 'Stand close to the load, feet shoulder-width apart, one foot slightly forward.',
      'A stable base keeps the load close to your body and your balance steady.'),
  (4, 'Bend your knees, keep your back straight, and get a firm grip.',
      'Let your legs do the work. A rounded back puts dangerous strain on the spine.'),
  (5, 'Lift smoothly with your legs, keeping the load close to your body.',
      'Jerking the load or holding it away from your body multiplies the force on your back.'),
  (6, 'Move your feet to turn. Never twist your body while carrying.',
      'Twisting under load is a leading cause of back injury.'),
  (7, 'Lower the load in the same controlled way and position it safely.',
      'Setting down badly causes as many injuries as lifting badly.')
) AS v(pos, txt, expl)
WHERE s.title = 'Safe Lifting: Put the Steps in Order'
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 4. Puzzle 3 - timed sequence: emergency evacuation (2 minute challenge) ----------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec)
SELECT m.module_id, 'Timed Challenge: Emergency Evacuation', NULL,
       'You have 2 minutes. Put the evacuation steps in the correct order before the clock runs out.',
       'sequence', 3, 120
FROM training_modules m
WHERE m.title = 'Safety Puzzle Challenge'
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Timed Challenge: Emergency Evacuation');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl
FROM hazard_scenes s
CROSS JOIN (VALUES
  (1, 'Raise the alarm (break glass point or shout a warning).',
      'Warn everyone first so they can start to leave.'),
  (2, 'Stop work and make equipment safe, but only if it is safe to do so.',
      'Switch off machinery and park vehicles. Never put yourself at risk to do this.'),
  (3, 'Leave by the nearest safe exit. Do not use the lifts.',
      'Walk, do not run, and keep emergency routes clear for others.'),
  (4, 'Go to the assembly point.',
      'Move well away from the building so emergency services can get in.'),
  (5, 'Report to the fire warden and do not re-enter until told it is safe.',
      'The warden checks everyone is accounted for. Going back inside costs lives.')
) AS v(pos, txt, expl)
WHERE s.title = 'Timed Challenge: Emergency Evacuation'
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 5. Puzzle 4 - match: hierarchy of controls ---------------------------------------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, 'Match the Control Measure', NULL,
       'Safety experts rank controls: first remove the hazard, then protect people with equipment or design, and use personal protective equipment last. Sort each action into the right type.',
       'match', 3, NULL,
       '{"categories":["Eliminate the hazard","Engineering control","PPE"]}'
FROM training_modules m
WHERE m.title = 'Safety Puzzle Challenge'
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Match the Control Measure');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation, category)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl, v.cat
FROM hazard_scenes s
CROSS JOIN (VALUES
  (1, 'Remove the boxes from the pedestrian walkway',
      'Eliminate the hazard: if the trip risk is gone, nobody can trip on it.', 'Eliminate the hazard'),
  (2, 'Fit guard rails along the edge of the loading dock',
      'An engineering control: a physical barrier protects everyone without relying on their behaviour.', 'Engineering control'),
  (3, 'Wear safety boots in the warehouse',
      'PPE protects only the wearer and is the last line of defence.', 'PPE'),
  (4, 'Stop storing stock on the floor and use the racking',
      'Eliminate the hazard: removing the obstacle removes the risk.', 'Eliminate the hazard'),
  (5, 'Fit speed limiters to the forklifts',
      'An engineering control: the equipment itself reduces the risk.', 'Engineering control'),
  (6, 'Wear a hi-vis vest when walking in vehicle areas',
      'PPE: it makes you seen but does not stop a collision.', 'PPE'),
  (7, 'Install a barrier between the walkway and the forklift lane',
      'An engineering control: it separates people from vehicles.', 'Engineering control'),
  (8, 'Wear gloves when handling sharp metal parts',
      'PPE: it protects the hands but the sharp edge is still there.', 'PPE')
) AS v(pos, txt, expl, cat)
WHERE s.title = 'Match the Control Measure'
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 6. Give the demo module to every active employee ---------------------------------
INSERT INTO module_assignments (module_id, user_id, assigned_by)
SELECT m.module_id, u.user_id, NULL
FROM training_modules m
CROSS JOIN users u
JOIN roles r ON r.role_id = u.role_id
WHERE m.title = 'Safety Puzzle Challenge' AND r.role_name = 'employee' AND u.status = 'active'
ON CONFLICT (module_id, user_id) DO NOTHING;

-- Confirm
SELECT s.title, s.puzzle_type, s.max_attempts, s.time_limit_sec,
       (SELECT COUNT(*) FROM hazard_hotspots h WHERE h.scene_id = s.scene_id) AS hazards,
       (SELECT COUNT(*) FROM puzzle_items i WHERE i.scene_id = s.scene_id)    AS items
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
WHERE m.title = 'Safety Puzzle Challenge' ORDER BY s.scene_id;

DELETE FROM training_modules WHERE title = 'Safety Puzzle Challenge';

-- ============================================================================
-- Sprint 5: puzzles inside YOUR EXISTING MODULES  (run sprint5_puzzles.sql FIRST)
--
-- Adds new puzzles (all four types) to the three modules you already have:
--   Manual Handling in the Warehouse : 2 puzzles (put the lifting steps in order, lift/equipment/help)
--   Hazard Perception                : 3 puzzles (360 degree risk walk, control measures, timed evacuation)
--   Cyber Awareness                  : 2 puzzles (timed phishing response, safe or unsafe online)
--
-- No new module is created. Safe to run more than once: a puzzle that already exists
-- (same title on the same module) is skipped.
--
-- Note: employees must play every puzzle on a module to complete it. Anyone who had
-- already finished one of these modules is marked complete again the next time they
-- submit something, only after they have played the new puzzles.
-- ============================================================================

-- 1. Manual Handling in the Warehouse: Safe Lifting: Put the Steps in Order  (sequence) ------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, 'Safe Lifting: Put the Steps in Order', NULL,
       'Use the arrows (or drag the steps) to put the lifting procedure into the correct order, first step at the top.',
       'sequence', 3, NULL, '{}'
FROM (SELECT (SELECT module_id FROM training_modules WHERE title ILIKE '%manual handling%' ORDER BY module_id LIMIT 1) AS module_id) m
WHERE m.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Safe Lifting: Put the Steps in Order');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
CROSS JOIN (VALUES
  (1, 'Stop and assess the load: its weight, shape and where it is going.',
      'Never lift before you know what you are lifting. If it looks too heavy or awkward, get help or use equipment.'),
  (2, 'Plan the route and clear any obstructions or trip hazards.',
      'Check the whole route, including doors and steps, before you pick the load up.'),
  (3, 'Stand close to the load, feet shoulder-width apart, one foot slightly forward.',
      'A stable base keeps the load close to your body and your balance steady.'),
  (4, 'Bend your knees, keep your back straight, and get a firm grip.',
      'Let your legs do the work. A rounded back puts dangerous strain on the spine.'),
  (5, 'Lift smoothly with your legs, keeping the load close to your body.',
      'Jerking the load or holding it away from your body multiplies the force on your back.'),
  (6, 'Move your feet to turn. Never twist your body while carrying.',
      'Twisting under load is a leading cause of back injury.'),
  (7, 'Lower the load in the same controlled way and position it safely.',
      'Setting down badly causes as many injuries as lifting badly.')
) AS v(pos, txt, expl)
WHERE s.title = 'Safe Lifting: Put the Steps in Order' AND m.module_id = (SELECT module_id FROM training_modules WHERE title ILIKE '%manual handling%' ORDER BY module_id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 2. Manual Handling in the Warehouse: Lift Alone, Use Equipment, or Get Help?  (match) ------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, 'Lift Alone, Use Equipment, or Get Help?', NULL,
       'Decide how each load should be moved. Think about its weight, its shape and how far and how often it has to go.',
       'match', 3, NULL, '{"categories":["Lift it yourself","Use equipment","Get help"]}'
FROM (SELECT (SELECT module_id FROM training_modules WHERE title ILIKE '%manual handling%' ORDER BY module_id LIMIT 1) AS module_id) m
WHERE m.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Lift Alone, Use Equipment, or Get Help?');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation, category)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl, v.cat
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
CROSS JOIN (VALUES
  (1, 'A 3 kg box of small parts moved from the bench to a shelf at waist height',
      'Light, compact and a short move at a comfortable height: safe to lift on your own using good technique.', 'Lift it yourself'),
  (2, 'A full pallet of boxes that has to go to the loading dock',
      'Far too heavy to lift. A pallet truck does the work and removes the risk completely.', 'Use equipment'),
  (3, 'A bulky 30 kg engine cover that is too wide to hold close to your body',
      'Heavy and awkward: a two-person lift keeps the load close to both bodies and shares the weight.', 'Get help'),
  (4, 'Twenty cartons to move from a lorry to the racking',
      'Repeated lifting adds up. A trolley or conveyor avoids the strain of doing it twenty times.', 'Use equipment'),
  (5, 'A 5 kg tool carried two metres to the next bench',
      'A light load over a very short distance is fine with good lifting technique.', 'Lift it yourself'),
  (6, 'A 3 metre steel bar that is heavy and could bend as you lift it',
      'Long loads are unstable. Two people (one at each end) keep it level and under control.', 'Get help'),
  (7, 'A heavy drum of oil that must be moved across the warehouse',
      'A drum trolley moves it safely and stops it tipping or rolling.', 'Use equipment'),
  (8, 'A 2 kg bag of fixings put on a mid-height shelf',
      'Very light and easy to hold: no help or equipment needed.', 'Lift it yourself')
) AS v(pos, txt, expl, cat)
WHERE s.title = 'Lift Alone, Use Equipment, or Get Help?' AND m.module_id = (SELECT module_id FROM training_modules WHERE title ILIKE '%manual handling%' ORDER BY module_id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 3. Hazard Perception: 360 Risk Walk: Warehouse Floor  (hazard_hunt_360) ------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, '360 Risk Walk: Warehouse Floor', '/assets/photos/warehouse-360-preview.png',
       'Drag to look all the way around the warehouse. Click where you see a risk. You can place a few more marks than there are risks, but every wrong mark costs 10 points.',
       'hazard_hunt_360', 3, NULL, '{}'
FROM (SELECT (SELECT module_id FROM training_modules WHERE title ILIKE '%hazard perception%' ORDER BY module_id LIMIT 1) AS module_id) m
WHERE m.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = '360 Risk Walk: Warehouse Floor');

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation, points, radius)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation, h.points, h.radius
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
CROSS JOIN (VALUES
  (33.5, 52.5, 'Forklift working in the aisle',
   'Forklifts and pedestrians share this aisle. Stay inside the marked walkway, make eye contact with the driver before crossing, and never walk behind a moving truck.', 3, 8.0),
  (84.0, 47.0, 'Loading dock with a truck backed in',
   'Reversing vehicles, open dock edges and moving trailers make the dock one of the most dangerous areas. Keep clear of the dock edge and use a banksman or signals.', 3, 9.0),
  (72.0, 54.0, 'Powered pallet truck being driven',
   'Pallet trucks are heavy and silent. Never ride on one, keep your feet clear of the wheels, and give the operator space to stop.', 2, 8.0),
  (47.0, 17.0, 'Heavy pallets stored at the top of the racking',
   'Loads stored at height can fall if they are damaged or poorly stacked. Check pallets are stable, within the beam rating, and never stand underneath a load being moved.', 2, 9.0),
  (58.5, 54.5, 'Goods stored on the floor beside the walkway',
   'Stock left outside the racking is a trip hazard and narrows the walkway. Everything should be returned to its marked storage area.', 1, 9.0)
) AS h(x, y, label, explanation, points, radius)
WHERE s.title = '360 Risk Walk: Warehouse Floor' AND m.module_id = (SELECT module_id FROM training_modules WHERE title ILIKE '%hazard perception%' ORDER BY module_id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM hazard_hotspots x WHERE x.scene_id = s.scene_id);

-- 4. Hazard Perception: Match the Control Measure  (match) ------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, 'Match the Control Measure', NULL,
       'Safety experts rank controls: first remove the hazard, then protect people with equipment or design, and use personal protective equipment last. Sort each action into the right type.',
       'match', 3, NULL, '{"categories":["Eliminate the hazard","Engineering control","PPE"]}'
FROM (SELECT (SELECT module_id FROM training_modules WHERE title ILIKE '%hazard perception%' ORDER BY module_id LIMIT 1) AS module_id) m
WHERE m.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Match the Control Measure');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation, category)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl, v.cat
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
CROSS JOIN (VALUES
  (1, 'Remove the boxes from the pedestrian walkway',
      'Eliminate the hazard: if the trip risk is gone, nobody can trip on it.', 'Eliminate the hazard'),
  (2, 'Fit guard rails along the edge of the loading dock',
      'An engineering control: a physical barrier protects everyone without relying on their behaviour.', 'Engineering control'),
  (3, 'Wear safety boots in the warehouse',
      'PPE protects only the wearer and is the last line of defence.', 'PPE'),
  (4, 'Stop storing stock on the floor and use the racking',
      'Eliminate the hazard: removing the obstacle removes the risk.', 'Eliminate the hazard'),
  (5, 'Fit speed limiters to the forklifts',
      'An engineering control: the equipment itself reduces the risk.', 'Engineering control'),
  (6, 'Wear a hi-vis vest when walking in vehicle areas',
      'PPE: it makes you seen but does not stop a collision.', 'PPE'),
  (7, 'Install a barrier between the walkway and the forklift lane',
      'An engineering control: it separates people from vehicles.', 'Engineering control'),
  (8, 'Wear gloves when handling sharp metal parts',
      'PPE: it protects the hands but the sharp edge is still there.', 'PPE')
) AS v(pos, txt, expl, cat)
WHERE s.title = 'Match the Control Measure' AND m.module_id = (SELECT module_id FROM training_modules WHERE title ILIKE '%hazard perception%' ORDER BY module_id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 5. Hazard Perception: Timed Challenge: Emergency Evacuation  (sequence, timed 120s) ------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, 'Timed Challenge: Emergency Evacuation', NULL,
       'You have 2 minutes. Put the evacuation steps in the correct order before the clock runs out.',
       'sequence', 3, 120, '{}'
FROM (SELECT (SELECT module_id FROM training_modules WHERE title ILIKE '%hazard perception%' ORDER BY module_id LIMIT 1) AS module_id) m
WHERE m.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Timed Challenge: Emergency Evacuation');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
CROSS JOIN (VALUES
  (1, 'Raise the alarm (break glass point or shout a warning).',
      'Warn everyone first so they can start to leave.'),
  (2, 'Stop work and make equipment safe, but only if it is safe to do so.',
      'Switch off machinery and park vehicles. Never put yourself at risk to do this.'),
  (3, 'Leave by the nearest safe exit. Do not use the lifts.',
      'Walk, do not run, and keep emergency routes clear for others.'),
  (4, 'Go to the assembly point.',
      'Move well away from the building so emergency services can get in.'),
  (5, 'Report to the fire warden and do not re-enter until told it is safe.',
      'The warden checks everyone is accounted for. Going back inside costs lives.')
) AS v(pos, txt, expl)
WHERE s.title = 'Timed Challenge: Emergency Evacuation' AND m.module_id = (SELECT module_id FROM training_modules WHERE title ILIKE '%hazard perception%' ORDER BY module_id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 6. Cyber Awareness: Timed Challenge: Respond to a Phishing Email  (sequence, timed 90s) ------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, 'Timed Challenge: Respond to a Phishing Email', NULL,
       'A suspicious email has just arrived. You have 90 seconds to put the right response steps in order.',
       'sequence', 3, 90, '{}'
FROM (SELECT (SELECT module_id FROM training_modules WHERE title ILIKE '%cyber awareness%' ORDER BY module_id LIMIT 1) AS module_id) m
WHERE m.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Timed Challenge: Respond to a Phishing Email');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
CROSS JOIN (VALUES
  (1, 'Stop. Do not click any link or open any attachment.',
      'One click is all an attacker needs. If you have already clicked, tell IT straight away.'),
  (2, 'Check the sender address and look for warning signs: urgency, spelling mistakes or an unexpected request.',
      'Real organisations rarely demand that you act within minutes or ask for your password.'),
  (3, 'Do not reply to the email or forward it to colleagues.',
      'Replying confirms your address is active, and forwarding spreads the danger.'),
  (4, 'Report it using the Report Phishing button, or send it to the IT security team.',
      'Reporting protects everyone, because IT can block the sender and warn others.'),
  (5, 'Wait for IT to confirm whether the email was genuine.',
      'Do not decide for yourself. IT can check the headers and links safely.'),
  (6, 'Delete the email once IT has what they need.',
      'Deleting it last means you never lose the evidence IT may ask for.')
) AS v(pos, txt, expl)
WHERE s.title = 'Timed Challenge: Respond to a Phishing Email' AND m.module_id = (SELECT module_id FROM training_modules WHERE title ILIKE '%cyber awareness%' ORDER BY module_id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- 7. Cyber Awareness: Safe or Unsafe Online?  (match) ------
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
SELECT m.module_id, 'Safe or Unsafe Online?', NULL,
       'Sort each action into safe or unsafe behaviour. Think about what a criminal could do with each one.',
       'match', 3, NULL, '{"categories":["Safe","Unsafe"]}'
FROM (SELECT (SELECT module_id FROM training_modules WHERE title ILIKE '%cyber awareness%' ORDER BY module_id LIMIT 1) AS module_id) m
WHERE m.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM hazard_scenes s WHERE s.module_id = m.module_id AND s.title = 'Safe or Unsafe Online?');

INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation, category)
SELECT s.scene_id, substr(md5(random()::text || s.scene_id::text || v.pos::text), 1, 10), v.pos, v.txt, v.expl, v.cat
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
CROSS JOIN (VALUES
  (1, 'Using a password manager to make a different long password for each account',
      'A unique password for every account means one stolen password cannot open the others.', 'Safe'),
  (2, 'Using the same password for work and personal accounts',
      'If a shopping site is hacked, criminals try the same password on your work account.', 'Unsafe'),
  (3, 'Plugging in a USB stick you found in the car park',
      'Attackers leave infected USB sticks to be found. Hand it to IT instead.', 'Unsafe'),
  (4, 'Locking your screen whenever you leave your desk',
      'It takes a second and stops anyone using your account while you are away.', 'Safe'),
  (5, 'Sharing your password with a colleague who is off sick',
      'Passwords must never be shared. Ask IT to give your colleague the access they need.', 'Unsafe'),
  (6, 'Hovering over a link to check where it goes before clicking',
      'The real address appears when you hover. If it does not match what you expect, do not click.', 'Safe'),
  (7, 'Clicking a link in a text saying your parcel is held until you pay a small fee',
      'A classic scam: the fee page steals your card details.', 'Unsafe'),
  (8, 'Reporting a suspicious email to IT even if you are not sure',
      'IT would much rather check a harmless email than miss a dangerous one.', 'Safe')
) AS v(pos, txt, expl, cat)
WHERE s.title = 'Safe or Unsafe Online?' AND m.module_id = (SELECT module_id FROM training_modules WHERE title ILIKE '%cyber awareness%' ORDER BY module_id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM puzzle_items i WHERE i.scene_id = s.scene_id);

-- Confirm: every new puzzle, with the module it was added to
SELECT m.title AS module, s.title AS puzzle, s.puzzle_type, s.max_attempts, s.time_limit_sec,
       (SELECT COUNT(*) FROM hazard_hotspots h WHERE h.scene_id = s.scene_id) AS hazards,
       (SELECT COUNT(*) FROM puzzle_items i WHERE i.scene_id = s.scene_id)    AS items
FROM hazard_scenes s
JOIN training_modules m ON m.module_id = s.module_id
WHERE s.puzzle_type IN ('sequence', 'match', 'hazard_hunt_360')
ORDER BY m.title, s.scene_id;