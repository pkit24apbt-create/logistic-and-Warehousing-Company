-- Adds support for multiple images per module (previously only one image
-- was possible via training_modules.media_url). Each module can now have
-- several images, shown spread through the content rather than bunched
-- in one place. Safe to re-run.

CREATE TABLE IF NOT EXISTS module_images (
    image_id    SERIAL PRIMARY KEY,
    module_id   INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    caption     VARCHAR(200),
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_module_images_module ON module_images(module_id);

-- Adds 2 additional images to each of the 3 modules, matching the exact
-- filenames saved in frontend/public/assets/photos/ (all .png, matching
-- how you uploaded them). Run after add_module_images.sql.
-- Safe to re-run — clears and re-inserts for these 3 modules only.

DELETE FROM module_images
WHERE module_id IN (
  SELECT module_id FROM training_modules
  WHERE title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness')
);

-- Manual Handling
INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/manual-handling1.png', 'Pushing a loaded trolley rather than carrying boxes by hand reduces strain on the back.', 1
FROM training_modules WHERE title = 'Manual Handling in the Warehouse';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/mannual-handling2.png', 'Discussing the safest way to move a load before starting the task.', 2
FROM training_modules WHERE title = 'Manual Handling in the Warehouse';

-- Hazard Perception
INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/hazard-perception1.png', 'A team reviewing the warehouse floor together, discussing what they observe.', 1
FROM training_modules WHERE title = 'Hazard Perception';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/hazard-perception2.png', 'Staying alert to forklift movement and overhead activity while working nearby.', 2
FROM training_modules WHERE title = 'Hazard Perception';

-- Cyber Awareness
INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/cyber-awareness1.png', 'Reviewing information on a shared device together, being mindful of who can see the screen.', 1
FROM training_modules WHERE title = 'Cyber Awareness';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/cyber-awareness2.png', 'Discussing a task using a company device out on the floor.', 2
FROM training_modules WHERE title = 'Cyber Awareness';

-- Confirm the result — each module should now show exactly 2 extra images.
SELECT m.title, COUNT(mi.image_id) AS image_count
FROM training_modules m JOIN module_images mi ON mi.module_id = m.module_id
GROUP BY m.title;