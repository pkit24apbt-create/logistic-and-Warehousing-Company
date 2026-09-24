-- Run AFTER add_question_difficulty.sql.
-- 1) Expands each module's content_body with additional real sections.
-- 2) Tags the existing question in each quiz as 'medium'.
-- 3) Adds 4 more questions per quiz (2 easy, 1 medium, 1 hard), so each
--    quiz has 5 questions spanning all 3 difficulty levels.
-- Safe to re-run — every INSERT checks the question doesn't already exist.

-- ============================================================
-- Expand content: Manual Handling
-- ============================================================
UPDATE training_modules SET content_body = content_body ||
'

Warehouses commonly involve additional risks beyond a single lift, and these deserve their own attention. Pushing and pulling loaded trolleys or roll cages can strain the back and shoulders just as much as lifting if done incorrectly, always push rather than pull where possible, since pushing lets you use your body weight and see where you are going. Carrying a load up or down steps significantly increases the risk of a fall, use a lift or ramp instead wherever one is available, and never carry a load that blocks your view of the steps ahead.

Certain groups of employees may need extra consideration during manual handling tasks. New starters have not yet built up the physical conditioning that experienced staff have, and should be given lighter or assisted tasks during their first weeks. Anyone recovering from a previous injury should discuss their duties with their supervisor before returning to unrestricted manual handling. Pregnant employees should never be asked to lift beyond what they are comfortable with, and adjusted duties should always be offered without question.

Your legal duty as an employee under health and safety law is to make proper use of the equipment and training provided, and to take reasonable care of your own safety and the safety of others who may be affected by what you do. Your employer''s duty is to avoid the need for hazardous manual handling wherever reasonably possible, to assess any manual handling that cannot be avoided, and to reduce the risk of injury as far as reasonably practicable. Manual handling training like this module forms a core part of meeting that duty, but it only works if the techniques are actually applied on the floor, every lift, every shift.'
WHERE title = 'Manual Handling in the Warehouse';

-- ============================================================
-- Expand content: Hazard Perception
-- ============================================================
UPDATE training_modules SET content_body = content_body ||
'

Developing a structured approach helps turn hazard perception from a vague idea into a habit you can actually apply. One well known technique is the STOP method: Stop what you are doing for a moment, Think about what could go wrong in the task or area ahead of you, Observe your surroundings properly rather than glancing, and Proceed only once you are satisfied it is safe to continue. Running through STOP takes only a few seconds but catches a surprising number of hazards that would otherwise be missed.

It also helps to understand why hazards get missed in the first place. Normalisation of deviance happens when an unsafe condition, such as a slightly blocked walkway, persists for a while without incident, so people gradually stop noticing it as a problem at all. Time pressure narrows attention onto the immediate task and away from the wider environment. And familiarity with a route or task can create a false sense that nothing has changed since yesterday, when in fact conditions change throughout every single shift.

Consider a realistic example. A pallet of stock is left slightly overhanging the end of a racking bay overnight because it was quicker than fully re-stacking it at the end of a busy shift. Nobody walks into it that evening. The next morning, a different employee, focused on their tablet while walking the same route, collides with the corner of the pallet and suffers a shoulder injury. The hazard existed for many hours before it caused harm, and a single moment of hazard perception, by anyone who passed it, reporting an overhanging pallet, would have prevented the injury entirely. This is exactly the pattern that hazard perception training is designed to interrupt.'
WHERE title = 'Hazard Perception';

-- ============================================================
-- Expand content: Cyber Awareness
-- ============================================================
UPDATE training_modules SET content_body = content_body ||
'

Phishing emails have become increasingly sophisticated and can be difficult to distinguish from genuine communication at a glance. Look closely at the sender''s actual email address rather than just the display name, since attackers often use an address that looks similar to a real one but contains a small difference. Be cautious of generic greetings such as "Dear Customer" on messages that claim to be from someone who would normally know your name. Hover over links before clicking them, where possible, to see the actual web address they lead to, rather than trusting the visible text alone. And treat any message creating a strong sense of urgency or fear, such as threatening account suspension within hours, as an immediate warning sign rather than a reason to act quickly.

