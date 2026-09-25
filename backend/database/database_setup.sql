-- ============================================================================
-- SafeStack Complete Database Setup
-- Run this ONE file, start to finish, against a fresh empty database.
-- Creates every table, then seeds all content: 3 training modules, quizzes
-- (20 questions/5 options each), hazard puzzles (2 per module), the 360
-- warehouse tour, images, videos, and all supporting text.
--
-- Usage:
--   psql -U postgres -c "CREATE DATABASE warehouse_safety;"
--   psql -U postgres -d warehouse_safety -f master_setup.sql
-- ============================================================================


-- ============================================================================
-- SECTION: 01_schema.sql
-- ============================================================================
-- 01: Base roles and users tables.

CREATE TABLE IF NOT EXISTS roles (
    role_id   SERIAL PRIMARY KEY,
    role_name VARCHAR(30) NOT NULL UNIQUE
);

INSERT INTO roles (role_name)
SELECT * FROM (VALUES ('employee'), ('trainer'), ('supervisor'), ('administrator')) AS v(role_name)
WHERE NOT EXISTS (SELECT 1 FROM roles);

CREATE TABLE IF NOT EXISTS users (
    user_id              SERIAL PRIMARY KEY,
    role_id              INTEGER NOT NULL REFERENCES roles(role_id),
    full_name            VARCHAR(150) NOT NULL,
    email                VARCHAR(150) NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    department           VARCHAR(100),
    status               VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION: 02_sprint2_schema.sql
-- ============================================================================
-- 02: Training modules, quizzes, questions, options, attempts.

CREATE TABLE IF NOT EXISTS training_modules (
    module_id     SERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    topic         VARCHAR(120),
    content_type  VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','image','video','scenario')),
    content_body  TEXT NOT NULL,
    media_url     TEXT,
    is_mandatory  BOOLEAN NOT NULL DEFAULT TRUE,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
    trainer_id    INTEGER REFERENCES users(user_id),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id         SERIAL PRIMARY KEY,
    module_id       INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    passing_score   INTEGER NOT NULL DEFAULT 70,
    time_limit_sec  INTEGER NOT NULL DEFAULT 600
);

CREATE TABLE IF NOT EXISTS questions (
    question_id    SERIAL PRIMARY KEY,
    quiz_id        INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    question_text  TEXT NOT NULL,
    question_type  VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (question_type IN ('single','multiple')),
    sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS answer_options (
    option_id     SERIAL PRIMARY KEY,
    question_id   INTEGER NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_text   TEXT NOT NULL,
    is_correct    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id     SERIAL PRIMARY KEY,
    quiz_id        INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    score          INTEGER NOT NULL,
    passed         BOOLEAN NOT NULL,
    answers_json   JSONB,
    progress_id    INTEGER,
    attempted_at   TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION: 03_sprint3_schema.sql
-- ============================================================================
-- 03: Module assignments, hazard puzzle tables.

CREATE TABLE IF NOT EXISTS module_assignments (
    assignment_id SERIAL PRIMARY KEY,
    module_id     INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_by   INTEGER REFERENCES users(user_id),
    assigned_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (module_id, user_id)
);

CREATE TABLE IF NOT EXISTS hazard_scenes (
    scene_id    SERIAL PRIMARY KEY,
    module_id   INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    image_url   TEXT NOT NULL,
    trainer_id  INTEGER REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS hazard_hotspots (
    hotspot_id   SERIAL PRIMARY KEY,
    scene_id     INTEGER NOT NULL REFERENCES hazard_scenes(scene_id) ON DELETE CASCADE,
    x_percent    NUMERIC(5,2) NOT NULL,
    y_percent    NUMERIC(5,2) NOT NULL,
    label        VARCHAR(200) NOT NULL,
    explanation  TEXT
);

CREATE TABLE IF NOT EXISTS hazard_attempts (
    attempt_id   SERIAL PRIMARY KEY,
    scene_id     INTEGER NOT NULL REFERENCES hazard_scenes(scene_id),
    user_id      INTEGER NOT NULL REFERENCES users(user_id),
    found_count  INTEGER NOT NULL,
    total_count  INTEGER NOT NULL,
    score        INTEGER NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION: 04_sprint3b_progress_schema.sql
-- ============================================================================
-- 04: Module progress tracking.

CREATE TABLE IF NOT EXISTS module_progress (
    progress_id       SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    module_id         INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    status            VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
    percent_complete  INTEGER NOT NULL DEFAULT 0,
    completed_at      TIMESTAMP,
    UNIQUE (user_id, module_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quiz_attempts_progress_id_fkey'
  ) THEN
    ALTER TABLE quiz_attempts
      ADD CONSTRAINT quiz_attempts_progress_id_fkey
      FOREIGN KEY (progress_id) REFERENCES module_progress(progress_id);
  END IF;
END $$;


-- ============================================================================
-- SECTION: 05_sprint3_tour_schema.sql
-- ============================================================================
-- 05: 360-degree warehouse tour hotspots.

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
  (92.0, 40.0, 'Loading Docks', 'Vehicle loading and unloading zone. Forklifts have right of way. Pedestrians must use the marked crossing.', 5)
) AS v(x_percent, y_percent, label, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM tour_hotspots);


-- ============================================================================
-- SECTION: 06_fix_cascade_robust.sql
-- ============================================================================
-- 06: Ensures quiz_attempts.quiz_id cascades correctly on delete, whatever
-- the existing constraint happens to be named.

DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'quiz_attempts'
      AND kcu.column_name = 'quiz_id'
      AND tc.constraint_type = 'FOREIGN KEY';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE quiz_attempts DROP CONSTRAINT %I', constraint_name_var);
    END IF;

    ALTER TABLE quiz_attempts
      ADD CONSTRAINT quiz_attempts_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE;
END $$;


-- ============================================================================
-- SECTION: 07_fix_hazard_scenes_column.sql
-- ============================================================================
-- 07: Ensures hazard_scenes uses trainer_id (safety net; the CREATE TABLE
-- in script 03 already uses trainer_id directly, so this is a no-op on a
-- fresh database, but harmless to run).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hazard_scenes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE hazard_scenes RENAME COLUMN created_by TO trainer_id;
  END IF;
END $$;


-- ============================================================================
-- SECTION: 08_recover_three_modules.sql
-- ============================================================================
-- 08: Creates the 3 official modules, their quizzes (1 starter question
-- each), and the Hazard Perception puzzle. Safe to re-run.

INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Manual Handling in the Warehouse', 'Manual Handling', 'text',
 'Poor manual handling technique is one of the leading causes of workplace injury. Before lifting anything, '
 || 'assess the load: check its weight, size, and whether it has stable handholds. If a load looks too heavy '
 || 'or awkward to lift alone, ask for help or use lifting equipment such as a trolley or pallet truck. When '
 || 'lifting, keep your feet shoulder-width apart, bend your knees rather than your back, keep the load close '
 || 'to your body, and lift smoothly using your legs rather than jerking upward. Never twist your body while '
 || 'holding a load, turn your whole body by moving your feet instead. Break down large or heavy loads into '
 || 'smaller ones where possible, and take regular breaks during repetitive lifting tasks to avoid fatigue-related '
 || 'injury. Report any back or muscle strain to your supervisor immediately rather than continuing to work through it.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Manual Handling in the Warehouse');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Manual Handling in the Warehouse'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'What is the correct way to lift a heavy load from the floor?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Manual Handling in the Warehouse'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Bend your knees and keep the load close to your body', TRUE),
  ('Bend at the waist and keep your legs straight', FALSE),
  ('Twist your upper body to pick it up faster', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse'
AND qq.question_text = 'What is the correct way to lift a heavy load from the floor?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Hazard Perception', 'Hazard Perception', 'text',
 'Hazard perception is the ability to notice a developing risk before it leads to an accident, it is a skill '
 || 'that improves with deliberate practice and attention. A hazard is anything with the potential to cause harm: '
 || 'a spill on the floor, an overloaded shelf, a trailing cable, or a forklift reversing without a spotter. '
 || 'Train yourself to actively scan your work area rather than walking through it on autopilot, check floor '
 || 'surfaces, storage heights, lighting, and the movement of vehicles and people around you. Common warehouse '
 || 'hazards include blocked emergency exits, damaged racking, poor housekeeping (boxes or pallets left in '
 || 'walkways), and employees taking shortcuts under time pressure. When you notice a hazard, do not just work '
 || 'around it, report it to your supervisor so it can be corrected for everyone, and if it presents an immediate '
 || 'danger, cordon off the area or stop the activity until it is made safe.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Hazard Perception');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Hazard Perception'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'What should you do when you notice a hazard in your work area?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Hazard Perception'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Report it to your supervisor so it can be corrected', TRUE),
  ('Work around it quietly so as not to slow things down', FALSE),
  ('Ignore it if it does not affect your own task', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Hazard Perception'
AND qq.question_text = 'What should you do when you notice a hazard in your work area?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO hazard_scenes (module_id, title, image_url)
SELECT module_id, 'Spot the Hazards: Warehouse Floor', '/assets/photos/warehouse-360-preview.png'
FROM training_modules WHERE title = 'Hazard Perception'
AND NOT EXISTS (
  SELECT 1 FROM hazard_scenes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Hazard Perception')
);

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation
FROM hazard_scenes s,
(VALUES
  (18.0, 62.0, 'Unmarked walkway obstruction', 'Boxes are stacked across the pedestrian walkway, forcing people to step into the vehicle lane to get around them.'),
  (48.0, 35.0, 'Racking overload', 'This bay is loaded well above the shelf''s marked capacity, increasing the risk of collapse.'),
  (72.0, 70.0, 'Forklift operating near pedestrians', 'The forklift is moving through an active pedestrian area without a clear line of sight or horn warning.'),
  (85.0, 45.0, 'Blocked emergency exit route', 'Pallets are stored in front of what should be a clear path to the emergency exit.')
) AS h(x, y, label, explanation)
WHERE s.module_id = (SELECT module_id FROM training_modules WHERE title = 'Hazard Perception')
AND NOT EXISTS (SELECT 1 FROM hazard_hotspots WHERE scene_id = s.scene_id);

INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Cyber Awareness', 'Cyber Awareness', 'text',
 'Cyber security is now part of everyone''s job, not just the IT department''s. This module covers four key '
 || 'areas. Cyber fundamentals: use strong, unique passwords for work systems, never share your login details '
 || 'with anyone, and lock your screen whenever you step away from a device. Safe home working: if you access '
 || 'company systems from home, use only company-approved devices and networks where possible, keep your home '
 || 'router firmware updated, and never work on sensitive company data over public Wi-Fi. Social engineering: '
 || 'attackers often try to trick people rather than break into systems directly, be suspicious of urgent '
 || 'requests for money transfers, password resets, or sensitive information, especially by email or phone, and '
 || 'verify the request through a separate, trusted channel before acting. Mobile devices: keep company data off '
 || 'personal phones where possible, enable a passcode or biometric lock on any device that accesses work email, '
 || 'and report a lost or stolen device immediately so access can be revoked. If anything looks suspicious, an '
 || 'unexpected attachment, a link, or a request that feels slightly wrong, report it rather than clicking or '
 || 'replying.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Cyber Awareness');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Cyber Awareness'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'You receive an urgent email asking you to transfer money immediately. What should you do?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Cyber Awareness'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Verify the request through a separate, trusted channel before acting', TRUE),
  ('Act immediately since the email said it was urgent', FALSE),
  ('Forward it to a colleague and let them decide', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness'
AND qq.question_text = 'You receive an urgent email asking you to transfer money immediately. What should you do?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);


-- ============================================================================
-- SECTION: 09_upgrade_module_content.sql
-- ============================================================================
-- 09: Sets each module's hero image and richer written content.

UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/manual-handling.png',
  content_body =
'Manual handling injuries, including back pain, muscle strain, and joint damage, remain one of the most common causes of lost working time in warehouse environments. Most of these injuries are entirely preventable with the right technique and the right judgement about when to ask for help or use equipment instead.

Before lifting anything, take a moment to assess the task using four simple checks: the Task itself (does it involve twisting, reaching, or repetition), the Individual doing the lift (is this within your own safe capability today), the Load (its weight, size, shape, and whether it has stable handholds), and the Environment (is the floor clear, dry, and well lit). If any of these raise concerns, stop and reconsider before you lift.

When you do lift, follow these steps every time. Stand close to the load with your feet shoulder-width apart for a stable base. Bend your knees, not your back, keeping your spine in its natural, neutral position. Get a firm grip on the load using the whole of your hand, not just your fingertips. Lift smoothly by straightening your legs, keeping the load close to your body throughout the movement. Never jerk the load upward, and never lift and twist at the same time, if you need to change direction, move your feet rather than twisting your spine.

For loads that are heavy, awkward, or need to travel any distance, use the mechanical aids provided, such as pallet trucks, trolleys, or hoists, rather than relying on manual effort. For loads too heavy or bulky for one person, always ask a colleague to team lift with you, and agree clearly who will count the lift and in which direction you will both move.

Repetitive lifting over a shift can cause fatigue-related injury even when individual lifts are within safe limits. Take regular breaks, rotate tasks with colleagues where possible, and vary your posture throughout the day.

If you feel any pain, strain, or discomfort during or after a lift, stop the task immediately and report it to your supervisor. Early reporting allows an injury to be assessed and treated before it becomes more serious, and helps identify whether the task itself needs to be redesigned to prevent the same injury happening to someone else.'
WHERE title = 'Manual Handling in the Warehouse';

UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/hazard-perception.png',
  content_body =
'A hazard is anything with the potential to cause harm, whether that is an unsafe condition in the environment, a piece of damaged equipment, or an unsafe action taken by a person. Hazard perception is the skill of noticing these risks before they lead to an accident, and like any skill, it improves with deliberate, regular practice.

The biggest barrier to good hazard perception is complacency. Walking the same route through the warehouse every day can lead to tuning out your surroundings rather than actively observing them. Make a habit of consciously scanning your work area throughout your shift, not just at the start of it, paying attention to floor surfaces, storage heights, lighting levels, and the movement of vehicles and people around you.

Common categories of warehouse hazard include obstructed walkways and emergency exits, where boxes, pallets, or equipment are left somewhere they should not be. Damaged or overloaded racking, where a shelf shows signs of bending, leaning, or carries more weight than its rated capacity. Poor housekeeping, including spills, trailing cables, or general clutter in working areas. Vehicle and pedestrian conflict, such as forklifts operating in shared spaces without clear sightlines or adequate warning signals. And unsafe behaviour, where a colleague takes a shortcut or bypasses a safety control under time pressure.

When you notice a hazard, your responsibility does not end at simply avoiding it yourself. Report it to your supervisor as soon as possible so it can be corrected for everyone who uses that area, not just for you. If the hazard presents an immediate risk of serious harm, do not wait, cordon off the area, stop the activity, or move people away from danger, and then report it.

Near misses, situations where an accident almost happened but did not, deserve exactly the same attention as actual incidents. A near miss is a warning sign that, if acted on, can prevent a real injury from happening later. Reporting near misses is not an admission of fault, it is one of the most effective tools any warehouse has for catching problems before someone gets hurt.'
WHERE title = 'Hazard Perception';

UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/cyber-awareness.png',
  content_body =
'Cyber security is no longer just the responsibility of the IT department. Every employee who logs into a company system, opens a work email, or carries a work device is a potential target, and a potential line of defence. This module covers four key areas that apply to everyone, regardless of role.

Cyber fundamentals start with your own login credentials. Use a strong, unique password for each work system rather than reusing the same one everywhere, and never share your login details with anyone, including colleagues or anyone claiming to be from IT support over the phone or email. Always lock your screen whenever you step away from your desk, even for a moment, since an unlocked, unattended device is one of the simplest ways for company data to be accessed by someone who should not have it.

Safe home and remote working matters whenever you access company systems from outside the office. Use only company-approved devices and networks wherever possible. Keep your home router firmware updated, since outdated router software is a common weak point that attackers look for. Avoid working on sensitive company data over public Wi-Fi, such as in cafes or airports, where traffic can more easily be intercepted.

Social engineering is the term for attacks that target people rather than technology directly. Attackers often impersonate a trusted source, a manager, a supplier, or even IT support, to create a false sense of urgency. Be suspicious of unexpected requests for money transfers, password resets, or sensitive information, especially when they arrive by email or phone and pressure you to act immediately. If something feels off, verify the request through a separate, trusted channel, such as calling the person directly on a known number, before taking any action.

Mobile device security is increasingly important as more work happens on phones and tablets. Keep company data off personal devices where possible, and where it is unavoidable, ensure a passcode or biometric lock is enabled on any device that can access work email or files. If a device is lost or stolen, report it immediately so access can be revoked before it is misused, rather than waiting to see if it turns up.

If anything looks suspicious, an unexpected attachment, a link that does not quite match what it claims to be, or a request that feels slightly wrong, the correct action is always to report it to your IT or security team rather than clicking, replying, or forwarding it. Reporting a false alarm costs nothing. Missing a real one can cost the whole company dearly.'
WHERE title = 'Cyber Awareness';


-- ============================================================================
-- SECTION: 10_add_question_difficulty.sql
-- ============================================================================
-- 10: Adds difficulty level to quiz questions.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) NOT NULL DEFAULT 'medium'
  CHECK (difficulty IN ('easy', 'medium', 'hard'));

UPDATE questions SET difficulty = 'medium' WHERE difficulty IS NULL;


-- ============================================================================
-- SECTION: 11_expand_content_and_quizzes.sql
-- ============================================================================
-- 11: Expands module content further and brings each quiz to 5 questions.

UPDATE training_modules SET content_body = content_body ||
'

Warehouses commonly involve additional risks beyond a single lift, and these deserve their own attention. Pushing and pulling loaded trolleys or roll cages can strain the back and shoulders just as much as lifting if done incorrectly, always push rather than pull where possible, since pushing lets you use your body weight and see where you are going. Carrying a load up or down steps significantly increases the risk of a fall, use a lift or ramp instead wherever one is available, and never carry a load that blocks your view of the steps ahead.

Certain groups of employees may need extra consideration during manual handling tasks. New starters have not yet built up the physical conditioning that experienced staff have, and should be given lighter or assisted tasks during their first weeks. Anyone recovering from a previous injury should discuss their duties with their supervisor before returning to unrestricted manual handling. Pregnant employees should never be asked to lift beyond what they are comfortable with, and adjusted duties should always be offered without question.

Your legal duty as an employee under health and safety law is to make proper use of the equipment and training provided, and to take reasonable care of your own safety and the safety of others who may be affected by what you do. Your employer''s duty is to avoid the need for hazardous manual handling wherever reasonably possible, to assess any manual handling that cannot be avoided, and to reduce the risk of injury as far as reasonably practicable. Manual handling training like this module forms a core part of meeting that duty, but it only works if the techniques are actually applied on the floor, every lift, every shift.'
WHERE title = 'Manual Handling in the Warehouse';

UPDATE training_modules SET content_body = content_body ||
'

Developing a structured approach helps turn hazard perception from a vague idea into a habit you can actually apply. One well known technique is the STOP method: Stop what you are doing for a moment, Think about what could go wrong in the task or area ahead of you, Observe your surroundings properly rather than glancing, and Proceed only once you are satisfied it is safe to continue. Running through STOP takes only a few seconds but catches a surprising number of hazards that would otherwise be missed.

It also helps to understand why hazards get missed in the first place. Normalisation of deviance happens when an unsafe condition, such as a slightly blocked walkway, persists for a while without incident, so people gradually stop noticing it as a problem at all. Time pressure narrows attention onto the immediate task and away from the wider environment. And familiarity with a route or task can create a false sense that nothing has changed since yesterday, when in fact conditions change throughout every single shift.

Consider a realistic example. A pallet of stock is left slightly overhanging the end of a racking bay overnight because it was quicker than fully re-stacking it at the end of a busy shift. Nobody walks into it that evening. The next morning, a different employee, focused on their tablet while walking the same route, collides with the corner of the pallet and suffers a shoulder injury. The hazard existed for many hours before it caused harm, and a single moment of hazard perception, by anyone who passed it, reporting an overhanging pallet, would have prevented the injury entirely. This is exactly the pattern that hazard perception training is designed to interrupt.'
WHERE title = 'Hazard Perception';

UPDATE training_modules SET content_body = content_body ||
'

Phishing emails have become increasingly sophisticated and can be difficult to distinguish from genuine communication at a glance. Look closely at the sender''s actual email address rather than just the display name, since attackers often use an address that looks similar to a real one but contains a small difference. Be cautious of generic greetings such as "Dear Customer" on messages that claim to be from someone who would normally know your name. Hover over links before clicking them, where possible, to see the actual web address they lead to, rather than trusting the visible text alone. And treat any message creating a strong sense of urgency or fear, such as threatening account suspension within hours, as an immediate warning sign rather than a reason to act quickly.

Multi factor authentication, where logging in requires both your password and a second step such as a code sent to your phone, is one of the single most effective protections against a stolen password being used successfully. Where your company systems offer multi factor authentication, always enable it, and never share a login code with anyone who contacts you asking for it, a genuine system will never need you to read a login code aloud to a person.

If you believe you may have already clicked a malicious link, entered your details on a fake site, or otherwise fallen for a phishing attempt, the correct response is to report it immediately rather than staying quiet out of embarrassment. Every minute matters in limiting the damage from a compromised account, and IT teams would always rather receive an early report that turns out to be a false alarm than discover a real breach days later because nobody said anything.'
WHERE title = 'Cyber Awareness';

UPDATE questions SET difficulty = 'medium'
WHERE quiz_id = (SELECT quiz_id FROM quizzes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Manual Handling in the Warehouse'))
AND question_text = 'What is the correct way to lift a heavy load from the floor?';

INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('What should you check before lifting an unfamiliar load?', 2, 'easy'),
  ('When should you use a mechanical aid instead of lifting manually?', 3, 'easy'),
  ('What should you do if a load needs to be carried up a staircase?', 4, 'hard'),
  ('Why can repetitive lifting cause injury even when each individual lift is within safe limits?', 5, 'hard')
) AS x(question_text, sort_order, difficulty)
WHERE m.title = 'Manual Handling in the Warehouse'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id AND question_text = x.question_text);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('its weight, size, shape, and handholds', TRUE), ('only its colour', FALSE), ('nothing, all loads are the same', FALSE)) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse' AND qq.question_text = 'What should you check before lifting an unfamiliar load?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('When a load is heavy, awkward, or needs to travel a distance', TRUE), ('Never, aids are only for very light loads', FALSE), ('Only if a supervisor is watching', FALSE)) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse' AND qq.question_text = 'When should you use a mechanical aid instead of lifting manually?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Use a lift or ramp instead wherever available', TRUE), ('Carry it quickly so less time is spent on the stairs', FALSE), ('Hold it high enough to see over the top', FALSE)) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse' AND qq.question_text = 'What should you do if a load needs to be carried up a staircase?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Fatigue builds up over the shift, increasing injury risk even for safe individual lifts', TRUE), ('It cannot cause injury if each lift is technically correct', FALSE), ('Only the very first lift of the day carries any risk', FALSE)) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse' AND qq.question_text = 'Why can repetitive lifting cause injury even when each individual lift is within safe limits?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

