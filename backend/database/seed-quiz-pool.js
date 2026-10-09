// SafeStack - fills every quiz level with a pool of 20 questions.
//
// The client asked for: 20 questions per level in the database, but only 10 shown
// per attempt, picked at random, and a different random 10 on every retake.
// The picking is done by backend/routes/quizRoutes.js; THIS script only makes sure
// each level of the three official modules really has 20 questions to pick from.
//
// HOW TO RUN (from the backend folder, the database settings come from your .env):
//
//     node database/seed-quiz-pool.js
//
// It is safe to run more than once: questions that are already there are kept,
// duplicates are skipped, and only the missing ones are added until every level
// has 20. Nothing is deleted. Each question has 4 answers and exactly 1 is correct.

const dbModule = require('../config/db');
const pool = dbModule.pool || dbModule;

const LEVELS = [1, 2, 3, 4];
const POOL_SIZE = 20;
const DIFFICULTY = { 1: 'easy', 2: 'medium', 3: 'medium', 4: 'hard' };

// [question, CORRECT answer, wrong answer, wrong answer, wrong answer]
const BANK = {
  'Manual Handling in the Warehouse': {
    1: [
      ['What is "manual handling"?', 'Moving or supporting a load by hand or bodily force', 'Moving loads only with a forklift', 'Only carrying items up stairs', 'Typing and using a computer keyboard'],
      ['What should you do first before lifting a load?', 'Plan the lift: check the weight, the route and where it will be put down', 'Lift it quickly before it gets heavier', 'Pull a tight belt around your waist', 'Jerk it off the floor to test its weight'],
      ['Which posture is best when lifting from the floor?', 'Bend your knees, keep your back straight and the load close', 'Keep your legs straight and bend from the waist', 'Twist your body while you lift', 'Hold the load out at arm\'s length'],
      ['Where should you hold a load while carrying it?', 'Close to your body', 'Away from your body at arm\'s length', 'Above shoulder height', 'Behind your back'],
      ['What should you do if a load is too heavy to lift safely on your own?', 'Ask for help or use a mechanical aid', 'Lift it anyway but very slowly', 'Drag it along the floor by one corner', 'Tip it over so it is easier to move'],
      ['Which footwear is suitable for manual handling work in a warehouse?', 'Safety footwear with good grip', 'Open sandals', 'Smooth-soled dress shoes', 'Flip-flops'],
      ['Which of these is a mechanical aid?', 'A pallet truck', 'A cardboard box', 'A pair of gloves', 'A clipboard'],
      ['Why is twisting your back while lifting dangerous?', 'It puts uneven strain on the spine and can cause injury', 'It makes the load heavier', 'It only matters with very light loads', 'It has no effect on the body'],
      ['What should you check for on the floor along your route before carrying a load?', 'Obstacles, spills and uneven surfaces', 'Only the colour of the floor', 'Nothing, the route does not matter', 'Only the temperature of the floor'],
      ['When should you ask a colleague for help with a lift?', 'When the load is heavy, bulky or awkward', 'Only when a supervisor is watching', 'Never, asking for help wastes time', 'Only on your first day'],
      ['What is the safest way to put down a heavy load?', 'Bend your knees and lower it, keeping your back straight', 'Drop it from waist height', 'Bend from the waist with straight legs', 'Throw it onto the shelf'],
      ['What should you do if you feel pain while lifting?', 'Stop, put the load down safely and report it', 'Keep going to finish the job', 'Lift faster to get it over with', 'Ignore it and hope it passes'],
      ['Which grip is best for lifting?', 'A firm, secure grip using the whole hand', 'Using only your fingertips', 'A loose grip so you can let go quickly', 'Hooking one finger under the edge'],
      ['What helps prepare your body for a shift with a lot of lifting?', 'Gentle warm-up movements and stretching', 'Lifting the heaviest load first as a warm-up', 'Skipping all breaks', 'Holding your breath during every lift'],
      ['Is it acceptable to carry a load that blocks your view of where you are going?', 'No, you must be able to see your route', 'Yes, if you walk slowly', 'Yes, if the load is light', 'Yes, if you walk quickly'],
      ['Which load needs extra care when lifting?', 'One with sharp edges or an unstable shape', 'One with a bright label', 'An empty cardboard box', 'A load that is already on the floor'],
      ['What is a "team lift"?', 'Two or more people lifting one load together in a planned way', 'Lifting while a team watches', 'Each person lifting a different load', 'Throwing a load between two people'],
      ['Who is responsible for lifting safely?', 'Everyone: employers provide training and equipment and workers follow it', 'Only the employer', 'Only the worker doing the lift', 'Only the safety officer'],
      ['Why use a lift instead of stairs when carrying a load, if one is available?', 'It lowers the risk of tripping and strain', 'Stairs are always closed to staff', 'Lifts are for visitors only', 'It uses less electricity'],
      ['Which stance helps you stay balanced when lifting?', 'Feet apart with one foot slightly forward', 'Feet together on tiptoes', 'Standing on one leg', 'Feet crossed over each other'],
    ],
    2: [
      ['What does TILE stand for in a manual handling risk assessment?', 'Task, Individual, Load, Environment', 'Time, Injury, Lifting, Energy', 'Training, Inspection, Lifting, Equipment', 'Task, Instruction, Load, Exercise'],
      ['In TILE, which factor covers the weight, shape and grip of the object?', 'Load', 'Task', 'Individual', 'Environment'],
      ['Which of these is an Environment factor?', 'A slippery floor or poor lighting', 'The age of the worker', 'The weight of the box', 'The number of lifts per hour'],
      ['Which of these is an Individual factor?', 'A person\'s health, strength and training', 'The lighting in the aisle', 'The shape of the load', 'The distance the load is carried'],
      ['Which of these is a Task factor?', 'Repeated twisting, stooping or lifting', 'A wet floor', 'A box with handles', 'Cold weather'],
      ['What is the best way to move a heavy load over a long distance?', 'Use a trolley or pallet truck', 'Carry it by hand without stopping', 'Slide it along the floor', 'Ask the smallest person to carry it'],
      ['Which height range is best for lifting and carrying?', 'Roughly between knee and shoulder height, with waist height best', 'Above head height', 'Floor level only', 'At arm\'s length above the shoulders'],
      ['When two people lift together, how should the movement be co-ordinated?', 'One person gives clear signals for lifting and lowering', 'Neither person speaks and they lift at once', 'Both give different instructions at the same time', 'The heavier person decides silently'],
      ['Why do repeated lifts increase the risk of injury?', 'Fatigue and strain build up even when each lift is light', 'Muscles become stronger with each lift', 'Loads become lighter over time', 'Only the first lift of the day carries any risk'],
      ['Which is generally safer with a loaded trolley?', 'Pushing it rather than pulling it', 'Pulling it rather than pushing it', 'Pulling it while walking backwards', 'There is never any difference'],
      ['Where should the heaviest items be stored on shelving?', 'On low or waist-height shelves', 'On the top shelf', 'On the highest shelf to save space', 'Anywhere that has a gap'],
      ['What should you do if the weight of a load is not marked?', 'Test it carefully by nudging it first, or ask someone', 'Assume it is light', 'Lift it with a jerk to find out', 'Guess and lift at full speed'],
      ['Why might you wear gloves for manual handling?', 'To protect your hands from splinters and sharp edges and improve grip', 'To make the load lighter', 'To replace training', 'To avoid wearing safety shoes'],
      ['What is the best way to move a long, awkward load such as a pipe?', 'Use two people and agree how to move together', 'Drag it by one end', 'Carry it alone on one shoulder while walking fast', 'Balance it on one hand'],
      ['There is a spill on your route. What should you do before carrying a load?', 'Clean it up if safe, or mark it and report it', 'Ignore it and step over it', 'Walk through it quickly', 'Cover it with loose cardboard'],
      ['How can you avoid twisting your back when turning with a load?', 'Move your feet to turn your whole body', 'Twist at the waist', 'Turn only your head', 'Throw the load to the side'],
      ['What should you do before carrying a load through a doorway?', 'Make sure the door is open and the way is clear', 'Kick the door open', 'Open it with your elbow while carrying the load', 'Slide the load through along the floor'],
      ['Which task is best done with a mechanical aid?', 'Moving a loaded pallet across the warehouse', 'Picking up a pen', 'Lifting one empty tray', 'Carrying a single sheet of paper'],
      ['What does a good manual handling risk assessment do?', 'Identifies hazards and ways to reduce the risk of injury', 'Replaces the need for training', 'Guarantees nobody is ever injured', 'Is only done after an injury'],
      ['How can fatigue from repeated handling be reduced?', 'Take regular breaks or change tasks', 'Work without a break to finish sooner', 'Only rest after an injury', 'Save all breaks until the end of the week'],
    ],
    3: [
      ['What is the first choice when dealing with a hazardous manual handling task?', 'Avoid the task where reasonably practicable', 'Rely on workers being strong', 'Ask workers to lift faster', 'Make the loads heavier'],
      ['What should an employer do about manual handling risks?', 'Assess the risks, reduce them and train staff', 'Only put up a poster', 'Nothing, if the worker is experienced', 'Only provide lunch breaks'],
      ['Which is a sign of a work-related musculoskeletal problem?', 'Persistent back, neck or joint pain after handling work', 'Feeling slightly thirsty', 'Hearing a fire alarm test', 'Having a short cold'],
      ['Why should pain, injuries and near misses be reported?', 'So the cause can be found and fixed', 'To get colleagues into trouble', 'It is not necessary', 'To use up the report forms'],
      ['How should a pallet be stacked so it is stable?', 'Heaviest items at the bottom, evenly spread and within the pallet edges', 'Heaviest items on top', 'Overhanging the edges to fit more', 'In a lean so it holds itself up'],
      ['Who may use a pallet truck?', 'Only people who are trained and authorised', 'Any employee', 'Anybody who is in a hurry', 'Visitors helping out'],
      ['How high should a stack be?', 'No higher than the site limit, so it stays stable and visible', 'As high as you can reach', 'Until it touches the roof', 'There is no limit on pallets'],
      ['What should you do if a mechanical aid is faulty?', 'Stop using it, tag it and report it', 'Use it carefully anyway', 'Repair it yourself without training', 'Lend it to another team'],
      ['Why does manual handling training matter?', 'Safe technique and correct use of equipment reduce injuries', 'It is only paperwork', 'It is only for visitors', 'It is only for managers'],
      ['Why take extra care when lifting in a cold area?', 'Cold muscles and numb hands raise the risk of injury', 'Cold makes loads lighter', 'Cold has no effect on lifting', 'Gloves are banned in cold areas'],
      ['A worker returns after a back injury. What should happen?', 'Their tasks should be reviewed and adjusted for them', 'They should lift exactly as before from day one', 'They should hide the injury', 'They should be given the heaviest loads'],
      ['What does a blue circular safety sign tell you?', 'Something you must do', 'Something you must not do', 'Where the emergency exit is', 'That there is a hazard ahead'],
      ['Why should you read weight labels on loads?', 'They help you plan how to handle the load', 'They are only for lorry drivers', 'They are decorations', 'They can be ignored if you are strong'],
      ['How should you reach items on high shelves?', 'Use steps or a platform designed for the job', 'Climb the racking', 'Stand on a pallet', 'Stand on a box'],
      ['How can job rotation help with repetitive handling?', 'It reduces strain on the same muscles', 'It makes strain worse', 'It does nothing', 'It is only for managers'],
      ['What extra care is needed when handling a container of liquid?', 'The contents can shift, so take care and keep the load steady', 'None, liquids are always stable', 'Shake it to check how full it is', 'Lift it fast so nothing spills'],
      ['What is a hazard when carrying long items?', 'Hitting people or objects with the ends or at corners', 'There is no hazard', 'Only electrical hazards', 'Only a hazard in the dark'],
      ['Who can stop a lift that looks unsafe?', 'Anyone, and they should ask for a safer method', 'Only the manager', 'Only the owner', 'Nobody once it has started'],
      ['A supervisor asks for a lift beyond what is safe. What should you do?', 'Explain your concern and ask for equipment or help', 'Do it silently', 'Refuse to talk about it', 'Lift anyway to avoid an argument'],
      ['Why does good housekeeping matter for manual handling?', 'Clear routes and loading areas prevent trips while carrying', 'It only makes the warehouse look nice', 'It has no safety value', 'It is only needed on Fridays'],
    ],
    4: [
      ['You must put a 25 kg box on a shelf at head height. What is the safest approach?', 'Use a platform or mechanical aid, or ask for help, so you do not lift above shoulder height', 'Stretch up and throw it onto the shelf', 'Stand on a chair and lift it', 'Jump and push it up'],
      ['During a team lift, your end feels much heavier than expected. What should you do?', 'Say "stop" and lower the load together', 'Keep lifting without saying anything', 'Drop your end at once', 'Let go and step back'],
      ['You are told to unload 200 cartons by hand in one hour with no breaks. What is the best response?', 'Raise the concern and ask for rotation, breaks or equipment', 'Do it as fast as possible', 'Skip your safety checks to save time', 'Work through lunch'],
      ['A stack of pallets is leaning slightly. What should you do?', 'Keep clear, keep others away and report it so it can be re-stacked safely', 'Push it upright with your shoulder', 'Pull a pallet from the bottom', 'Climb up to straighten it'],
      ['The floor near the loading dock is wet and you are carrying a load. What should you do?', 'Stop, mark or clean the spill, or report it, and avoid carrying through it', 'Run through it quickly', 'Balance the load on one foot', 'Cover it with loose boxes'],
      ['Which combination of factors increases the risk the most?', 'A heavy, awkward load carried a long way while twisting', 'A light box lifted once at waist height', 'A trolley pushed along a smooth floor', 'A team lift with clear signals'],
      ['You bruise your hand while lifting but feel fine. Should you report it?', 'Yes, so the cause can be reviewed and others protected', 'No, it is too minor', 'Only if it bleeds', 'Only if a friend asks'],
      ['Which statement about lifting belts is correct?', 'They do not replace safe technique or proper risk control', 'They make any load safe to lift', 'They remove the need for training', 'They let you lift heavier loads freely'],
      ['Which control is most effective in the hierarchy of control?', 'Removing the manual lift altogether, for example with a conveyor to the point of use', 'Telling workers to be careful', 'Putting up a warning poster', 'Providing gloves'],
      ['A load on your trolley is stacked too high to see over. What should you do?', 'Reduce the stack or use a guide, because you must see ahead', 'Push it faster to get it done', 'Lean to one side while pushing quickly', 'Push it blindly because aisles are usually empty'],
      ['After repeating the same lift all day, your hands are tingling. What should you do?', 'Stop the task, report the symptoms and ask for the task to be reviewed', 'Shake your hands and carry on', 'Take a painkiller and continue', 'Ignore it for the rest of the week'],
      ['You find a carton with a torn bottom. What is the safe response?', 'Do not lift it by the base; repack or reinforce it, or move it with a pallet truck', 'Lift it quickly before it spills', 'Hold the torn bottom with your fingertips', 'Throw it onto the next pallet'],
      ['Which of these is a manual handling "near miss"?', 'A load slips from your grip and falls without hurting anyone', 'A worker is injured while lifting', 'A delivery arrives early', 'A delivery arrives late'],
      ['Where should heavy items be placed when loading a vehicle?', 'Low down and secured so they cannot move', 'On top near the door', 'Loosely at the back', 'Anywhere, unsecured'],
      ['Why should you never rush a lift?', 'Rushing leads to poor posture, slips and drops', 'Rushing makes loads lighter', 'Rushing improves control', 'Rushing saves time with no extra risk'],
      ['A load is heavier on one side than the other. How should you handle it?', 'Keep the heavier side close to your body and use two people if needed', 'Hold only the lighter side', 'Lift it one-handed', 'Ignore the difference'],
      ['Which is the best order for a safe lift?', 'Plan, position your feet, bend your knees, grip, lift smoothly, carry close, lower smoothly', 'Grip, jerk, twist, carry, drop', 'Lift, then check the weight, then plan', 'Twist, lift, bend'],
      ['A new colleague is lifting with a rounded back. What should you do?', 'Politely show the correct technique and tell a supervisor if needed', 'Laugh and walk away', 'Say nothing', 'Copy what they are doing'],
      ['Which record helps show that manual handling training was completed?', 'Training records', 'The lunch menu', 'A visitor badge', 'A delivery note'],
      ['A colleague says "I have lifted like this for years, so it is fine". What is the best response?', 'Years of practice do not remove the strain, so follow the assessed method', 'Agree that experience replaces the rules', 'Ignore the risk assessment', 'Praise them for taking risks'],
    ],
  },

  'Hazard Perception': {
    1: [
      ['What is a hazard?', 'Anything that could cause harm', 'Only an accident that has already happened', 'Only moving machinery', 'A rule written on a sign'],
      ['What is risk?', 'The chance that a hazard will cause harm, and how serious that harm could be', 'Another word for an accident', 'The cost of safety equipment', 'A type of safety poster'],
      ['What should you do first when you notice a hazard?', 'Make it safe if you can do so safely, or warn others, and report it', 'Ignore it, someone else will deal with it', 'Mention it at the end of the week', 'Take a photo and walk away'],
      ['Which of these is a slip hazard?', 'A spillage on the floor', 'A closed fire door', 'A labelled shelf', 'A lit exit sign'],
      ['Which of these is a trip hazard?', 'A cable lying across a walkway', 'A clear walkway', 'A painted line on the floor', 'A sign on the wall'],
      ['Why must walkways be kept clear?', 'So people can move and escape safely', 'So the warehouse looks tidy for visitors', 'To save electricity', 'So forklifts can drive faster'],
      ['What does PPE stand for?', 'Personal Protective Equipment', 'Public Property Entry', 'Primary Power Equipment', 'Protected Pallet Edge'],
      ['Why is high-visibility clothing worn?', 'So that vehicle drivers can see you', 'To keep warm', 'To show you are senior', 'To make clothing lighter'],
      ['Which of these should be reported?', 'Damaged racking', 'A tidy aisle', 'A clear sign', 'A charged scanner'],
      ['What do green safety signs show?', 'A safe condition such as an exit or first aid point', 'Danger', 'Something you must do', 'Something you must not do'],
      ['What does a red circle with a line through it mean?', 'Prohibition: something you must not do', 'You must wear protection', 'A safe route', 'A warning of danger'],
      ['Why should you look ahead while walking in a warehouse?', 'To spot hazards early', 'To walk faster', 'To avoid greeting people', 'It only matters for drivers'],
      ['Should you use your mobile phone while walking in warehouse aisles?', 'No, keep your attention on your surroundings', 'Yes, if you walk slowly', 'Yes, near forklifts', 'Yes, but only to send texts'],
      ['Who is responsible for noticing hazards?', 'Everyone on site', 'Only managers', 'Only the safety officer', 'Only visitors'],
      ['What is a good habit at the start of a shift?', 'Check your work area for hazards', 'Skip checks to save time', 'Move objects without looking', 'Switch off alarms'],
      ['Why is poor lighting a hazard?', 'It makes other hazards harder to see', 'It makes floors wetter', 'It makes the air cooler', 'It makes loads heavier'],
      ['Where should you walk in a warehouse?', 'In the marked pedestrian walkways', 'Wherever is fastest', 'Along the forklift routes', 'Between the racking'],
      ['Which of these is a fire hazard?', 'Rubbish piled up near electrical equipment', 'A clear fire exit', 'A tested fire extinguisher', 'A fire action sign'],
      ['What should you do about a spill that has been left?', 'Clean it up if safe, or mark it and report it', 'Walk around it', 'Cover it with paper', 'Leave it for the next shift'],
      ['What should happen to a damaged pallet?', 'It should be taken out of use and reported', 'It can be used if only slightly broken', 'It should go at the bottom of a stack', 'It should be painted and reused'],
    ],
    2: [
      ['A forklift is coming along the aisle towards you. What should you do?', 'Stand clear and make eye contact with the driver', 'Run ahead of it', 'Stand in its path', 'Keep walking with headphones on'],
      ['Where are pedestrians safest around forklifts?', 'In designated walkways separated from vehicle routes', 'Beside the forklift', 'Under raised forks', 'Behind a reversing truck'],
      ['What should you never walk under?', 'Raised forks or a suspended load', 'A lit bay', 'A painted line', 'A pallet on the floor'],
      ['A forklift is reversing. What should you do?', 'Stay clear, because the driver\'s view is limited', 'Walk behind it to cross quickly', 'Stand directly behind it', 'Follow close behind it'],
      ['What should a driver do at a blind corner?', 'Slow down, sound the horn and use mirrors or stop and look', 'Speed through it', 'Turn the lights off', 'Close their eyes and turn'],
      ['Who may drive a forklift?', 'Only trained and authorised operators', 'Any employee', 'Anyone with a car licence', 'Anyone who has found the keys'],
      ['Which of these makes a forklift unstable?', 'A raised load while turning at speed', 'A low load while stationary', 'A level surface', 'Lowered forks'],
      ['How should the forks be positioned when carrying a load?', 'Low, with the mast tilted slightly back', 'High for better visibility', 'Fully raised', 'Tilted forward'],
      ['How should visitors be managed in a warehouse?', 'Escorted, in hi-vis and kept to pedestrian routes', 'Left to roam freely', 'Allowed in forklift lanes', 'Given no information'],
      ['You hear a forklift horn at a junction. What should you do?', 'Stop and check before crossing', 'Cross quickly', 'Ignore it', 'Step into the aisle'],
      ['How should pedestrians cross a vehicle route?', 'At a designated crossing, looking both ways', 'Anywhere that is convenient', 'By running across', 'Between the racking'],
      ['Why should headphones not be worn in vehicle areas?', 'You may not hear warnings or horns', 'They get damaged', 'They are too heavy', 'They make you walk faster'],
      ['The load blocks the driver\'s view forward. What should the driver do?', 'Drive in reverse or use a guide', 'Drive forward blindly', 'Raise the load higher', 'Rely on the horn only'],
      ['Why must speed limits be followed?', 'They reduce stopping distances and the risk of collisions', 'They are optional', 'They are for visitors only', 'They can be ignored when late'],
      ['What should a forklift driver check before use each day?', 'Brakes, steering, forks, horn and lights', 'Nothing', 'Only the fuel', 'Only the paintwork'],
      ['What should be done with a damaged forklift?', 'Take it out of service and report it', 'Use it gently', 'Use it after the shift', 'Use it for light loads only'],
      ['How should a forklift be parked?', 'Forks lowered, brake on, keys removed, in the designated area', 'Forks raised in the aisle', 'Engine running', 'Keys left in'],
      ['A pallet is blocking the pedestrian walkway. What should you do?', 'Report it and do not use the vehicle lane; move it only if safe', 'Walk in the vehicle lane', 'Climb over it', 'Ignore it'],
      ['What does a warning triangle with a forklift symbol mean?', 'Vehicles operate in this area', 'This is an exit', 'You must wear gloves', 'No entry for pedestrians only'],
      ['Why is eye contact with a driver important?', 'It confirms the driver has seen you', 'It makes the driver go faster', 'It is polite but has no safety value', 'It is not needed'],
    ],
    3: [
      ['Which is a sign that racking may be overloaded?', 'Bowed beams or loads above the safe working load notice', 'Fresh paint', 'A bright colour', 'Plenty of space in the bay'],
      ['What does a safe working load notice on racking show?', 'The maximum load allowed per beam or bay, which must never be exceeded', 'The minimum load required', 'The age of the racking', 'The name of the supplier'],
      ['Racking has been hit by a forklift. What should you do?', 'Report it at once and keep people away until it is inspected', 'Push it back into place', 'Carry on working as normal', 'Paint over the damage'],
      ['Where should heavy items be stored on racking?', 'On the lower levels', 'On the highest level', 'Overhanging the beam edges', 'In the walkways'],
      ['Why is a pallet overhanging the beams unsafe?', 'It is not properly supported and could fall', 'It gives more capacity safely', 'It is required by the rules', 'It makes the racking stronger'],
      ['How should fire exits be kept during working hours?', 'Clear and unlocked', 'Used for storing pallets', 'Locked for security', 'Hidden behind stock'],
      ['What should you do first if you discover a small fire?', 'Raise the alarm', 'Fight it alone without telling anyone', 'Leave without telling anyone', 'Film it'],
      ['What is the rule for fire doors?', 'Never wedge them open', 'Wedge them open for airflow', 'Remove them for access', 'Paint them to match the wall'],
      ['How should flammable liquids be stored?', 'In approved cabinets away from sources of ignition', 'In the aisles', 'Next to heaters', 'In unlabelled containers'],
      ['What should you do with a damaged electrical cable?', 'Do not use it; report it and tag it out of use', 'Wrap tape around it and use it', 'Hide it behind a shelf', 'Use it for short jobs only'],
      ['How often should housekeeping be done?', 'Continuously: clean as you go', 'Once a year', 'Only by the night shift', 'Never, it is not needed'],
      ['What should you do before climbing a ladder?', 'Inspect it and keep three points of contact while climbing', 'Use a box instead', 'Lean it at any angle', 'Carry heavy items up with one hand'],
      ['How should boxes be stacked?', 'Stable, squared and below the safe height', 'Leaning against each other', 'As high as possible', 'In a mixed, uneven pile'],
      ['What should you do before using a chemical?', 'Read the hazard label and follow the safety data sheet', 'Smell it to identify it', 'Mix it with another to make it stronger', 'Ignore the label'],
      ['Why should you know where the spill kit is?', 'So you can use it quickly if you are trained', 'It is hidden for security', 'It is never used', 'It is a toy for training'],
      ['How should gas cylinders be stored?', 'Secured upright so they cannot fall', 'Rolled to the side of the aisle', 'Laid flat in a stack', 'Stacked on top of each other'],
      ['What should you do near a loading dock edge?', 'Keep clear of the edge and use barriers or guards', 'Stand at the edge to watch', 'Sit on the edge', 'Walk along the edge'],
      ['When must hearing protection be worn?', 'Where signs or the risk assessment require it', 'Never', 'Only by supervisors', 'Only when shouting'],
      ['What should you do when the alarm sounds?', 'Go to the assembly point by the nearest safe exit', 'Go home', 'Return inside to check', 'Wait at the exit door'],
      ['What should you know about first aid?', 'Where the kit and the first aiders are', 'Nothing, it is for managers', 'That the kit is kept locked away', 'That kits are never needed'],
    ],
    4: [
      ['You see a forklift reversing without the driver looking, and a pedestrian is behind it. What should you do?', 'Shout or signal to stop if it is safe to do so, then report it', 'Film it on your phone', 'Walk away', 'Assume everything will be fine'],
      ['Which control is most effective in the hierarchy of control?', 'Eliminating the hazard', 'Using PPE', 'Putting up warning signs', 'Giving training only'],
      ['A near miss happens. What should you do?', 'Report it so the cause can be fixed', 'Hide it so nobody worries', 'Joke about it', 'Delete the evidence'],
      ['You find a hazard you cannot fix yourself. What is the best action?', 'Make the area safe with a barrier or sign and report it to your supervisor', 'Leave it alone', 'Take a photo and go home', 'Wait for an accident to happen'],
      ['Why can experienced workers miss hazards?', 'Complacency: familiar routes are not actively scanned', 'They cannot see well', 'Hazards only appear for beginners', 'Rules change every day'],
      ['What is the best way to scan for hazards?', 'Look at the whole scene from floor to ceiling and side to side', 'Look only straight ahead', 'Look only at the floor', 'Look only at your feet'],
      ['A wet floor, poor lighting and forklift traffic together are...', 'A combined risk that is greater than any one alone', 'A reduced risk', 'No risk', 'A risk only for visitors'],
      ['What does a risk assessment record?', 'The hazards, who might be harmed and the controls in place', 'Only the names of staff', 'Only the cost of equipment', 'Only sales figures'],
      ['A spill is near a pedestrian crossing used by forklifts. What should you do first?', 'Cordon it off, warn others, then clean it up', 'Ignore it', 'Wait for the shift to end', 'Mop it later'],
      ['A racking beam looks bowed. What should you do?', 'Keep people clear, unload only if instructed, and report it', 'Add more load to test it', 'Push it back straight', 'Hide it with stock'],
      ['A visitor walks onto the floor without PPE. What should you do?', 'Politely stop them and escort them to collect the right PPE', 'Ignore them', 'Join them', 'Take their photo'],
      ['You are pressured to hurry in an unsafe way. What should you do?', 'Put safety first and report the concern', 'Rush to keep everyone happy', 'Skip the checks', 'Hide the problem'],
      ['The fire alarm sounds during your shift. What should you do?', 'Stop work and leave by the nearest safe exit to the assembly point', 'Finish your task first', 'Collect your belongings', 'Use the goods lift'],
      ['A ladder feels unstable. What should you do?', 'Do not use it and report it', 'Use it anyway', 'Wedge it with a box', 'Hold it with one hand and climb'],
      ['What should a good hazard report include?', 'What the hazard is, where it is, when you saw it and any action taken', 'Only the word "problem"', 'Only your name', 'Nothing, a verbal hint is enough'],
      ['Which hazard could cause the most severe harm?', 'A load falling from racking onto a pedestrian', 'A slightly scuffed floor', 'A faded sign', 'A dusty shelf'],
      ['Which question helps a hazard-spotting mindset?', '"What could go wrong here?"', '"It never happens here"', '"It is not my area"', '"I am too busy"'],
      ['After a hazard has been fixed, what should happen?', 'Check the fix works and update the records', 'Forget about it', 'Remove the warning sign immediately', 'Delete the report'],
      ['An emergency exit is blocked during a busy period. What should you do?', 'Clear it immediately or report it urgently; never leave it blocked', 'Wait until it is quiet', 'Block it further', 'Lock it'],
      ['You find an unlabelled container of liquid. What should you do?', 'Do not touch or open it; keep others away and report it', 'Smell it to identify it', 'Taste a drop', 'Pour it down a drain'],
    ],
  },

  'Cyber Awareness': {
    1: [
      ['What makes a strong password?', 'It is long and mixes words, numbers and symbols, and is hard to guess', 'It is your name and birth year', 'It is "password123"', 'It is the same one used for your email'],
      ['Should you use the same password for every account?', 'No, one data breach would expose all your accounts', 'Yes, it is easier to remember', 'Yes, but only for work', 'Yes, but only for online shopping'],
      ['What is phishing?', 'Fraudulent messages designed to trick you into giving information or clicking', 'A fishing hobby', 'A type of antivirus', 'A network cable'],
      ['An email asks you to verify your account by clicking a link. What should you do?', 'Do not click; go to the official site yourself or report it', 'Click it immediately', 'Reply with your password', 'Forward it to everyone'],
      ['Should you share your password with a colleague?', 'No, accounts are personal', 'Yes, when you are busy', 'Yes, if they work in IT', 'Yes, in a chat message'],
      ['What should you do when you leave your desk?', 'Lock your screen', 'Leave it as it is', 'Lock it only at night', 'Lock it only if the manager is around'],
      ['Which is the safest way to use public Wi-Fi?', 'Avoid sensitive work, or use a company VPN', 'Use it for online banking', 'Share your login with others on it', 'Treat it as always safe'],
      ['What should you do about antivirus software?', 'Keep it installed and up to date', 'Switch it off to speed up the PC', 'Treat it as optional', 'Delete it'],
      ['You find a USB stick in the car park. What should you do?', 'Do not plug it in; hand it to IT', 'Plug it in to see who owns it', 'Take it home', 'Share the files on it'],
      ['Why should you install software updates promptly?', 'They fix security weaknesses', 'They make the screen brighter', 'They are not important', 'They delete your files'],
      ['What is malware?', 'Software designed to harm a device or steal data', 'An email service', 'A piece of hardware', 'A type of backup'],
      ['Is it safe to keep your password on a sticky note on your monitor?', 'No, anyone nearby could read it', 'Yes, it is easy to find', 'Yes, if it is a small note', 'Yes, if it is yellow'],
      ['What should you look for on a secure website?', 'https and a padlock, while still checking the address is correct', 'Lots of adverts', 'A bright colour scheme', 'Pop-up windows'],
      ['What should you do with a suspicious email attachment?', 'Do not open it; report it', 'Open it to check', 'Forward it to colleagues', 'Download it to your desktop'],
      ['What is multi-factor authentication (MFA)?', 'An extra step to prove who you are, such as a code on your phone', 'A faster way to log in', 'A type of virus', 'A backup copy of your files'],
      ['Who should you tell about a cyber security concern?', 'The IT or security team, or your supervisor', 'Nobody', 'Someone on social media', 'A competitor'],
      ['What do regular backups protect against?', 'Loss of data, for example from ransomware or hardware failure', 'Only bad weather', 'Only typing mistakes', 'Nothing'],
      ['Is it safe to leave a work laptop in a parked car?', 'No, it should not be left unattended', 'Yes, in the boot', 'Yes, if only for a short time', 'Yes, if it is locked'],
      ['Which is the best way to build a strong passphrase?', 'Join several random words with numbers or symbols', 'Use a single dictionary word', 'Use 12345', 'Use "qwerty"'],
      ['Why is oversharing on social media a risk?', 'Attackers can use it to guess passwords or target you', 'It has no effect on security', 'It improves your security', 'It is required by the company'],
    ],
    2: [
      ['An urgent email from "the CEO" asks you to buy gift cards. What should you do?', 'Verify it through a separate trusted channel before acting', 'Buy them immediately', 'Reply with the card numbers', 'Forward it to the whole team'],
      ['You hover over a link and the address is different from the text. What does this suggest?', 'It may be malicious, so do not click it', 'It is perfectly safe', 'You should click it twice', 'You should open it in a private window'],
      ['What should you check about an email sender?', 'The real email address, because display names can be faked', 'Only the display name', 'Only the logo', 'Only the subject line'],
      ['What is spear phishing?', 'A targeted message that uses personal details about you', 'Random spam sent to millions', 'A fishing sport', 'A hardware fault'],
      ['What is smishing?', 'Phishing carried out by text message', 'Phishing by post', 'Phishing by phone call only', 'Phishing by email only'],
      ['What is vishing?', 'Phishing carried out by phone call', 'Phishing by text', 'A video game scam', 'A type of virus'],
      ['What does a password manager do?', 'Stores unique strong passwords securely', 'Shares passwords with everyone', 'Stores passwords as plain text', 'Replaces software updates'],
      ['How should you protect a company laptop when travelling?', 'Keep it with you and use a privacy screen where possible', 'Leave it on the seat', 'Lend it to a fellow passenger', 'Leave it unlocked in a bag'],
      ['What is tailgating?', 'Following someone through a secure door without using your own badge', 'Driving close behind a forklift', 'Tracking an email', 'A slow Wi-Fi connection'],
      ['What should you do if you see someone without a badge in a secure area?', 'Politely challenge them or report it', 'Ignore them', 'Hold the door open for them', 'Lend them your badge'],
      ['What is shoulder surfing?', 'Someone watching your screen or keyboard to steal information', 'Surfing the internet', 'A Wi-Fi setting', 'A cleaning method'],
      ['Should your device connect automatically to open Wi-Fi networks?', 'No, turn auto-connect off', 'Yes, always', 'Yes, it is required', 'Yes, it is always safe'],
      ['Should you store work files in your personal cloud account?', 'No, unless it is approved by the company', 'Yes, it is fine', 'Yes, it is required', 'Yes, because it is faster'],
      ['You clicked a bad link. What should you do?', 'Report it to IT immediately', 'Hide it and hope for the best', 'Wait a few days to see what happens', 'Reinstall your system alone'],
      ['What is ransomware?', 'Malware that locks files and demands payment', 'Free software', 'An antivirus program', 'A backup tool'],
      ['Your files are locked by ransomware. What should you do?', 'Report it to IT; paying does not guarantee you get the files back', 'Always pay the ransom', 'Pay twice to be safe', 'Negotiate with the criminals yourself'],
      ['How should confidential data be handled?', 'In line with company policy and its classification', 'Posted online', 'Shared with everyone', 'Printed and left on a desk'],
      ['What should you do with printed sensitive documents?', 'Collect them promptly and shred them when finished', 'Leave them on the printer', 'Put them whole in the general bin', 'Take them home'],
      ['What is the safe way to work remotely?', 'Use the company-approved VPN and a secure network', 'Use café Wi-Fi without any protection', 'Share your work device with family', 'Turn off security software'],
      ['How can you avoid a fake login page?', 'Check the web address and use a bookmark you trust', 'Trust any link you are sent', 'Trust a page because it looks right', 'Ignore the address bar'],
    ],
    3: [
      ['Which is a data protection principle?', 'Collect only the personal data you need and keep it secure', 'Collect as much data as possible', 'Share personal data freely', 'Keep all data forever'],
      ['Which of these is personal data?', 'An employee\'s name and home address', 'Tomorrow\'s weather forecast', 'A published share price', 'The size of the warehouse'],
      ['What should you do if you suspect a data breach?', 'Report it immediately so action can be taken in time', 'Hide it', 'Wait to see if it gets worse', 'Delete the evidence'],
      ['What is social engineering?', 'Manipulating people into giving access or information', 'Designing network cables', 'Building a social media page', 'Writing software'],
      ['What is pretexting?', 'Inventing a believable scenario to gain trust and information', 'Sending a gift', 'Running a test', 'Installing an update'],
      ['A caller says they are from IT and asks for your password. What should you do?', 'Refuse, because IT never needs your password, and report it', 'Give it to them', 'Spell it slowly', 'Send it by email'],
      ['What is baiting in a cyber attack?', 'Leaving infected devices or free offers as a lure', 'Fishing for compliments', 'A type of staff training', 'A backup method'],
      ['What is the principle of least privilege?', 'Users get only the access they need for their job', 'Everyone is an administrator', 'Accounts are shared between staff', 'Nobody has any access'],
      ['What should happen to a leaver\'s access?', 'It should be removed promptly', 'It should stay forever', 'It should be shared with their team', 'It should be left until they ask'],
      ['What does encryption do?', 'Scrambles data so only authorised people can read it', 'Deletes data', 'Speeds up the network', 'Makes files smaller'],
      ['What does a "clear desk" policy require?', 'Locking away sensitive papers and devices when you leave', 'Leaving papers out for others', 'Photographing documents', 'Piling documents neatly on the desk'],
      ['You emailed personal data to the wrong person. What should you do?', 'Report it as a possible data breach', 'Ignore it', 'Delete the sent email and say nothing', 'Send it to more people to correct it'],
      ['You get repeated MFA prompts you did not request. What should you do?', 'Deny them and report it', 'Approve one to make them stop', 'Ignore them', 'Approve them all'],
      ['What is shadow IT?', 'Using unapproved apps or devices for work', 'Working in a dark room', 'Approved company tools', 'A type of backup'],
      ['What is the rule for using personal devices for work (BYOD)?', 'They must follow company policy and security rules', 'There are no rules', 'They can be shared freely', 'Security software should be disabled'],
      ['Why should scanners and other connected devices be updated?', 'Their firmware can contain security weaknesses', 'They never need updates', 'Updates make them slower', 'Updates are for managers only'],
      ['How should the master password of a password manager be set up?', 'Strong, unique and protected with MFA', 'The same as your other passwords', 'Weak so you remember it', 'Shared with a colleague'],
      ['You find a QR code on an unknown flyer. What should you do?', 'Be cautious, because it could lead to a malicious site', 'Scan it straight away', 'Treat it as always safe', 'Scan it twice'],
      ['How should guests use Wi-Fi at work?', 'On a separate guest network', 'On the main company network', 'With the admin password', 'With security turned off'],
      ['What should happen to data that is no longer needed?', 'It should be deleted in line with the retention policy', 'It should be kept forever', 'It should be deleted at random', 'It should be printed'],
    ],
    4: [
      ['A supplier emails new bank details for payment. What should you do?', 'Verify the change using a phone number you already know', 'Pay straight away', 'Reply to the email to confirm', 'Forward it to a friend'],
      ['You receive an MFA code you did not request. What does this suggest?', 'Someone may have your password: do not share the code and report it', 'It is a free gift', 'It is safe to share', 'It can be ignored'],
      ['A colleague asks you to log in for them because they forgot their password. What should you do?', 'Decline; they should use their own account or ask IT', 'Agree, it is quicker', 'Share your password with them', 'Write your password down for them'],
      ['Your work laptop is stolen. What should you do first?', 'Report it immediately so access can be disabled', 'Wait a few days to see if it turns up', 'Buy a new one and say nothing', 'Hide it from your manager'],
      ['A pop-up says your PC has a virus and gives a number to call. What should you do?', 'Close it, do not call, and report it', 'Call the number', 'Pay the fee', 'Install the software it offers'],
      ['An unexpected invoice arrives as an attachment. What should you do?', 'Verify it with the sender by another route before opening', 'Open it immediately', 'Pay it to be safe', 'Forward it to your team'],
      ['An email "from HR" asks you to confirm your password through a link. What should you do?', 'Report it as phishing', 'Confirm your password', 'Reply with your password', 'Click the link to check'],
      ['A delivery person asks to be let into a restricted area. What should you do?', 'Verify who they are and follow the escort process', 'Let them in', 'Hold the door open', 'Lend them your badge'],
      ['Your browser offers to save a password on a shared PC. What should you do?', 'Decline', 'Save it', 'Save it and tell the team', 'Save it for next time'],
      ['Which signs suggest an email is phishing?', 'Urgency, an unusual sender, spelling errors and unexpected requests', 'A friendly greeting only', 'A company logo', 'Correct punctuation'],
      ['Why does speed matter after clicking a phishing link?', 'Quick reporting helps contain the damage', 'It does not matter', 'Waiting makes it safer', 'Only blame matters'],
      ['What is the best approach to defence?', 'Layers of technical controls, processes and trained people', 'Antivirus only', 'Passwords only', 'Training only'],
      ['Which action breaks company security policy?', 'Emailing customer data to a personal account', 'Locking your screen', 'Using MFA', 'Reporting a phishing email'],
      ['What is a zero-day vulnerability?', 'A weakness that has no fix available yet', 'A day with no work', 'A virus name', 'A backup day'],
      ['What is a supply chain attack?', 'An attack through a trusted supplier or software provider', 'A delayed warehouse delivery', 'A forklift accident', 'A late order'],
      ['What is an insider threat?', 'Risk from someone who has legitimate access', 'Only hackers outside the company', 'Only visitors', 'Only former customers'],
      ['A Wi-Fi network is named like your company\'s but needs no password. What should you do?', 'Do not connect: it could be a fake "evil twin" network', 'Connect to it', 'Set your device to join it automatically', 'Share it with colleagues'],
      ['A voice on the phone sounds like your manager and asks for an urgent transfer. What should you do?', 'Verify through a second channel, because voices can be faked', 'Make the transfer', 'Trust the voice', 'Share your bank login'],
      ['Can you charge your personal phone through a work PC with a USB cable?', 'Only if company policy allows it; do not connect unapproved devices', 'Yes, always', 'Yes, it is required', 'Yes, it makes the PC faster'],
      ['What is the first step when you notice suspicious activity?', 'Report it promptly to IT or security', 'Investigate it alone', 'Wipe your device', 'Post about it online'],
    ],
  },
};