Multi factor authentication, where logging in requires both your password and a second step such as a code sent to your phone, is one of the single most effective protections against a stolen password being used successfully. Where your company systems offer multi factor authentication, always enable it, and never share a login code with anyone who contacts you asking for it, a genuine system will never need you to read a login code aloud to a person.

If you believe you may have already clicked a malicious link, entered your details on a fake site, or otherwise fallen for a phishing attempt, the correct response is to report it immediately rather than staying quiet out of embarrassment. Every minute matters in limiting the damage from a compromised account, and IT teams would always rather receive an early report that turns out to be a false alarm than discover a real breach days later because nobody said anything.'
WHERE title = 'Cyber Awareness';

-- ============================================================
-- Manual Handling — tag existing question, add 4 more (5 total)
-- ============================================================
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

-- ============================================================
-- Hazard Perception — tag existing question, add 4 more (5 total)
-- ============================================================
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

-- ============================================================
-- Cyber Awareness — tag existing question, add 4 more (5 total)
-- ============================================================
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

-- Confirm the result — each module should now show 5 questions.
SELECT m.title, COUNT(qq.question_id) AS question_count
FROM training_modules m
JOIN quizzes q ON q.module_id = m.module_id
JOIN questions qq ON qq.quiz_id = q.quiz_id
WHERE m.title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness')
GROUP BY m.title;


-- Single, complete fix. Run this ONE file only — it sets the image AND
-- the full content in one step per module, so there is no dependency on
-- running earlier scripts in a particular order. Safe to re-run any time.

-- ============================================================
-- Manual Handling
-- ============================================================
UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/manual-handling.jpg',
  content_body =
'Manual handling injuries, including back pain, muscle strain, and joint damage, remain one of the most common causes of lost working time in warehouse environments. Most of these injuries are entirely preventable with the right technique and the right judgement about when to ask for help or use equipment instead.

Before lifting anything, take a moment to assess the task using four simple checks: the Task itself (does it involve twisting, reaching, or repetition), the Individual doing the lift (is this within your own safe capability today), the Load (its weight, size, shape, and whether it has stable handholds), and the Environment (is the floor clear, dry, and well lit). If any of these raise concerns, stop and reconsider before you lift.

When you do lift, follow these steps every time. Stand close to the load with your feet shoulder-width apart for a stable base. Bend your knees, not your back, keeping your spine in its natural, neutral position. Get a firm grip on the load using the whole of your hand, not just your fingertips. Lift smoothly by straightening your legs, keeping the load close to your body throughout the movement. Never jerk the load upward, and never lift and twist at the same time, if you need to change direction, move your feet rather than twisting your spine.

For loads that are heavy, awkward, or need to travel any distance, use the mechanical aids provided, such as pallet trucks, trolleys, or hoists, rather than relying on manual effort. For loads too heavy or bulky for one person, always ask a colleague to team lift with you, and agree clearly who will count the lift and in which direction you will both move.

Repetitive lifting over a shift can cause fatigue-related injury even when individual lifts are within safe limits. Take regular breaks, rotate tasks with colleagues where possible, and vary your posture throughout the day.

If you feel any pain, strain, or discomfort during or after a lift, stop the task immediately and report it to your supervisor. Early reporting allows an injury to be assessed and treated before it becomes more serious, and helps identify whether the task itself needs to be redesigned to prevent the same injury happening to someone else.

Warehouses commonly involve additional risks beyond a single lift, and these deserve their own attention. Pushing and pulling loaded trolleys or roll cages can strain the back and shoulders just as much as lifting if done incorrectly, always push rather than pull where possible, since pushing lets you use your body weight and see where you are going. Carrying a load up or down steps significantly increases the risk of a fall, use a lift or ramp instead wherever one is available, and never carry a load that blocks your view of the steps ahead.