UPDATE questions SET difficulty = 'medium'
WHERE quiz_id = (SELECT quiz_id FROM quizzes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Hazard Perception'))
AND question_text = 'What should you do when you notice a hazard in your work area?';

INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Which of these is an example of a warehouse hazard?', 2, 'easy'),
  ('What is a near miss?', 3, 'easy'),
  ('What does the "Observe" step in the STOP method involve?', 4, 'hard'),
  ('Why might an experienced employee be more likely to miss a hazard on a familiar route?', 5, 'hard')
) AS x(question_text, sort_order, difficulty)
WHERE m.title = 'Hazard Perception'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id AND question_text = x.question_text);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Boxes left blocking a pedestrian walkway', TRUE), ('A clearly labelled fire extinguisher on the wall', FALSE), ('A forklift parked correctly in its marked bay', FALSE)) AS opt(text, correct)
WHERE m.title = 'Hazard Perception' AND qq.question_text = 'Which of these is an example of a warehouse hazard?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('A situation where an accident almost happened but did not', TRUE), ('An accident that has already caused an injury', FALSE), ('A hazard that has already been fixed', FALSE)) AS opt(text, correct)
WHERE m.title = 'Hazard Perception' AND qq.question_text = 'What is a near miss?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Actually looking properly at your surroundings rather than glancing', TRUE), ('Waiting for someone else to check first', FALSE), ('Recording the hazard on video before acting', FALSE)) AS opt(text, correct)
WHERE m.title = 'Hazard Perception' AND qq.question_text = 'What does the "Observe" step in the STOP method involve?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Familiarity can create a false sense that nothing has changed since last time', TRUE), ('Experienced employees are physically unable to see hazards', FALSE), ('Familiar routes never actually contain real hazards', FALSE)) AS opt(text, correct)
WHERE m.title = 'Hazard Perception' AND qq.question_text = 'Why might an experienced employee be more likely to miss a hazard on a familiar route?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

