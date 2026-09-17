-- Additional realistic training content for SafeStack.
-- Run this AFTER sprint2_schema.sql. Safe to re-run — every module is only
-- inserted if a module with that exact title doesn't already exist.
--
-- This exists because a system with one demo module and no history looks
-- like an empty prototype rather than a real, in-use platform. Real
-- screenshots, real Admin/Employee dashboards, and real reports all need
-- enough underlying content to look genuinely populated.

-- Helper pattern used throughout: INSERT ... SELECT ... WHERE NOT EXISTS,
-- so this file can be re-run safely without creating duplicates.

-- ============================================================
-- Module: Fire Safety Awareness
-- ============================================================
INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Fire Safety Awareness', 'Fire Safety', 'text',
 'Every warehouse worker must know the location of the nearest two fire exits '
 || 'and the nearest fire extinguisher for their work area. In the event of a fire alarm, '
 || 'stop work immediately, leave tools and equipment where they are, and walk — do not run — '
 || 'to your designated assembly point. Never re-enter the building until a supervisor confirms it is safe. '
 || 'Fire extinguishers are colour-coded by the type of fire they are designed for: red for general fires, '
 || 'blue for electrical fires, and never use water-based extinguishers near live electrical equipment.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Fire Safety Awareness');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Fire Safety Awareness'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'What should you do first when a fire alarm sounds?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Fire Safety Awareness'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Stop work and walk calmly to the assembly point', TRUE),
  ('Finish the task you are working on first', FALSE),
  ('Run to the nearest exit as fast as possible', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Fire Safety Awareness'
AND qq.question_text = 'What should you do first when a fire alarm sounds?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

-- ============================================================
-- Module: Forklift Truck Operation Basics
-- ============================================================
INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Forklift Truck Operation Basics', 'Vehicle Safety', 'text',
 'Only trained and certified personnel may operate a forklift truck. Before starting a shift, '
 || 'complete the pre-use checklist: check tyres, brakes, horn, lights, and the condition of the forks. '
 || 'Always wear a seatbelt when operating the vehicle. Never carry a load that exceeds the rated capacity '
 || 'shown on the data plate, and always travel with the forks lowered when not carrying a load. '
 || 'Pedestrians always have right of way — sound the horn at blind corners and junctions.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Forklift Truck Operation Basics');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Forklift Truck Operation Basics'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'When should you sound the horn while driving a forklift?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Forklift Truck Operation Basics'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('At blind corners and junctions', TRUE),
  ('Only when carrying a full load', FALSE),
  ('Never — it distracts other workers', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Forklift Truck Operation Basics'
AND qq.question_text = 'When should you sound the horn while driving a forklift?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

-- ============================================================
-- Module: Personal Protective Equipment (PPE)
-- ============================================================
INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Personal Protective Equipment (PPE)', 'PPE', 'text',
 'High-visibility vests must be worn at all times on the warehouse floor. Safety boots with '
 || 'reinforced toe caps are mandatory in all loading and racking areas. Hearing protection is required '
 || 'in zones marked with a hearing-protection sign, and gloves must be worn when handling sharp or '
 || 'abrasive materials. PPE is provided free of charge — report any damaged or worn equipment to your '
 || 'supervisor immediately rather than continuing to use it.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Personal Protective Equipment (PPE)');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Personal Protective Equipment (PPE)'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'What should you do if your safety boots become damaged?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Personal Protective Equipment (PPE)'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Report it to your supervisor and get a replacement', TRUE),
  ('Keep wearing them until the end of the week', FALSE),
  ('Tape them up yourself and continue working', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Personal Protective Equipment (PPE)'
AND qq.question_text = 'What should you do if your safety boots become damaged?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

-- ============================================================
-- Module: Hazardous Substance Handling (COSHH)
-- ============================================================
INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Hazardous Substance Handling (COSHH)', 'Chemical Safety', 'text',
 'Before using any chemical or cleaning substance, check its Safety Data Sheet (SDS) for handling '
 || 'and storage instructions. Never mix chemicals unless explicitly instructed to, as combining certain '
 || 'substances can produce toxic gases. Always use the specified PPE listed on the container label, '
 || 'and ensure the area is well ventilated. Store hazardous substances in their designated, clearly '
 || 'labelled cabinets — never in unmarked containers.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Hazardous Substance Handling (COSHH)');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Hazardous Substance Handling (COSHH)'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'Where should you check before using an unfamiliar chemical?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Hazardous Substance Handling (COSHH)'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Its Safety Data Sheet (SDS)', TRUE),
  ('Ask a colleague what they usually do', FALSE),
  ('Just smell it to check if it seems safe', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Hazardous Substance Handling (COSHH)'
AND qq.question_text = 'Where should you check before using an unfamiliar chemical?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

-- ============================================================
-- Module: Warehouse Racking & Storage Safety (kept unpublished/draft on
-- purpose, so your Trainer dashboard also has a realistic "draft" example
-- rather than every module being already published)
-- ============================================================
INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Warehouse Racking & Storage Safety', 'Storage Safety', 'text',
 'Never exceed the maximum load rating shown on a racking bay''s load notice. Heavier items should '
 || 'always be stored on lower shelves, with lighter items higher up. Report any bent, damaged, or leaning '
 || 'racking immediately — do not attempt to load it further. Keep aisles clear of obstructions at all times '
 || 'to maintain safe access for both pedestrians and vehicles.',
 TRUE, 'draft'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Warehouse Racking & Storage Safety');