Certain groups of employees may need extra consideration during manual handling tasks. New starters have not yet built up the physical conditioning that experienced staff have, and should be given lighter or assisted tasks during their first weeks. Anyone recovering from a previous injury should discuss their duties with their supervisor before returning to unrestricted manual handling. Pregnant employees should never be asked to lift beyond what they are comfortable with, and adjusted duties should always be offered without question.

Your legal duty as an employee under health and safety law is to make proper use of the equipment and training provided, and to take reasonable care of your own safety and the safety of others who may be affected by what you do. Your employer''s duty is to avoid the need for hazardous manual handling wherever reasonably possible, to assess any manual handling that cannot be avoided, and to reduce the risk of injury as far as reasonably practicable. Manual handling training like this module forms a core part of meeting that duty, but it only works if the techniques are actually applied on the floor, every lift, every shift.'
WHERE title = 'Manual Handling in the Warehouse';

-- ============================================================
-- Hazard Perception
-- ============================================================
UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/hazard-perception.jpg',
  content_body =
'A hazard is anything with the potential to cause harm, whether that is an unsafe condition in the environment, a piece of damaged equipment, or an unsafe action taken by a person. Hazard perception is the skill of noticing these risks before they lead to an accident, and like any skill, it improves with deliberate, regular practice.

The biggest barrier to good hazard perception is complacency. Walking the same route through the warehouse every day can lead to tuning out your surroundings rather than actively observing them. Make a habit of consciously scanning your work area throughout your shift, not just at the start of it, paying attention to floor surfaces, storage heights, lighting levels, and the movement of vehicles and people around you.

Common categories of warehouse hazard include obstructed walkways and emergency exits, where boxes, pallets, or equipment are left somewhere they should not be. Damaged or overloaded racking, where a shelf shows signs of bending, leaning, or carries more weight than its rated capacity. Poor housekeeping, including spills, trailing cables, or general clutter in working areas. Vehicle and pedestrian conflict, such as forklifts operating in shared spaces without clear sightlines or adequate warning signals. And unsafe behaviour, where a colleague takes a shortcut or bypasses a safety control under time pressure.

When you notice a hazard, your responsibility does not end at simply avoiding it yourself. Report it to your supervisor as soon as possible so it can be corrected for everyone who uses that area, not just for you. If the hazard presents an immediate risk of serious harm, do not wait, cordon off the area, stop the activity, or move people away from danger, and then report it.

Near misses, situations where an accident almost happened but did not, deserve exactly the same attention as actual incidents. A near miss is a warning sign that, if acted on, can prevent a real injury from happening later. Reporting near misses is not an admission of fault, it is one of the most effective tools any warehouse has for catching problems before someone gets hurt.

Developing a structured approach helps turn hazard perception from a vague idea into a habit you can actually apply. One well known technique is the STOP method: Stop what you are doing for a moment, Think about what could go wrong in the task or area ahead of you, Observe your surroundings properly rather than glancing, and Proceed only once you are satisfied it is safe to continue. Running through STOP takes only a few seconds but catches a surprising number of hazards that would otherwise be missed.

It also helps to understand why hazards get missed in the first place. Normalisation of deviance happens when an unsafe condition, such as a slightly blocked walkway, persists for a while without incident, so people gradually stop noticing it as a problem at all. Time pressure narrows attention onto the immediate task and away from the wider environment. And familiarity with a route or task can create a false sense that nothing has changed since yesterday, when in fact conditions change throughout every single shift.

Consider a realistic example. A pallet of stock is left slightly overhanging the end of a racking bay overnight because it was quicker than fully re-stacking it at the end of a busy shift. Nobody walks into it that evening. The next morning, a different employee, focused on their tablet while walking the same route, collides with the corner of the pallet and suffers a shoulder injury. The hazard existed for many hours before it caused harm, and a single moment of hazard perception, by anyone who passed it, reporting an overhanging pallet, would have prevented the injury entirely. This is exactly the pattern that hazard perception training is designed to interrupt.'
WHERE title = 'Hazard Perception';