UPDATE questions SET difficulty = 'medium'
WHERE quiz_id = (SELECT quiz_id FROM quizzes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness'))
AND question_text = 'You receive an urgent email asking you to transfer money immediately. What should you do?';

INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('What should you do before leaving your desk, even briefly?', 2, 'easy'),
  ('Which of these is safest when working from home?', 3, 'easy'),
  ('Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?', 4, 'hard'),
  ('Why is multi factor authentication effective even if your password is stolen?', 5, 'hard')
) AS x(question_text, sort_order, difficulty)
WHERE m.title = 'Cyber Awareness'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id AND question_text = x.question_text);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Lock your screen', TRUE), ('Turn the monitor off only', FALSE), ('Nothing, it is fine for a short time', FALSE)) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness' AND qq.question_text = 'What should you do before leaving your desk, even briefly?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Using a company approved device and network', TRUE), ('Using any available public Wi-Fi', FALSE), ('Sharing your login with a family member if needed', FALSE)) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness' AND qq.question_text = 'Which of these is safest when working from home?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Refuse and report the call, a genuine request would never ask this', TRUE), ('Read the code out since they said they are from IT', FALSE), ('Text the code instead of reading it aloud', FALSE)) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness' AND qq.question_text = 'Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('The attacker still needs the second factor, such as your phone, to log in', TRUE), ('It makes your password impossible to ever guess', FALSE), ('It stops all phishing emails from being sent to you', FALSE)) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness' AND qq.question_text = 'Why is multi factor authentication effective even if your password is stolen?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);


-- ============================================================================
-- SECTION: 12_add_module_images.sql
-- ============================================================================
-- 12: Table for multiple in-content images per module.