// ---------------------------------------------------------------------------

function checkBank() {
  const problems = [];
  for (const [title, levels] of Object.entries(BANK)) {
    for (const level of LEVELS) {
      const list = levels[level] || [];
      if (list.length !== POOL_SIZE) problems.push(`${title} level ${level}: ${list.length} questions in the bank (need ${POOL_SIZE})`);
      const seen = new Set();
      list.forEach((row, i) => {
        if (row.length !== 5 || row.some((s) => typeof s !== 'string' || !s.trim())) problems.push(`${title} level ${level} #${i + 1}: needs a question and 4 answers`);
        else if (new Set(row.slice(1)).size !== 4) problems.push(`${title} level ${level} #${i + 1}: answers must all be different`);
        const key = String(row[0]).trim().toLowerCase();
        if (seen.has(key)) problems.push(`${title} level ${level} #${i + 1}: duplicate question`);
        seen.add(key);
      });
    }
  }
  return problems;
}

async function seed() {
  const problems = checkBank();
  if (problems.length > 0) {
    console.error('The question bank in this file has problems:\n  ' + problems.join('\n  '));
    process.exitCode = 1;
    return;
  }

  const client = await pool.connect();
  const report = [];
  try {
    await client.query('BEGIN');

    for (const [title, levels] of Object.entries(BANK)) {
      const mod = await client.query('SELECT module_id FROM training_modules WHERE title = $1', [title]);
      if (mod.rows.length === 0) {
        console.log(`  (skipped "${title}": no module with that title in this database)`);
        continue;
      }
      const moduleId = mod.rows[0].module_id;

      let quiz = await client.query('SELECT quiz_id FROM quizzes WHERE module_id = $1', [moduleId]);
      if (quiz.rows.length === 0) {
        quiz = await client.query('INSERT INTO quizzes (module_id, passing_score, time_limit_sec) VALUES ($1, 70, 600) RETURNING quiz_id', [moduleId]);
      }
      const quizId = quiz.rows[0].quiz_id;

      for (const level of LEVELS) {
        const existing = await client.query('SELECT question_text FROM questions WHERE quiz_id = $1 AND level = $2', [quizId, level]);
        const have = new Set(existing.rows.map((r) => r.question_text.trim().toLowerCase()));
        let count = existing.rows.length;
        let added = 0;

        for (const [text, correct, w1, w2, w3] of levels[level]) {
          if (count >= POOL_SIZE) break;
          if (have.has(text.trim().toLowerCase())) continue;

          const q = await client.query(
            `INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty, level)
             VALUES ($1, $2, 'single', $3, $4, $5) RETURNING question_id`,
            [quizId, text, level * 100 + count + 1, DIFFICULTY[level], level]
          );
          for (const [answer, isCorrect] of [[correct, true], [w1, false], [w2, false], [w3, false]]) {
            await client.query('INSERT INTO answer_options (question_id, option_text, is_correct) VALUES ($1, $2, $3)', [q.rows[0].question_id, answer, isCorrect]);
          }
          have.add(text.trim().toLowerCase());
          count += 1;
          added += 1;
        }
        report.push({ module: title, level, added, total: count });
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding FAILED, nothing was changed:', err.message);
    process.exitCode = 1;
    client.release();
    if (typeof pool.end === "function") await pool.end();
    return;
  }
  client.release();

  console.log('\nQuestion pool per level (each attempt shows 10 of these, picked at random):\n');
  console.log('  ' + 'Module'.padEnd(36) + 'Level  Added  In pool');
  report.forEach((r) => console.log('  ' + r.module.padEnd(36) + String(r.level).padEnd(7) + String(r.added).padEnd(7) + r.total));
  const short = report.filter((r) => r.total < POOL_SIZE);
  console.log(short.length === 0 ? '\nAll levels now have 20 questions.' : '\nWARNING: some levels have fewer than 20 questions.');
  if (typeof pool.end === "function") await pool.end();
}

seed();