-- ============================================================
-- Cyber Awareness
-- ============================================================
UPDATE training_modules SET
  content_type = 'image',
  media_url = '/assets/photos/cyber-awareness.jpg',
  content_body =
'Cyber security is no longer just the responsibility of the IT department. Every employee who logs into a company system, opens a work email, or carries a work device is a potential target, and a potential line of defence. This module covers four key areas that apply to everyone, regardless of role.

Cyber fundamentals start with your own login credentials. Use a strong, unique password for each work system rather than reusing the same one everywhere, and never share your login details with anyone, including colleagues or anyone claiming to be from IT support over the phone or email. Always lock your screen whenever you step away from your desk, even for a moment, since an unlocked, unattended device is one of the simplest ways for company data to be accessed by someone who should not have it.

Safe home and remote working matters whenever you access company systems from outside the office. Use only company-approved devices and networks wherever possible. Keep your home router firmware updated, since outdated router software is a common weak point that attackers look for. Avoid working on sensitive company data over public Wi-Fi, such as in cafes or airports, where traffic can more easily be intercepted.

Social engineering is the term for attacks that target people rather than technology directly. Attackers often impersonate a trusted source, a manager, a supplier, or even IT support, to create a false sense of urgency. Be suspicious of unexpected requests for money transfers, password resets, or sensitive information, especially when they arrive by email or phone and pressure you to act immediately. If something feels off, verify the request through a separate, trusted channel, such as calling the person directly on a known number, before taking any action.

Mobile device security is increasingly important as more work happens on phones and tablets. Keep company data off personal devices where possible, and where it is unavoidable, ensure a passcode or biometric lock is enabled on any device that can access work email or files. If a device is lost or stolen, report it immediately so access can be revoked before it is misused, rather than waiting to see if it turns up.

If anything looks suspicious, an unexpected attachment, a link that does not quite match what it claims to be, or a request that feels slightly wrong, the correct action is always to report it to your IT or security team rather than clicking, replying, or forwarding it. Reporting a false alarm costs nothing. Missing a real one can cost the whole company dearly.

Phishing emails have become increasingly sophisticated and can be difficult to distinguish from genuine communication at a glance. Look closely at the sender''s actual email address rather than just the display name, since attackers often use an address that looks similar to a real one but contains a small difference. Be cautious of generic greetings such as "Dear Customer" on messages that claim to be from someone who would normally know your name. Hover over links before clicking them, where possible, to see the actual web address they lead to, rather than trusting the visible text alone. And treat any message creating a strong sense of urgency or fear, such as threatening account suspension within hours, as an immediate warning sign rather than a reason to act quickly.

Multi factor authentication, where logging in requires both your password and a second step such as a code sent to your phone, is one of the single most effective protections against a stolen password being used successfully. Where your company systems offer multi factor authentication, always enable it, and never share a login code with anyone who contacts you asking for it, a genuine system will never need you to read a login code aloud to a person.

If you believe you may have already clicked a malicious link, entered your details on a fake site, or otherwise fallen for a phishing attempt, the correct response is to report it immediately rather than staying quiet out of embarrassment. Every minute matters in limiting the damage from a compromised account, and IT teams would always rather receive an early report that turns out to be a false alarm than discover a real breach days later because nobody said anything.'
WHERE title = 'Cyber Awareness';

-- Confirm the result — every row must show content_type = 'image' and a
-- real media_url for the fix to be working.
SELECT title, content_type, media_url, trainer_id, LENGTH(content_body) AS content_length
FROM training_modules
WHERE title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness');

-- Sets content_type to 'video' and points media_url at the 3 downloaded
-- videos, matching the exact filenames you saved. This works exactly
-- like the image feature: content_type must be 'video' for the video
-- player to actually appear on the module page, and the video sits
-- above the text content, same position the hero image used to.
--
-- Save the 3 files into: frontend/public/assets/videos/
-- Using these exact filenames: manual-handling.mp4, cyber-awareness.mp4,
-- hazard-perception.mp4