CREATE TABLE IF NOT EXISTS module_images (
    image_id    SERIAL PRIMARY KEY,
    module_id   INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    caption     VARCHAR(200),
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_module_images_module ON module_images(module_id);


-- ============================================================================
-- SECTION: 13_add_module_images_data.sql
-- ============================================================================
-- 13: The 6 extra in-content images (2 per module).

DELETE FROM module_images
WHERE module_id IN (
  SELECT module_id FROM training_modules WHERE title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness')
);

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/manual-handling1.png', 'Pushing a loaded trolley rather than carrying boxes by hand reduces strain on the back.', 1
FROM training_modules WHERE title = 'Manual Handling in the Warehouse';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/mannual-handling2.png', 'Discussing the safest way to move a load before starting the task.', 2
FROM training_modules WHERE title = 'Manual Handling in the Warehouse';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/hazard-perception1.png', 'A team reviewing the warehouse floor together, discussing what they observe.', 1
FROM training_modules WHERE title = 'Hazard Perception';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/hazard-perception2.png', 'Staying alert to forklift movement and overhead activity while working nearby.', 2
FROM training_modules WHERE title = 'Hazard Perception';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/cyber-awareness1.png', 'Reviewing information on a shared device together, being mindful of who can see the screen.', 1
FROM training_modules WHERE title = 'Cyber Awareness';

INSERT INTO module_images (module_id, image_url, caption, sort_order)
SELECT module_id, '/assets/photos/cyber-awareness2.png', 'Discussing a task using a company device out on the floor.', 2
FROM training_modules WHERE title = 'Cyber Awareness';


-- ============================================================================
-- SECTION: 14_add_video_column.sql
-- ============================================================================
-- 14: Separate video_url column so a module can show its hero image AND
-- a video together.

ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS video_url TEXT;


-- ============================================================================
-- SECTION: 15_set_module_videos.sql
-- ============================================================================
-- 15: Sets each module's training video, and re-confirms its hero photo.

UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/manual-handling.png',
  video_url = '/assets/videos/manual-handling.mp4'
WHERE title = 'Manual Handling in the Warehouse';

UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/hazard-perception.png',
  video_url = '/assets/videos/hazard-perception.mp4'
WHERE title = 'Hazard Perception';

UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/cyber-awareness.png',
  video_url = '/assets/videos/cyber-awareness.mp4'
WHERE title = 'Cyber Awareness';


-- ============================================================================
-- SECTION: 16_add_intro_text.sql
-- ============================================================================
-- 16: Short intro paragraph per module, shown between the hero photo and
-- the training video.

ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS intro_text TEXT;

UPDATE training_modules SET intro_text =
'Manual handling injuries happen quietly and often go unreported until they become serious. The short video below shows what correct lifting technique actually looks like in practice, before we go into the full detail of when and how to use it safely on the warehouse floor.'
WHERE title = 'Manual Handling in the Warehouse';

UPDATE training_modules SET intro_text =
'Most people believe they would notice an obvious hazard, but in a busy warehouse, real hazards are often easy to miss. The video below walks through what active hazard spotting looks like in a working environment, before we cover the categories of hazard you need to know in detail.'
WHERE title = 'Hazard Perception';

UPDATE training_modules SET intro_text =
'A single careless click can undo every other security measure a company has in place. The short video below introduces the everyday situations where cyber risk actually shows up at work, before we walk through each of the four key areas in detail.'
WHERE title = 'Cyber Awareness';


-- ============================================================================
-- SECTION: 17_add_two_puzzles.sql
-- ============================================================================
-- 17: Hazard Puzzle for Manual Handling and Cyber Awareness.

INSERT INTO hazard_scenes (module_id, title, image_url)
SELECT module_id, 'Spot the Unsafe Lifting Technique', '/assets/photos/manual-handling-puzzle.jpg'
FROM training_modules WHERE title = 'Manual Handling in the Warehouse'
AND NOT EXISTS (
  SELECT 1 FROM hazard_scenes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Manual Handling in the Warehouse')
);

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation
FROM hazard_scenes s,
(VALUES
  (25.0, 55.0, 'Bending at the back instead of the knees', 'The spine is curved under load instead of staying neutral, putting excessive strain on the lower back.'),
  (50.0, 60.0, 'Load held far from the body', 'Holding the load away from the body multiplies the effective strain on the back compared to keeping it close.'),
  (65.0, 40.0, 'Twisting while lifting', 'Rotating the spine while under load is one of the most common causes of serious back injury.'),
  (80.0, 65.0, 'Lifting alone without help', 'This load is clearly too large or heavy for one person, with no trolley or second person assisting.')
) AS h(x, y, label, explanation)
WHERE s.module_id = (SELECT module_id FROM training_modules WHERE title = 'Manual Handling in the Warehouse')
AND NOT EXISTS (SELECT 1 FROM hazard_hotspots WHERE scene_id = s.scene_id);

INSERT INTO hazard_scenes (module_id, title, image_url)
SELECT module_id, 'Spot the Hazards: Office Cyber Security', '/assets/photos/cyber-awareness-puzzle.jpg'
FROM training_modules WHERE title = 'Cyber Awareness'
AND NOT EXISTS (
  SELECT 1 FROM hazard_scenes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness')
);

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation
FROM hazard_scenes s,
(VALUES
  (50.0, 10.0, 'Sensitive note stuck directly to the screen', 'Writing passwords or confidential details on a note attached to the screen means anyone walking past can read them at a glance.'),
  (15.0, 25.0, 'Confidential notes left loose on the desk', 'Papers containing sensitive information left openly on a desk can be read, photographed, or taken by anyone passing by.'),
  (90.0, 35.0, 'Reminder note left on the side of the device', 'A note attached to the outside of a laptop is visible to colleagues, visitors, and cleaning staff, not just the account holder.'),
  (55.0, 60.0, 'Notes covering the keyboard area', 'Sensitive information left this close to a shared or unattended workspace makes it far too easy for someone else to see it.')
) AS h(x, y, label, explanation)
WHERE s.module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness')
AND NOT EXISTS (SELECT 1 FROM hazard_hotspots WHERE scene_id = s.scene_id);


-- ============================================================================
-- SECTION: 18_fix_cyber_hotspots.sql
-- ============================================================================
-- Replaces the Cyber Awareness hotspots with labels that actually match
-- what this photo shows: sticky notes with sensitive information
-- scattered across a laptop and desk. The previous labels (USB drive,
-- suspicious email, unlocked screen) described things this photo never
-- actually contained.

DELETE FROM hazard_hotspots
WHERE scene_id = (
  SELECT scene_id FROM hazard_scenes
  WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness')
);

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation
FROM hazard_scenes s,
(VALUES
  (50.0, 10.0, 'Sensitive note stuck directly to the screen', 'Writing passwords or confidential details on a note attached to the screen means anyone walking past can read them at a glance.'),
  (15.0, 25.0, 'Confidential notes left loose on the desk', 'Papers containing sensitive information left openly on a desk can be read, photographed, or taken by anyone passing by.'),
  (90.0, 35.0, 'Reminder note left on the side of the device', 'A note attached to the outside of a laptop is visible to colleagues, visitors, and cleaning staff, not just the account holder.'),
  (55.0, 60.0, 'Notes covering the keyboard area', 'Sensitive information left this close to a shared or unattended workspace makes it far too easy for someone else to see it.')
) AS h(x, y, label, explanation)
WHERE s.module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness');

-- Confirm the fix.
SELECT label, x_percent, y_percent FROM hazard_hotspots
WHERE scene_id = (SELECT scene_id FROM hazard_scenes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness'))
ORDER BY x_percent;


-- ============================================================================
-- SECTION: 19_add_scene_intro_tips.sql
-- ============================================================================
-- Adds a short "before you begin" tips paragraph to each hazard puzzle,
-- shown to the employee before they start clicking, to help them
-- remember what to look for. Also allows more than one puzzle per
-- module going forward (the schema already supported this, only the
-- application code needed to catch up).

ALTER TABLE hazard_scenes ADD COLUMN IF NOT EXISTS intro_tips TEXT;

UPDATE hazard_scenes SET intro_tips =
'Before you begin, think back to the categories of hazard covered in this module: obstructed walkways, damaged or overloaded racking, poor housekeeping, and unsafe vehicle or pedestrian movement. Take your time scanning the whole image rather than clicking the first thing you notice.'
WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Hazard Perception');

UPDATE hazard_scenes SET intro_tips =
'Before you begin, remember the four lifting technique checks: are the knees bent rather than the back, is the load held close to the body, is the spine kept straight without twisting, and is anyone lifting alone who really needs help? Look for postures that break these rules.'
WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Manual Handling in the Warehouse');

UPDATE hazard_scenes SET intro_tips =
'Before you begin, think about how sensitive information can be accidentally exposed: written down in plain sight, left unattended, or visible to someone who should not see it. Look for anything that reveals information that should be kept private.'
WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness');

SELECT hs.title, LEFT(hs.intro_tips, 50) AS tips_preview FROM hazard_scenes hs;


-- ============================================================================
-- SECTION: 20_add_second_puzzles.sql
-- ============================================================================
-- Adds the SECOND hazard puzzle to each of the 3 modules, using the
-- exact corrected coordinates verified against the real photos. Safe to
-- re-run — skips a module if it already has 2 or more scenes.

-- Manual Handling — Puzzle 2
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips)
SELECT module_id, 'Spot the Trolley Handling Hazards', '/assets/photos/manual-handling-puzzle2.jpg',
  'Think about how a loaded trolley can create risk even when nobody is lifting by hand: what you can see over, how stable the load is, and whether your path ahead is actually clear.'
FROM training_modules WHERE title = 'Manual Handling in the Warehouse'
AND (SELECT COUNT(*) FROM hazard_scenes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Manual Handling in the Warehouse')) < 2;

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation
FROM hazard_scenes s,
(VALUES
  (48.0, 15.0, 'Not looking in the direction of travel', 'Turning to look back over the shoulder while pushing a load means not watching the path ahead, increasing the risk of a collision.'),
  (25.0, 50.0, 'Load tilted at a steep, unstable angle', 'Boxes tilted this steeply on a hand trolley are at real risk of sliding or falling during movement.'),
  (70.0, 30.0, 'Open vehicle door creating an obstruction', 'An open door directly in the path of a loaded trolley is an obstruction that could cause a collision or force a sudden, unsafe change of direction.'),
  (15.0, 88.0, 'Manoeuvring over an uneven outdoor surface', 'Uneven ground makes a loaded trolley harder to control and increases the risk of it tipping.')
) AS h(x, y, label, explanation)
WHERE s.title = 'Spot the Trolley Handling Hazards'
AND NOT EXISTS (SELECT 1 FROM hazard_hotspots WHERE scene_id = s.scene_id);

-- Hazard Perception — Puzzle 2
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips)
SELECT module_id, 'Spot the Hazards: Storage Aisle', '/assets/photos/hazard-perception-puzzle2.jpg',
  'Remember the categories from this module: storage height and stability, walkway clearance, and vehicle or pedestrian conflict. Scan the whole aisle, not just eye level.'
FROM training_modules WHERE title = 'Hazard Perception'
AND (SELECT COUNT(*) FROM hazard_scenes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Hazard Perception')) < 2;

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation
FROM hazard_scenes s,
(VALUES
  (18.0, 12.0, 'Stock stacked extremely close to the ceiling', 'Storing goods this close to the ceiling leaves almost no margin for error and can interfere with sprinklers or lighting.'),
  (82.0, 12.0, 'Stock stacked extremely close to the ceiling', 'The same risk exists on both sides of the aisle: stock this high increases the danger of a fall from height.'),
  (50.0, 45.0, 'Extremely narrow aisle leaves little room to pass', 'A very tight aisle width gives almost no space to react if a vehicle or another person appears unexpectedly.'),
  (50.0, 78.0, 'Pedestrian and vehicle sharing the same narrow aisle', 'A person and a pallet jack occupying the same tight aisle at once is a real vehicle-pedestrian conflict hazard.')
) AS h(x, y, label, explanation)
WHERE s.title = 'Spot the Hazards: Storage Aisle'
AND NOT EXISTS (SELECT 1 FROM hazard_hotspots WHERE scene_id = s.scene_id);

-- Cyber Awareness — Puzzle 2
INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips)
SELECT module_id, 'Spot the Hazards: Shared Workspace', '/assets/photos/cyber-awareness-puzzle2.jpg',
  'Think about every device on this desk as a possible entry point: what is plugged in, what is left unlocked, and what could be picked up by someone who should not have access.'
FROM training_modules WHERE title = 'Cyber Awareness'
AND (SELECT COUNT(*) FROM hazard_scenes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness')) < 2;

INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation)
SELECT s.scene_id, h.x, h.y, h.label, h.explanation
FROM hazard_scenes s,
(VALUES
  (58.0, 22.0, 'Unknown portable drive left on top of other items', 'A portable drive from an unverified source is one of the easiest ways malware reaches a work device. Never plug in one you do not recognise.'),
  (15.0, 45.0, 'Smartphone left face-up and unattended', 'A phone left unlocked next to a laptop gives easy access to messages, email, and any connected work accounts.'),
  (62.0, 58.0, 'Unknown USB drive left loose on the desk', 'A loose USB drive of unknown origin poses the same malware risk as any other unverified removable media.'),
  (78.0, 40.0, 'Laptop left closed and unattended, lock status unknown', 'A closed laptop with an unknown lock status gives no real assurance that company data is actually protected.')
) AS h(x, y, label, explanation)
WHERE s.title = 'Spot the Hazards: Shared Workspace'
AND NOT EXISTS (SELECT 1 FROM hazard_hotspots WHERE scene_id = s.scene_id);

-- Confirm the result — each module should now show 2 puzzles.
SELECT m.title, hs.title AS scene_title, COUNT(hh.hotspot_id) AS hotspot_count
FROM training_modules m
JOIN hazard_scenes hs ON hs.module_id = m.module_id
JOIN hazard_hotspots hh ON hh.scene_id = hs.scene_id
WHERE m.title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness')
GROUP BY m.title, hs.title
ORDER BY m.title, hs.title;


-- ============================================================================
-- SECTION: 21_rebuild_quizzes_20q.sql
-- ============================================================================
-- Rebuilds each module's quiz with 20 real questions, 5 options each,
-- replacing the smaller previous question bank entirely. Employees will
-- see a random subset drawn from these 20 each time they take or retake
-- the quiz (see the quizRoutes.js change that follows this script).

-- ============================================================
-- Manual Handling in the Warehouse
-- ============================================================
DELETE FROM questions WHERE quiz_id = (SELECT quiz_id FROM quizzes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Manual Handling in the Warehouse'));

WITH new_q AS (
  INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
  SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
  FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
  (VALUES
    ('What does the ''T'' in the TILE risk assessment stand for?', 1, 'easy'),
    ('What does the ''I'' in the TILE risk assessment stand for?', 2, 'easy'),
    ('What does the ''L'' in the TILE risk assessment stand for?', 3, 'easy'),
    ('What does the ''E'' in the TILE risk assessment stand for?', 4, 'easy'),
    ('What is the correct way to lift a heavy load from the floor?', 5, 'medium'),
    ('What should you check before lifting an unfamiliar load?', 6, 'easy'),
    ('When should you use a mechanical aid instead of lifting manually?', 7, 'easy'),
    ('What should you do if a load needs to be carried up a staircase?', 8, 'hard'),
    ('Why can repetitive lifting cause injury even when each individual lift is within safe limits?', 9, 'hard'),
    ('What is the safest way to change direction while carrying a load?', 10, 'easy'),
    ('Why should a load be kept close to your body while lifting?', 11, 'medium'),
    ('What should you do if you feel pain during or after a lift?', 12, 'medium'),
    ('When pushing or pulling a loaded trolley, what should you generally do?', 13, 'easy'),
    ('Why is pushing generally safer than pulling a loaded trolley?', 14, 'medium'),
    ('What extra consideration should be given to new starters regarding manual handling?', 15, 'medium'),
    ('What should an employee recovering from a previous injury do before resuming manual handling duties?', 16, 'medium'),
    ('What is an employer''s legal duty regarding hazardous manual handling?', 17, 'hard'),
    ('What is an employee''s legal duty regarding manual handling?', 18, 'hard'),
    ('Why should large or heavy loads be broken into smaller ones where possible?', 19, 'medium'),
    ('What should two people agree before performing a team lift together?', 20, 'medium')
  ) AS x(question_text, sort_order, difficulty)
  WHERE m.title = 'Manual Handling in the Warehouse'
  RETURNING question_id, question_text
)
INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT nq.question_id, opt.option_text, opt.is_correct
FROM new_q nq JOIN (VALUES
  ('What does the ''T'' in the TILE risk assessment stand for?', 'Task', TRUE),
  ('What does the ''T'' in the TILE risk assessment stand for?', 'Time', FALSE),
  ('What does the ''T'' in the TILE risk assessment stand for?', 'Team', FALSE),
  ('What does the ''T'' in the TILE risk assessment stand for?', 'Training', FALSE),
  ('What does the ''T'' in the TILE risk assessment stand for?', 'Tools', FALSE),
  ('What does the ''I'' in the TILE risk assessment stand for?', 'Individual', TRUE),
  ('What does the ''I'' in the TILE risk assessment stand for?', 'Inspection', FALSE),
  ('What does the ''I'' in the TILE risk assessment stand for?', 'Instruction', FALSE),
  ('What does the ''I'' in the TILE risk assessment stand for?', 'Injury', FALSE),
  ('What does the ''I'' in the TILE risk assessment stand for?', 'Item', FALSE),
  ('What does the ''L'' in the TILE risk assessment stand for?', 'Load', TRUE),
  ('What does the ''L'' in the TILE risk assessment stand for?', 'Lifting', FALSE),
  ('What does the ''L'' in the TILE risk assessment stand for?', 'Location', FALSE),
  ('What does the ''L'' in the TILE risk assessment stand for?', 'Level', FALSE),
  ('What does the ''L'' in the TILE risk assessment stand for?', 'Length', FALSE),
  ('What does the ''E'' in the TILE risk assessment stand for?', 'Environment', TRUE),
  ('What does the ''E'' in the TILE risk assessment stand for?', 'Equipment', FALSE),
  ('What does the ''E'' in the TILE risk assessment stand for?', 'Experience', FALSE),
  ('What does the ''E'' in the TILE risk assessment stand for?', 'Effort', FALSE),
  ('What does the ''E'' in the TILE risk assessment stand for?', 'Exit', FALSE),
  ('What is the correct way to lift a heavy load from the floor?', 'Bend your knees and keep the load close to your body', TRUE),
  ('What is the correct way to lift a heavy load from the floor?', 'Bend at the waist and keep your legs straight', FALSE),
  ('What is the correct way to lift a heavy load from the floor?', 'Twist your upper body to pick it up faster', FALSE),
  ('What is the correct way to lift a heavy load from the floor?', 'Lift with your arms fully extended away from your body', FALSE),
  ('What is the correct way to lift a heavy load from the floor?', 'Hold your breath and lift as quickly as possible', FALSE),
  ('What should you check before lifting an unfamiliar load?', 'Its weight, size, shape, and handholds', TRUE),
  ('What should you check before lifting an unfamiliar load?', 'Only its colour', FALSE),
  ('What should you check before lifting an unfamiliar load?', 'Nothing, all loads are the same', FALSE),
  ('What should you check before lifting an unfamiliar load?', 'Only how far it needs to travel', FALSE),
  ('What should you check before lifting an unfamiliar load?', 'Only who asked you to move it', FALSE),
  ('When should you use a mechanical aid instead of lifting manually?', 'When a load is heavy, awkward, or needs to travel a distance', TRUE),
  ('When should you use a mechanical aid instead of lifting manually?', 'Never, aids are only for very light loads', FALSE),
  ('When should you use a mechanical aid instead of lifting manually?', 'Only if a supervisor is watching', FALSE),
  ('When should you use a mechanical aid instead of lifting manually?', 'Only at the end of a shift', FALSE),
  ('When should you use a mechanical aid instead of lifting manually?', 'Only when working alone', FALSE),
  ('What should you do if a load needs to be carried up a staircase?', 'Use a lift or ramp instead wherever available', TRUE),
  ('What should you do if a load needs to be carried up a staircase?', 'Carry it quickly so less time is spent on the stairs', FALSE),
  ('What should you do if a load needs to be carried up a staircase?', 'Hold it high enough to see over the top', FALSE),
  ('What should you do if a load needs to be carried up a staircase?', 'Carry two loads at once to save trips', FALSE),
  ('What should you do if a load needs to be carried up a staircase?', 'Walk backwards up the stairs for better balance', FALSE),
  ('Why can repetitive lifting cause injury even when each individual lift is within safe limits?', 'Fatigue builds up over the shift, increasing injury risk even for safe individual lifts', TRUE),
  ('Why can repetitive lifting cause injury even when each individual lift is within safe limits?', 'It cannot cause injury if each lift is technically correct', FALSE),
  ('Why can repetitive lifting cause injury even when each individual lift is within safe limits?', 'Only the very first lift of the day carries any risk', FALSE),
  ('Why can repetitive lifting cause injury even when each individual lift is within safe limits?', 'Repetitive lifting has no real effect on the body', FALSE),
  ('Why can repetitive lifting cause injury even when each individual lift is within safe limits?', 'It only matters if the loads are heavy', FALSE),
  ('What is the safest way to change direction while carrying a load?', 'Move your feet rather than twisting your spine', TRUE),
  ('What is the safest way to change direction while carrying a load?', 'Twist at the waist while keeping your feet still', FALSE),
  ('What is the safest way to change direction while carrying a load?', 'Keep walking forward regardless of direction', FALSE),
  ('What is the safest way to change direction while carrying a load?', 'Stop and put the load down first every time', FALSE),
  ('What is the safest way to change direction while carrying a load?', 'Twist quickly to get it over with', FALSE),
  ('Why should a load be kept close to your body while lifting?', 'It reduces the strain on your back compared to holding it away from you', TRUE),
  ('Why should a load be kept close to your body while lifting?', 'It makes the load look lighter to observers', FALSE),
  ('Why should a load be kept close to your body while lifting?', 'It has no real effect on safety', FALSE),
  ('Why should a load be kept close to your body while lifting?', 'It only matters for very small loads', FALSE),
  ('Why should a load be kept close to your body while lifting?', 'It helps you walk faster', FALSE),
  ('What should you do if you feel pain during or after a lift?', 'Stop the task immediately and report it to your supervisor', TRUE),
  ('What should you do if you feel pain during or after a lift?', 'Continue and mention it at the end of the shift', FALSE),
  ('What should you do if you feel pain during or after a lift?', 'Ignore it if the pain is mild', FALSE),
  ('What should you do if you feel pain during or after a lift?', 'Take a short break then continue the same task', FALSE),
  ('What should you do if you feel pain during or after a lift?', 'Ask a colleague to finish the task without reporting anything', FALSE),
  ('When pushing or pulling a loaded trolley, what should you generally do?', 'Push rather than pull wherever possible', TRUE),
  ('When pushing or pulling a loaded trolley, what should you generally do?', 'Always pull so you can see the trolley', FALSE),
  ('When pushing or pulling a loaded trolley, what should you generally do?', 'It makes no difference which way you move it', FALSE),
  ('When pushing or pulling a loaded trolley, what should you generally do?', 'Push and pull equally throughout the task', FALSE),
  ('When pushing or pulling a loaded trolley, what should you generally do?', 'Pull only, since pushing is never recommended', FALSE),
  ('Why is pushing generally safer than pulling a loaded trolley?', 'Pushing lets you use your body weight and see where you are going', TRUE),
  ('Why is pushing generally safer than pulling a loaded trolley?', 'Pushing is always physically easier regardless of load', FALSE),
  ('Why is pushing generally safer than pulling a loaded trolley?', 'Pulling damages trolley wheels more quickly', FALSE),
  ('Why is pushing generally safer than pulling a loaded trolley?', 'There is no real safety difference between the two', FALSE),
  ('Why is pushing generally safer than pulling a loaded trolley?', 'Pulling is only unsafe on flat surfaces', FALSE),
  ('What extra consideration should be given to new starters regarding manual handling?', 'They should be given lighter or assisted tasks while they build up conditioning', TRUE),
  ('What extra consideration should be given to new starters regarding manual handling?', 'They should be given the heaviest tasks to build strength quickly', FALSE),
  ('What extra consideration should be given to new starters regarding manual handling?', 'No different treatment is needed for new starters', FALSE),
  ('What extra consideration should be given to new starters regarding manual handling?', 'They should only observe for their entire first month', FALSE),
  ('What extra consideration should be given to new starters regarding manual handling?', 'They should be excluded from all manual handling training', FALSE),
  ('What should an employee recovering from a previous injury do before resuming manual handling duties?', 'Discuss their duties with their supervisor first', TRUE),
  ('What should an employee recovering from a previous injury do before resuming manual handling duties?', 'Return to full duties immediately once back at work', FALSE),
  ('What should an employee recovering from a previous injury do before resuming manual handling duties?', 'Avoid mentioning the injury to avoid extra attention', FALSE),
  ('What should an employee recovering from a previous injury do before resuming manual handling duties?', 'Wait exactly one week with no other action', FALSE),
  ('What should an employee recovering from a previous injury do before resuming manual handling duties?', 'Only lift with one hand until fully recovered', FALSE),
  ('What is an employer''s legal duty regarding hazardous manual handling?', 'Avoid it where reasonably possible, assess it where it cannot be avoided, and reduce the risk as far as practicable', TRUE),
  ('What is an employer''s legal duty regarding hazardous manual handling?', 'Provide manual handling training once and take no further action', FALSE),
  ('What is an employer''s legal duty regarding hazardous manual handling?', 'Ensure only new employees perform manual handling tasks', FALSE),
  ('What is an employer''s legal duty regarding hazardous manual handling?', 'There is no legal duty on the employer, only the employee', FALSE),
  ('What is an employer''s legal duty regarding hazardous manual handling?', 'Ban all manual handling regardless of the task', FALSE),
  ('What is an employee''s legal duty regarding manual handling?', 'To make proper use of equipment and training provided and take reasonable care of their own and others'' safety', TRUE),
  ('What is an employee''s legal duty regarding manual handling?', 'To lift as much as possible to help the team', FALSE),
  ('What is an employee''s legal duty regarding manual handling?', 'To avoid reporting any manual handling concerns', FALSE),
  ('What is an employee''s legal duty regarding manual handling?', 'To only follow instructions from other employees, not supervisors', FALSE),
  ('What is an employee''s legal duty regarding manual handling?', 'There is no legal duty on the employee, only the employer', FALSE),
  ('Why should large or heavy loads be broken into smaller ones where possible?', 'It reduces the strain placed on the body during each individual lift', TRUE),
  ('Why should large or heavy loads be broken into smaller ones where possible?', 'It takes less time overall regardless of safety', FALSE),
  ('Why should large or heavy loads be broken into smaller ones where possible?', 'It has no effect on safety, only on speed', FALSE),
  ('Why should large or heavy loads be broken into smaller ones where possible?', 'It is only relevant for fragile items', FALSE),
  ('Why should large or heavy loads be broken into smaller ones where possible?', 'It is only required for loads carried outdoors', FALSE),
  ('What should two people agree before performing a team lift together?', 'Who will count the lift and in which direction they will both move', TRUE),
  ('What should two people agree before performing a team lift together?', 'Only who will carry the heavier end', FALSE),
  ('What should two people agree before performing a team lift together?', 'Nothing needs to be agreed in advance', FALSE),
  ('What should two people agree before performing a team lift together?', 'Only the total weight of the load', FALSE),
  ('What should two people agree before performing a team lift together?', 'Only which hand to use for gripping', FALSE)
) AS opt(question_text, option_text, is_correct) ON opt.question_text = nq.question_text;

-- ============================================================
-- Hazard Perception
-- ============================================================
DELETE FROM questions WHERE quiz_id = (SELECT quiz_id FROM quizzes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Hazard Perception'));

WITH new_q AS (
  INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
  SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
  FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
  (VALUES
    ('What is the definition of a hazard?', 1, 'easy'),
    ('What is hazard perception?', 2, 'easy'),
    ('What is the biggest barrier to good hazard perception?', 3, 'medium'),
    ('What should you do to counter complacency about your usual work area?', 4, 'medium'),
    ('Which of these is an example of a warehouse hazard?', 5, 'easy'),
    ('What does ''racking overload'' refer to as a hazard category?', 6, 'medium'),
    ('What does ''poor housekeeping'' refer to as a hazard category?', 7, 'easy'),
    ('What does ''vehicle and pedestrian conflict'' refer to as a hazard category?', 8, 'medium'),
    ('What does ''unsafe behaviour'' refer to as a hazard category?', 9, 'medium'),
    ('What should you do when you notice a hazard in your work area?', 10, 'easy'),
    ('What should you do if a hazard presents an immediate risk of serious harm?', 11, 'hard'),
    ('What is a near miss?', 12, 'easy'),
    ('Why should near misses be reported, even if nobody was hurt?', 13, 'medium'),
    ('What does the ''S'' in the STOP method stand for?', 14, 'easy'),
    ('What does the ''Observe'' step in the STOP method involve?', 15, 'medium'),
    ('What does the ''Proceed'' step in the STOP method mean?', 16, 'medium'),
    ('What is normalisation of deviance?', 17, 'hard'),
    ('How can time pressure affect hazard perception?', 18, 'medium'),
    ('Why might an experienced employee be more likely to miss a hazard on a familiar route?', 19, 'hard'),
    ('In the overhanging pallet example described in this module, what ultimately caused the injury?', 20, 'hard')
  ) AS x(question_text, sort_order, difficulty)
  WHERE m.title = 'Hazard Perception'
  RETURNING question_id, question_text
)
INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT nq.question_id, opt.option_text, opt.is_correct
FROM new_q nq JOIN (VALUES
  ('What is the definition of a hazard?', 'Anything with the potential to cause harm', TRUE),
  ('What is the definition of a hazard?', 'Only equipment that has already failed', FALSE),
  ('What is the definition of a hazard?', 'Only actions taken by management', FALSE),
  ('What is the definition of a hazard?', 'Only conditions found outdoors', FALSE),
  ('What is the definition of a hazard?', 'Only situations involving vehicles', FALSE),
  ('What is hazard perception?', 'The skill of noticing a developing risk before it leads to an accident', TRUE),
  ('What is hazard perception?', 'A formal qualification required for all warehouse staff', FALSE),
  ('What is hazard perception?', 'A type of protective equipment', FALSE),
  ('What is hazard perception?', 'A device used to detect gas leaks', FALSE),
  ('What is hazard perception?', 'A checklist completed only once a year', FALSE),
  ('What is the biggest barrier to good hazard perception?', 'Complacency', TRUE),
  ('What is the biggest barrier to good hazard perception?', 'Wearing safety boots', FALSE),
  ('What is the biggest barrier to good hazard perception?', 'Working during daylight hours', FALSE),
  ('What is the biggest barrier to good hazard perception?', 'Having too much free time', FALSE),
  ('What is the biggest barrier to good hazard perception?', 'Working with a colleague nearby', FALSE),
  ('What should you do to counter complacency about your usual work area?', 'Consciously and actively scan your surroundings throughout your shift', TRUE),
  ('What should you do to counter complacency about your usual work area?', 'Walk the same route slightly faster each day', FALSE),
  ('What should you do to counter complacency about your usual work area?', 'Rely on colleagues to notice hazards instead', FALSE),
  ('What should you do to counter complacency about your usual work area?', 'Only check the area once at the start of the week', FALSE),
  ('What should you do to counter complacency about your usual work area?', 'Avoid looking at areas you already know well', FALSE),
  ('Which of these is an example of a warehouse hazard?', 'Boxes left blocking a pedestrian walkway', TRUE),
  ('Which of these is an example of a warehouse hazard?', 'A clearly labelled fire extinguisher on the wall', FALSE),
  ('Which of these is an example of a warehouse hazard?', 'A forklift parked correctly in its marked bay', FALSE),
  ('Which of these is an example of a warehouse hazard?', 'A tidy, well-lit storage aisle', FALSE),
  ('Which of these is an example of a warehouse hazard?', 'A noticeboard displaying safety posters', FALSE),
  ('What does ''racking overload'' refer to as a hazard category?', 'A shelf that is bending, leaning, or carrying more weight than its rated capacity', TRUE),
  ('What does ''racking overload'' refer to as a hazard category?', 'Having too many staff working in one aisle', FALSE),
  ('What does ''racking overload'' refer to as a hazard category?', 'A racking unit that is completely empty', FALSE),
  ('What does ''racking overload'' refer to as a hazard category?', 'Shelving that has recently been cleaned', FALSE),
  ('What does ''racking overload'' refer to as a hazard category?', 'A shelf labelled with its maximum capacity', FALSE),
  ('What does ''poor housekeeping'' refer to as a hazard category?', 'Spills, trailing cables, or general clutter in working areas', TRUE),
  ('What does ''poor housekeeping'' refer to as a hazard category?', 'A warehouse that is cleaned too frequently', FALSE),
  ('What does ''poor housekeeping'' refer to as a hazard category?', 'Staff wearing high-visibility clothing', FALSE),
  ('What does ''poor housekeeping'' refer to as a hazard category?', 'Clearly labelled storage bins', FALSE),
  ('What does ''poor housekeeping'' refer to as a hazard category?', 'Well-organised shelving units', FALSE),
  ('What does ''vehicle and pedestrian conflict'' refer to as a hazard category?', 'Forklifts operating in shared spaces without clear sightlines or warning signals', TRUE),
  ('What does ''vehicle and pedestrian conflict'' refer to as a hazard category?', 'Two forklifts parked next to each other safely', FALSE),
  ('What does ''vehicle and pedestrian conflict'' refer to as a hazard category?', 'A pedestrian walkway with no vehicles present', FALSE),
  ('What does ''vehicle and pedestrian conflict'' refer to as a hazard category?', 'A vehicle being serviced in a maintenance bay', FALSE),
  ('What does ''vehicle and pedestrian conflict'' refer to as a hazard category?', 'Staff using a marked pedestrian crossing correctly', FALSE),
  ('What does ''unsafe behaviour'' refer to as a hazard category?', 'A colleague taking a shortcut or bypassing a safety control under time pressure', TRUE),
  ('What does ''unsafe behaviour'' refer to as a hazard category?', 'An employee following the correct safety procedure', FALSE),
  ('What does ''unsafe behaviour'' refer to as a hazard category?', 'A supervisor conducting a routine inspection', FALSE),
  ('What does ''unsafe behaviour'' refer to as a hazard category?', 'Staff attending a scheduled training session', FALSE),
  ('What does ''unsafe behaviour'' refer to as a hazard category?', 'An employee reporting a hazard to their supervisor', FALSE),
  ('What should you do when you notice a hazard in your work area?', 'Report it to your supervisor so it can be corrected', TRUE),
  ('What should you do when you notice a hazard in your work area?', 'Work around it quietly so as not to slow things down', FALSE),
  ('What should you do when you notice a hazard in your work area?', 'Ignore it if it does not affect your own task', FALSE),
  ('What should you do when you notice a hazard in your work area?', 'Wait for someone else to notice it first', FALSE),
  ('What should you do when you notice a hazard in your work area?', 'Only mention it if it causes an accident', FALSE),
  ('What should you do if a hazard presents an immediate risk of serious harm?', 'Cordon off the area or stop the activity, then report it', TRUE),
  ('What should you do if a hazard presents an immediate risk of serious harm?', 'Continue working carefully around it', FALSE),
  ('What should you do if a hazard presents an immediate risk of serious harm?', 'Report it only at the end of the shift', FALSE),
  ('What should you do if a hazard presents an immediate risk of serious harm?', 'Take a photo and email it later that week', FALSE),
  ('What should you do if a hazard presents an immediate risk of serious harm?', 'Ask a colleague to deal with it instead of reporting it', FALSE),
  ('What is a near miss?', 'A situation where an accident almost happened but did not', TRUE),
  ('What is a near miss?', 'An accident that has already caused an injury', FALSE),
  ('What is a near miss?', 'A hazard that has already been fixed', FALSE),
  ('What is a near miss?', 'A scheduled safety inspection', FALSE),
  ('What is a near miss?', 'A piece of damaged equipment awaiting repair', FALSE),
  ('Why should near misses be reported, even if nobody was hurt?', 'It can prevent a real injury from happening later', TRUE),
  ('Why should near misses be reported, even if nobody was hurt?', 'It is only useful for insurance records', FALSE),
  ('Why should near misses be reported, even if nobody was hurt?', 'It is not necessary if nobody saw it happen', FALSE),
  ('Why should near misses be reported, even if nobody was hurt?', 'It only matters if it happens more than once', FALSE),
  ('Why should near misses be reported, even if nobody was hurt?', 'It has no real safety value', FALSE),
  ('What does the ''S'' in the STOP method stand for?', 'Stop', TRUE),
  ('What does the ''S'' in the STOP method stand for?', 'Safety', FALSE),
  ('What does the ''S'' in the STOP method stand for?', 'Supervisor', FALSE),
  ('What does the ''S'' in the STOP method stand for?', 'Signal', FALSE),
  ('What does the ''S'' in the STOP method stand for?', 'Speed', FALSE),
  ('What does the ''Observe'' step in the STOP method involve?', 'Actually looking properly at your surroundings rather than glancing', TRUE),
  ('What does the ''Observe'' step in the STOP method involve?', 'Waiting for someone else to check first', FALSE),
  ('What does the ''Observe'' step in the STOP method involve?', 'Recording the hazard on video before acting', FALSE),
  ('What does the ''Observe'' step in the STOP method involve?', 'Asking a supervisor to observe on your behalf', FALSE),
  ('What does the ''Observe'' step in the STOP method involve?', 'Reviewing paperwork before starting a task', FALSE),
  ('What does the ''Proceed'' step in the STOP method mean?', 'Only continue once you are satisfied it is safe to do so', TRUE),
  ('What does the ''Proceed'' step in the STOP method mean?', 'Continue regardless of what you observed', FALSE),
  ('What does the ''Proceed'' step in the STOP method mean?', 'Proceed only if a supervisor is present', FALSE),
  ('What does the ''Proceed'' step in the STOP method mean?', 'Skip the task entirely and move to another one', FALSE),
  ('What does the ''Proceed'' step in the STOP method mean?', 'Proceed immediately without pausing to think', FALSE),
  ('What is normalisation of deviance?', 'When an unsafe condition persists without incident and people stop noticing it as a problem', TRUE),
  ('What is normalisation of deviance?', 'A formal safety inspection process', FALSE),
  ('What is normalisation of deviance?', 'A type of protective equipment', FALSE),
  ('What is normalisation of deviance?', 'A method for training new employees', FALSE),
  ('What is normalisation of deviance?', 'A scheduled maintenance routine', FALSE),
  ('How can time pressure affect hazard perception?', 'It narrows attention onto the immediate task and away from the wider environment', TRUE),
  ('How can time pressure affect hazard perception?', 'It has no real effect on how hazards are noticed', FALSE),
  ('How can time pressure affect hazard perception?', 'It always improves how carefully people work', FALSE),
  ('How can time pressure affect hazard perception?', 'It only affects new employees', FALSE),
  ('How can time pressure affect hazard perception?', 'It only matters during night shifts', FALSE),
  ('Why might an experienced employee be more likely to miss a hazard on a familiar route?', 'Familiarity can create a false sense that nothing has changed since last time', TRUE),
  ('Why might an experienced employee be more likely to miss a hazard on a familiar route?', 'Experienced employees are physically unable to see hazards', FALSE),
  ('Why might an experienced employee be more likely to miss a hazard on a familiar route?', 'Familiar routes never actually contain real hazards', FALSE),
  ('Why might an experienced employee be more likely to miss a hazard on a familiar route?', 'Experience has no effect on hazard perception at all', FALSE),
  ('Why might an experienced employee be more likely to miss a hazard on a familiar route?', 'Only new employees are capable of noticing hazards', FALSE),
  ('In the overhanging pallet example described in this module, what ultimately caused the injury?', 'The hazard existed for many hours before anyone reported it', TRUE),
  ('In the overhanging pallet example described in this module, what ultimately caused the injury?', 'The pallet was moved without anyone noticing', FALSE),
  ('In the overhanging pallet example described in this module, what ultimately caused the injury?', 'The employee involved was not wearing safety boots', FALSE),
  ('In the overhanging pallet example described in this module, what ultimately caused the injury?', 'The warehouse lighting had failed overnight', FALSE),
  ('In the overhanging pallet example described in this module, what ultimately caused the injury?', 'The forklift driver was working too quickly', FALSE)
) AS opt(question_text, option_text, is_correct) ON opt.question_text = nq.question_text;

-- ============================================================
-- Cyber Awareness
-- ============================================================
DELETE FROM questions WHERE quiz_id = (SELECT quiz_id FROM quizzes WHERE module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness'));

WITH new_q AS (
  INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
  SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
  FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
  (VALUES
    ('What should you use for each of your work systems?', 1, 'easy'),
    ('What should you never do with your login details?', 2, 'easy'),
    ('What should you do whenever you step away from your desk, even briefly?', 3, 'easy'),
    ('What kind of device or network should you use when accessing company systems from home?', 4, 'medium'),
    ('Why should your home router firmware be kept up to date?', 5, 'medium'),
    ('What should you avoid doing when using public Wi-Fi, such as in a cafe or airport?', 6, 'easy'),
    ('What is social engineering, in a cyber security context?', 7, 'medium'),
    ('What should you do if you receive an unexpected, urgent request for money or sensitive information?', 8, 'medium'),
    ('Where should company data be kept off, wherever possible?', 9, 'easy'),
    ('What should be enabled on any personal device that accesses work email?', 10, 'easy'),
    ('What should you do if a work device is lost or stolen?', 11, 'easy'),
    ('What should you do if something looks suspicious, such as an unexpected attachment or link?', 12, 'easy'),
    ('You receive an urgent email asking you to transfer money immediately. What should you do?', 13, 'medium'),
    ('Which of these is safest when working from home?', 14, 'easy'),
    ('Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?', 15, 'hard'),
    ('Why is multi factor authentication effective even if your password is stolen?', 16, 'hard'),
    ('What is a good sign that an email might be a phishing attempt?', 17, 'easy'),
    ('Why should you never plug in an unknown USB drive?', 18, 'medium'),
    ('What should you do if you think you have already clicked a malicious link?', 19, 'medium'),
    ('Why should you be cautious of a generic greeting such as ''Dear Customer'' in an email claiming to be from someone who knows you?', 20, 'medium')
  ) AS x(question_text, sort_order, difficulty)
  WHERE m.title = 'Cyber Awareness'
  RETURNING question_id, question_text
)
INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT nq.question_id, opt.option_text, opt.is_correct
FROM new_q nq JOIN (VALUES
  ('What should you use for each of your work systems?', 'A strong, unique password for each system', TRUE),
  ('What should you use for each of your work systems?', 'The same simple password everywhere for convenience', FALSE),
  ('What should you use for each of your work systems?', 'Your name followed by the year', FALSE),
  ('What should you use for each of your work systems?', 'A password shared with your whole team', FALSE),
  ('What should you use for each of your work systems?', 'No password if the device is rarely used', FALSE),
  ('What should you never do with your login details?', 'Share them with anyone, including colleagues', TRUE),
  ('What should you never do with your login details?', 'Change them periodically', FALSE),
  ('What should you never do with your login details?', 'Use a password manager to store them', FALSE),
  ('What should you never do with your login details?', 'Keep them different from your personal accounts', FALSE),
  ('What should you never do with your login details?', 'Update them if you suspect a compromise', FALSE),
  ('What should you do whenever you step away from your desk, even briefly?', 'Lock your screen', TRUE),
  ('What should you do whenever you step away from your desk, even briefly?', 'Turn the monitor off only', FALSE),
  ('What should you do whenever you step away from your desk, even briefly?', 'Nothing, it is fine for a short time', FALSE),
  ('What should you do whenever you step away from your desk, even briefly?', 'Log out of email only', FALSE),
  ('What should you do whenever you step away from your desk, even briefly?', 'Close only the current application', FALSE),
  ('What kind of device or network should you use when accessing company systems from home?', 'A company-approved device and network wherever possible', TRUE),
  ('What kind of device or network should you use when accessing company systems from home?', 'Any device available, since location does not matter', FALSE),
  ('What kind of device or network should you use when accessing company systems from home?', 'A personal device only, never a company one', FALSE),
  ('What kind of device or network should you use when accessing company systems from home?', 'Any public network with free Wi-Fi', FALSE),
  ('What kind of device or network should you use when accessing company systems from home?', 'A shared family device with no restrictions', FALSE),
  ('Why should your home router firmware be kept up to date?', 'Outdated router software is a common weak point that attackers look for', TRUE),
  ('Why should your home router firmware be kept up to date?', 'It has no real effect on security', FALSE),
  ('Why should your home router firmware be kept up to date?', 'It only affects internet speed, not security', FALSE),
  ('Why should your home router firmware be kept up to date?', 'Routers do not require updates once installed', FALSE),
  ('Why should your home router firmware be kept up to date?', 'It only matters for company-owned routers', FALSE),
  ('What should you avoid doing when using public Wi-Fi, such as in a cafe or airport?', 'Working on sensitive company data', TRUE),
  ('What should you avoid doing when using public Wi-Fi, such as in a cafe or airport?', 'Connecting any device at all', FALSE),
  ('What should you avoid doing when using public Wi-Fi, such as in a cafe or airport?', 'Using a personal phone for personal browsing', FALSE),
  ('What should you avoid doing when using public Wi-Fi, such as in a cafe or airport?', 'Turning off Bluetooth', FALSE),
  ('What should you avoid doing when using public Wi-Fi, such as in a cafe or airport?', 'Using it for non-work purposes only', FALSE),
  ('What is social engineering, in a cyber security context?', 'Attacks that target people rather than breaking into systems directly', TRUE),
  ('What is social engineering, in a cyber security context?', 'A method of designing more secure software', FALSE),
  ('What is social engineering, in a cyber security context?', 'A type of firewall configuration', FALSE),
  ('What is social engineering, in a cyber security context?', 'A process for testing network speed', FALSE),
  ('What is social engineering, in a cyber security context?', 'A form of employee performance review', FALSE),
  ('What should you do if you receive an unexpected, urgent request for money or sensitive information?', 'Verify the request through a separate, trusted channel before acting', TRUE),
  ('What should you do if you receive an unexpected, urgent request for money or sensitive information?', 'Act immediately since it was marked urgent', FALSE),
  ('What should you do if you receive an unexpected, urgent request for money or sensitive information?', 'Forward it to a colleague and let them decide', FALSE),
  ('What should you do if you receive an unexpected, urgent request for money or sensitive information?', 'Reply asking for more details by the same channel', FALSE),
  ('What should you do if you receive an unexpected, urgent request for money or sensitive information?', 'Ignore it completely without telling anyone', FALSE),
  ('Where should company data be kept off, wherever possible?', 'Personal phones', TRUE),
  ('Where should company data be kept off, wherever possible?', 'Company-issued laptops', FALSE),
  ('Where should company data be kept off, wherever possible?', 'Secure company servers', FALSE),
  ('Where should company data be kept off, wherever possible?', 'Approved cloud storage', FALSE),
  ('Where should company data be kept off, wherever possible?', 'Locked office filing cabinets', FALSE),
  ('What should be enabled on any personal device that accesses work email?', 'A passcode or biometric lock', TRUE),
  ('What should be enabled on any personal device that accesses work email?', 'Airplane mode at all times', FALSE),
  ('What should be enabled on any personal device that accesses work email?', 'Location tracking only', FALSE),
  ('What should be enabled on any personal device that accesses work email?', 'A longer battery life setting', FALSE),
  ('What should be enabled on any personal device that accesses work email?', 'Automatic app updates only', FALSE),
  ('What should you do if a work device is lost or stolen?', 'Report it immediately so access can be revoked', TRUE),
  ('What should you do if a work device is lost or stolen?', 'Wait to see if it turns up before telling anyone', FALSE),
  ('What should you do if a work device is lost or stolen?', 'Only report it if it contained sensitive files', FALSE),
  ('What should you do if a work device is lost or stolen?', 'Buy a replacement first, then report it later', FALSE),
  ('What should you do if a work device is lost or stolen?', 'Change your password on a different device only', FALSE),
  ('What should you do if something looks suspicious, such as an unexpected attachment or link?', 'Report it rather than clicking or replying', TRUE),
  ('What should you do if something looks suspicious, such as an unexpected attachment or link?', 'Open it carefully to check if it is safe', FALSE),
  ('What should you do if something looks suspicious, such as an unexpected attachment or link?', 'Forward it to a friend to get a second opinion', FALSE),
  ('What should you do if something looks suspicious, such as an unexpected attachment or link?', 'Reply asking the sender to confirm it is genuine', FALSE),
  ('What should you do if something looks suspicious, such as an unexpected attachment or link?', 'Delete it immediately without telling anyone', FALSE),
  ('You receive an urgent email asking you to transfer money immediately. What should you do?', 'Verify the request through a separate, trusted channel before acting', TRUE),
  ('You receive an urgent email asking you to transfer money immediately. What should you do?', 'Act immediately since the email said it was urgent', FALSE),
  ('You receive an urgent email asking you to transfer money immediately. What should you do?', 'Forward it to a colleague and let them decide', FALSE),
  ('You receive an urgent email asking you to transfer money immediately. What should you do?', 'Reply to the email asking if it is legitimate', FALSE),
  ('You receive an urgent email asking you to transfer money immediately. What should you do?', 'Transfer a smaller amount first to test it', FALSE),
  ('Which of these is safest when working from home?', 'Using a company-approved device and network', TRUE),
  ('Which of these is safest when working from home?', 'Using any available public Wi-Fi', FALSE),
  ('Which of these is safest when working from home?', 'Sharing your login with a family member if needed', FALSE),
  ('Which of these is safest when working from home?', 'Disabling your antivirus to improve speed', FALSE),
  ('Which of these is safest when working from home?', 'Using the same password as your personal email', FALSE),
  ('Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?', 'Refuse and report the call, since a genuine request would never ask this', TRUE),
  ('Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?', 'Read the code out since they said they are from IT', FALSE),
  ('Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?', 'Text the code instead of reading it aloud', FALSE),
  ('Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?', 'Ask them to call back on a different number', FALSE),
  ('Someone calls claiming to be from IT and asks you to read out a login code sent to your phone. What should you do?', 'Provide the code only if they know your name', FALSE),
  ('Why is multi factor authentication effective even if your password is stolen?', 'The attacker still needs the second factor, such as your phone, to log in', TRUE),
  ('Why is multi factor authentication effective even if your password is stolen?', 'It makes your password impossible to ever guess', FALSE),
  ('Why is multi factor authentication effective even if your password is stolen?', 'It stops all phishing emails from being sent to you', FALSE),
  ('Why is multi factor authentication effective even if your password is stolen?', 'It automatically changes your password every day', FALSE),
  ('Why is multi factor authentication effective even if your password is stolen?', 'It prevents your account from ever being targeted', FALSE),
  ('What is a good sign that an email might be a phishing attempt?', 'It creates a strong sense of urgency or fear', TRUE),
  ('What is a good sign that an email might be a phishing attempt?', 'It is addressed to you by name', FALSE),
  ('What is a good sign that an email might be a phishing attempt?', 'It comes from a colleague you recognise', FALSE),
  ('What is a good sign that an email might be a phishing attempt?', 'It contains a company logo', FALSE),
  ('What is a good sign that an email might be a phishing attempt?', 'It was sent during working hours', FALSE),
  ('Why should you never plug in an unknown USB drive?', 'It is a common way malware gets onto a company system', TRUE),
  ('Why should you never plug in an unknown USB drive?', 'It will slow down your computer permanently', FALSE),
  ('Why should you never plug in an unknown USB drive?', 'It has no real security risk at all', FALSE),
  ('Why should you never plug in an unknown USB drive?', 'It only affects the USB drive itself', FALSE),
  ('Why should you never plug in an unknown USB drive?', 'It only matters on personal computers', FALSE),
  ('What should you do if you think you have already clicked a malicious link?', 'Report it immediately rather than staying quiet', TRUE),
  ('What should you do if you think you have already clicked a malicious link?', 'Wait to see if anything bad actually happens', FALSE),
  ('What should you do if you think you have already clicked a malicious link?', 'Only mention it if asked directly', FALSE),
  ('What should you do if you think you have already clicked a malicious link?', 'Restart your computer and say nothing further', FALSE),
  ('What should you do if you think you have already clicked a malicious link?', 'Delete your browser history and continue working', FALSE),
  ('Why should you be cautious of a generic greeting such as ''Dear Customer'' in an email claiming to be from someone who knows you?', 'It can be a sign the email is not genuinely personalised or trustworthy', TRUE),
  ('Why should you be cautious of a generic greeting such as ''Dear Customer'' in an email claiming to be from someone who knows you?', 'Generic greetings are always used by real colleagues', FALSE),
  ('Why should you be cautious of a generic greeting such as ''Dear Customer'' in an email claiming to be from someone who knows you?', 'It has no relevance to identifying phishing attempts', FALSE),
  ('Why should you be cautious of a generic greeting such as ''Dear Customer'' in an email claiming to be from someone who knows you?', 'It only matters in emails sent outside working hours', FALSE),
  ('Why should you be cautious of a generic greeting such as ''Dear Customer'' in an email claiming to be from someone who knows you?', 'It only applies to emails from unknown companies', FALSE)
) AS opt(question_text, option_text, is_correct) ON opt.question_text = nq.question_text;

-- Confirm: each module should now show 20 questions, 5 options each (100 options).
SELECT m.title, COUNT(DISTINCT qq.question_id) AS question_count, COUNT(ao.option_id) AS option_count
FROM training_modules m JOIN quizzes q ON q.module_id = m.module_id
JOIN questions qq ON qq.quiz_id = q.quiz_id
JOIN answer_options ao ON ao.question_id = qq.question_id
WHERE m.title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness')
GROUP BY m.title;

-- ============================================================================
-- SECTION: 22_add_quiz_levels.sql
-- ============================================================================
-- Adds level grouping to your existing 20 questions per quiz: Level 1 =
-- questions 1-5, Level 2 = 6-10, Level 3 = 11-15, Level 4 = 16-20 (based
-- on their existing sort_order). Also adds a level column to quiz_attempts
-- so each attempt is recorded against a specific level.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS level INTEGER;
UPDATE questions SET level = CEIL(sort_order / 5.0)::INTEGER;

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS level INTEGER;

-- Confirm: every quiz should show 4 levels of 5 questions each.
SELECT m.title, qq.level, COUNT(*) AS questions_in_level
FROM training_modules m JOIN quizzes q ON q.module_id = m.module_id JOIN questions qq ON qq.quiz_id = q.quiz_id
WHERE m.title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness')
GROUP BY m.title, qq.level ORDER BY m.title, qq.level;


-- ============================================================================
-- SECTION: 23_add_created_by.sql
-- ============================================================================
-- Adds a separate, permanent "created_by_id" column, independent from
-- trainer_id. trainer_id keeps controlling who currently manages the
-- quiz/puzzle and sees the module on their dashboard (this can change via
-- reassignment). created_by_id never changes after the module is made,
-- and always reflects the Administrator who originally created it.

ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(user_id);

UPDATE training_modules
SET created_by_id = (SELECT u.user_id FROM users u JOIN roles r ON u.role_id = r.role_id WHERE r.role_name = 'administrator' LIMIT 1)
WHERE created_by_id IS NULL;

SELECT m.title, m.trainer_id, tr.full_name AS assigned_trainer, m.created_by_id, cr.full_name AS created_by
FROM training_modules m
LEFT JOIN users tr ON m.trainer_id = tr.user_id
LEFT JOIN users cr ON m.created_by_id = cr.user_id;


-- ============================================================================
-- SECTION: 24_recalculate_module_progress.sql
-- ============================================================================
-- One-time fix: recalculates every existing module_progress row using the
-- CORRECT rule — all quiz levels passed AND all puzzles attempted — instead
-- of relying on stale status values set before the level system existed.

UPDATE module_progress mp
SET
  status = CASE WHEN (
    NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = mp.module_id)
    OR (
      (SELECT COUNT(DISTINCT qq.level) FROM quizzes q JOIN questions qq ON qq.quiz_id = q.quiz_id WHERE q.module_id = mp.module_id AND qq.level IS NOT NULL)
      <=
      (SELECT COUNT(DISTINCT qa.level) FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.quiz_id WHERE q.module_id = mp.module_id AND qa.user_id = mp.user_id AND qa.passed = TRUE AND qa.level IS NOT NULL)
    )
  ) AND (
    (SELECT COUNT(*) FROM hazard_scenes hs WHERE hs.module_id = mp.module_id)
    <=
    (SELECT COUNT(DISTINCT ha.scene_id) FROM hazard_attempts ha JOIN hazard_scenes hs ON ha.scene_id = hs.scene_id WHERE hs.module_id = mp.module_id AND ha.user_id = mp.user_id)
  )
  THEN 'completed' ELSE 'in_progress' END,
  percent_complete = CASE WHEN (
    NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = mp.module_id)
    OR (
      (SELECT COUNT(DISTINCT qq.level) FROM quizzes q JOIN questions qq ON qq.quiz_id = q.quiz_id WHERE q.module_id = mp.module_id AND qq.level IS NOT NULL)
      <=
      (SELECT COUNT(DISTINCT qa.level) FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.quiz_id WHERE q.module_id = mp.module_id AND qa.user_id = mp.user_id AND qa.passed = TRUE AND qa.level IS NOT NULL)
    )
  ) AND (
    (SELECT COUNT(*) FROM hazard_scenes hs WHERE hs.module_id = mp.module_id)
    <=
    (SELECT COUNT(DISTINCT ha.scene_id) FROM hazard_attempts ha JOIN hazard_scenes hs ON ha.scene_id = hs.scene_id WHERE hs.module_id = mp.module_id AND ha.user_id = mp.user_id)
  )
  THEN 100 ELSE 50 END,
  completed_at = CASE WHEN (
    NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = mp.module_id)
    OR (
      (SELECT COUNT(DISTINCT qq.level) FROM quizzes q JOIN questions qq ON qq.quiz_id = q.quiz_id WHERE q.module_id = mp.module_id AND qq.level IS NOT NULL)
      <=
      (SELECT COUNT(DISTINCT qa.level) FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.quiz_id WHERE q.module_id = mp.module_id AND qa.user_id = mp.user_id AND qa.passed = TRUE AND qa.level IS NOT NULL)
    )
  ) AND (
    (SELECT COUNT(*) FROM hazard_scenes hs WHERE hs.module_id = mp.module_id)
    <=
    (SELECT COUNT(DISTINCT ha.scene_id) FROM hazard_attempts ha JOIN hazard_scenes hs ON ha.scene_id = hs.scene_id WHERE hs.module_id = mp.module_id AND ha.user_id = mp.user_id)
  )
  THEN NOW() ELSE NULL END;

-- Confirm the corrected result.
SELECT u.full_name, m.title, mp.status, mp.percent_complete
FROM module_progress mp
JOIN users u ON mp.user_id = u.user_id
JOIN training_modules m ON mp.module_id = m.module_id
ORDER BY u.full_name, m.title;


-- ============================================================================
-- FINAL VERIFICATION — confirm the full setup landed correctly
-- ============================================================================
SELECT m.title, m.content_type, m.media_url, m.video_url,
  (SELECT COUNT(*) FROM module_images mi WHERE mi.module_id = m.module_id) AS extra_images,
  (SELECT COUNT(DISTINCT qq.question_id) FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id WHERE q.module_id = m.module_id) AS question_count,
  (SELECT COUNT(*) FROM hazard_scenes hs WHERE hs.module_id = m.module_id) AS puzzle_count
FROM training_modules m
WHERE m.title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness');