UPDATE training_modules
SET content_type = 'video',
    media_url = '/assets/videos/manual-handling.mp4'
WHERE title = 'Manual Handling in the Warehouse';

UPDATE training_modules
SET content_type = 'video',
    media_url = '/assets/videos/hazard-perception.mp4'
WHERE title = 'Hazard Perception';

UPDATE training_modules
SET content_type = 'video',
    media_url = '/assets/videos/cyber-awareness.mp4'
WHERE title = 'Cyber Awareness';

-- Confirm the result — all 3 should show content_type = 'video' and the
-- correct media_url.
SELECT title, content_type, media_url
FROM training_modules
WHERE title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness');

-- Adds a separate video_url column so a module can show its hero image
-- AND a video together, rather than choosing one or the other. Safe to
-- re-run.

ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Reverts content_type/media_url back to the hero image (undoing the
-- earlier video swap), and sets the new video_url column separately, so
-- each module shows its hero image, its 2 in-content images, AND its
-- video, all together.

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

-- Confirm the result.
SELECT title, content_type, media_url, video_url
FROM training_modules
WHERE title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness');

-- Adds a short intro paragraph per module, shown between the hero photo
-- and the training video, giving real context before the video plays
-- rather than just a bare caption. Safe to re-run.

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

SELECT title, LEFT(intro_text, 60) AS intro_preview FROM training_modules
WHERE title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness');

-- Adds the Hazard Puzzle for Manual Handling and Cyber Awareness.
-- Safe to re-run — skips a module if it already has a scene.

-- ============================================================
-- Manual Handling: "Spot the Unsafe Lifting Technique"
-- Needs a photo showing someone lifting with poor posture (bent back,
-- load held far from body, twisting, or lifting alone without help).
-- Save it as: frontend/public/assets/photos/manual-handling-puzzle.jpg
-- ============================================================
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

-- ============================================================
-- Cyber Awareness: "Spot the Hazards: Office Cyber Security"
-- Needs a photo of a desk showing a sticky note, an unlocked screen, a
-- USB drive, and an email open, so distinct hotspots can be placed.
-- Save it as: frontend/public/assets/photos/cyber-awareness-puzzle.jpg
-- ============================================================
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
  (20.0, 45.0, 'Password written on a sticky note', 'Writing passwords down where others can see them defeats the purpose of having one. Use a password manager instead.'),
  (55.0, 35.0, 'Unlocked, unattended computer screen', 'A screen left unlocked while away from the desk lets anyone walking past access company systems. Always lock your screen when you step away.'),
  (40.0, 65.0, 'Unknown USB drive plugged into the computer', 'USB drives from an unknown source are a common way malware gets onto a company system. Never plug in a device you do not recognise.'),
  (75.0, 50.0, 'Suspicious email open on screen', 'Urgent, unexpected requests, especially involving money or credentials, are a classic phishing tactic. Verify through another channel before acting.')
) AS h(x, y, label, explanation)
WHERE s.module_id = (SELECT module_id FROM training_modules WHERE title = 'Cyber Awareness')
AND NOT EXISTS (SELECT 1 FROM hazard_hotspots WHERE scene_id = s.scene_id);

-- Confirm the result — both should now show a scene with 4 hotspots.
SELECT m.title, hs.title AS scene_title, COUNT(hh.hotspot_id) AS hotspot_count
FROM training_modules m
JOIN hazard_scenes hs ON hs.module_id = m.module_id
JOIN hazard_hotspots hh ON hh.scene_id = hs.scene_id
WHERE m.title IN ('Manual Handling in the Warehouse', 'Cyber Awareness')
GROUP BY m.title, hs.title;

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

-- Adds 3 more questions to each quiz, bringing the pool to 8 questions
-- per module (previously 5). A larger pool is what makes real question
-- rotation on retake possible — see quizRoutes.js change below, which
-- randomly draws 5 of these 8 each time the quiz is opened.

INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('What is the safest way to change direction while carrying a load?', 6, 'easy'),
  ('Why should a load be kept close to your body while lifting?', 7, 'medium'),
  ('What should you do if you feel pain during or after a lift?', 8, 'medium')
) AS x(question_text, sort_order, difficulty)
WHERE m.title = 'Manual Handling in the Warehouse'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id AND question_text = x.question_text);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Move your feet rather than twisting your spine', TRUE), ('Twist at the waist while keeping your feet still', FALSE), ('Keep walking forward regardless of direction', FALSE)) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse' AND qq.question_text = 'What is the safest way to change direction while carrying a load?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('It reduces the strain on your back compared to holding it away from you', TRUE), ('It makes the load look lighter to observers', FALSE), ('It has no real effect on safety', FALSE)) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse' AND qq.question_text = 'Why should a load be kept close to your body while lifting?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Stop the task immediately and report it to your supervisor', TRUE), ('Continue and mention it at the end of the shift', FALSE), ('Ignore it if the pain is mild', FALSE)) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse' AND qq.question_text = 'What should you do if you feel pain during or after a lift?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('What is the STOP method used for?', 6, 'easy'),
  ('Why should near misses be reported, even if nobody was hurt?', 7, 'medium'),
  ('What is normalisation of deviance?', 8, 'hard')
) AS x(question_text, sort_order, difficulty)
WHERE m.title = 'Hazard Perception'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id AND question_text = x.question_text);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('A structured way to pause and check an area for hazards before proceeding', TRUE), ('A way to stop machinery in an emergency', FALSE), ('A method for reporting completed training', FALSE)) AS opt(text, correct)
WHERE m.title = 'Hazard Perception' AND qq.question_text = 'What is the STOP method used for?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('It can prevent a real injury from happening later', TRUE), ('It is only useful for insurance records', FALSE), ('It is not necessary if nobody saw it happen', FALSE)) AS opt(text, correct)
WHERE m.title = 'Hazard Perception' AND qq.question_text = 'Why should near misses be reported, even if nobody was hurt?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('When an unsafe condition persists without incident and people stop noticing it', TRUE), ('A formal safety inspection process', FALSE), ('A type of protective equipment', FALSE)) AS opt(text, correct)
WHERE m.title = 'Hazard Perception' AND qq.question_text = 'What is normalisation of deviance?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty)
SELECT q.quiz_id, x.question_text, 'single', x.sort_order, x.difficulty
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('What is a good sign that an email might be a phishing attempt?', 6, 'easy'),
  ('Why should you never plug in an unknown USB drive?', 7, 'medium'),
  ('What should you do if you think you have already clicked a malicious link?', 8, 'medium')
) AS x(question_text, sort_order, difficulty)
WHERE m.title = 'Cyber Awareness'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id AND question_text = x.question_text);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('It creates a strong sense of urgency or fear', TRUE), ('It is addressed to you by name', FALSE), ('It comes from a colleague you recognise', FALSE)) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness' AND qq.question_text = 'What is a good sign that an email might be a phishing attempt?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('It is a common way malware gets onto a company system', TRUE), ('It will slow down your computer', FALSE), ('It has no real security risk', FALSE)) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness' AND qq.question_text = 'Why should you never plug in an unknown USB drive?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq JOIN quizzes q ON qq.quiz_id = q.quiz_id JOIN training_modules m ON q.module_id = m.module_id,
(VALUES ('Report it immediately rather than staying quiet', TRUE), ('Wait to see if anything bad actually happens', FALSE), ('Only mention it if asked directly', FALSE)) AS opt(text, correct)
WHERE m.title = 'Cyber Awareness' AND qq.question_text = 'What should you do if you think you have already clicked a malicious link?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);

-- Confirm the pool size per module.
SELECT m.title, COUNT(qq.question_id) AS total_question_pool
FROM training_modules m JOIN quizzes q ON q.module_id = m.module_id JOIN questions qq ON qq.quiz_id = q.quiz_id
WHERE m.title IN ('Manual Handling in the Warehouse', 'Hazard Perception', 'Cyber Awareness')
GROUP BY m.title;

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