import 'dotenv/config';
import { execSync } from 'child_process';
import { readdir, rm } from 'fs/promises';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import type { AssessmentKind } from '@prisma/client';
import { markAttempt, questionsSchema, summarise, totalPoints } from '../src/utils/assessmentQuestions';
import type { Question, QuestionResult } from '../src/utils/assessmentQuestions';
import type { LessonBlock } from '../src/utils/lessonBlocks';

// Resets the LOCAL database to a realistic demo: wipes every table except the AR library (models, their points of
// interest and trigger pictures stay), re-runs the account seed (prisma/seed.ts), then adds subjects with lessons and
// chapter quizzes, classes with enrolled students, instructor quizzes & exams, and ~10 weeks of simulated progress.
//
//   npm run seed:demo -- --yes
//
// Random choices use a fixed seed, so every run produces the same demo (dates are relative to today).

const prisma = new PrismaClient();
const IMAGE_DIR = path.resolve(__dirname, '../uploads/images');
const DAY = 86_400_000;
const NOW = Date.now();
const SCHOOL_YEAR = '2026-2027';
const CLASS_START = NOW - 70 * DAY; // classes began 10 weeks ago

// ---------- deterministic randomness ----------

let seed = 20260930;
function rand() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const at = (ms: number) => new Date(Math.min(ms, NOW - 60 * 60 * 1000));

// ---------- catalog content ----------

type QuizQ = [prompt: string, choices: string[], correct: number];
interface LessonDef {
  title: string;
  blocks: LessonBlock[];
  arModel?: boolean;
}
interface ChapterDef {
  title: string;
  description: string;
  lessons: LessonDef[];
  quiz: QuizQ[];
}
interface ModuleDef {
  title: string;
  description: string;
  chapters: ChapterDef[];
}
interface SubjectDef {
  code: string;
  name: string;
  description: string;
  modules: ModuleDef[];
}

function lesson(title: string, intro: string, heading: string, body: string, check?: [string, string[], number, string]): LessonDef {
  const blocks: LessonBlock[] = [
    { type: 'text', text: intro },
    { type: 'heading', text: heading },
    { type: 'text', text: body },
  ];
  if (check) blocks.push({ type: 'check', prompt: check[0], choices: check[1], correctChoice: check[2], explanation: check[3] });
  return { title, blocks };
}

const SUBJECTS: SubjectDef[] = [
  {
    code: 'BIO101',
    name: 'General Biology',
    description: 'Cells, energy and the human nervous system — the foundations of life science.',
    modules: [
      {
        title: 'Cells: The Basic Unit of Life',
        description: 'What cells are made of, how materials move in and out, and how cells get energy.',
        chapters: [
          {
            title: 'Cell Structure',
            description: 'The parts of a cell and what each one does.',
            lessons: [
              lesson(
                'What Is a Cell?',
                'Every living thing is made of one or more cells. A cell is the smallest unit that can carry out all the processes of life: taking in nutrients, releasing energy, growing and reproducing.',
                'The cell theory',
                'The cell theory has three parts: all living things are made of cells; the cell is the basic unit of structure and function; and all cells come from pre-existing cells. Prokaryotic cells (like bacteria) have no nucleus, while eukaryotic cells (like plant and animal cells) keep their DNA inside a nucleus.',
                ['Which kind of cell keeps its DNA inside a nucleus?', ['Prokaryotic', 'Eukaryotic', 'Both', 'Neither'], 1, 'Eukaryotic cells have a membrane-bound nucleus; prokaryotic cells do not.'],
              ),
              lesson(
                'Organelles and Their Jobs',
                'Inside a eukaryotic cell are organelles — small structures that each do a specific job, much like the departments of a school.',
                'The main organelles',
                'The nucleus stores DNA and controls the cell. Mitochondria release energy from food. Ribosomes build proteins. The endoplasmic reticulum and Golgi apparatus process and ship those proteins. Plant cells also have chloroplasts for photosynthesis and a rigid cell wall.',
                ['Which organelle releases energy from food?', ['Ribosome', 'Golgi apparatus', 'Mitochondrion', 'Cell wall'], 2, 'Mitochondria carry out cellular respiration, releasing energy stored in food.'],
              ),
            ],
            quiz: [
              ['Which organelle controls the activities of the cell?', ['Nucleus', 'Ribosome', 'Vacuole', 'Cell membrane'], 0],
              ['Which structure is found in plant cells but not in animal cells?', ['Mitochondrion', 'Cell wall', 'Ribosome', 'Nucleus'], 1],
              ['Where are proteins built?', ['Chloroplasts', 'Lysosomes', 'Ribosomes', 'Vacuoles'], 2],
              ['Bacteria are examples of which type of cell?', ['Eukaryotic', 'Plant', 'Animal', 'Prokaryotic'], 3],
            ],
          },
          {
            title: 'Moving Across the Membrane',
            description: 'How the cell membrane controls what enters and leaves.',
            lessons: [
              lesson(
                'The Cell Membrane',
                'The cell membrane is a thin, flexible layer that surrounds every cell and separates its inside from the outside world.',
                'Selective permeability',
                'The membrane is made of a double layer of phospholipids with proteins embedded in it. It is selectively permeable: small molecules such as oxygen and water pass easily, while larger or charged particles need protein channels or pumps.',
              ),
              lesson(
                'Diffusion and Osmosis',
                'Particles naturally spread from where they are crowded to where they are less crowded. This is called diffusion, and it needs no energy from the cell.',
                'Osmosis',
                'Osmosis is the diffusion of water across a selectively permeable membrane. Water moves toward the side with more dissolved solutes. Active transport, by contrast, moves particles against their concentration gradient and requires energy (ATP).',
                ['Which process requires energy from the cell?', ['Diffusion', 'Osmosis', 'Active transport', 'All of these'], 2, 'Only active transport moves particles against the gradient, which costs ATP.'],
              ),
            ],
            quiz: [
              ['The cell membrane is described as…', ['Fully permeable', 'Selectively permeable', 'Impermeable', 'Rigid'], 1],
              ['Osmosis is the diffusion of…', ['Oxygen', 'Glucose', 'Water', 'Proteins'], 2],
              ['Diffusion moves particles from…', ['Low to high concentration', 'High to low concentration', 'Inside to outside only', 'Outside to inside only'], 1],
              ['Which process moves particles against the concentration gradient?', ['Active transport', 'Osmosis', 'Diffusion', 'Filtration'], 0],
            ],
          },
          {
            title: 'Cellular Energy',
            description: 'Photosynthesis and cellular respiration.',
            lessons: [
              lesson(
                'Photosynthesis',
                'Plants, algae and some bacteria make their own food by capturing the energy of sunlight.',
                'The equation',
                'In the chloroplasts, carbon dioxide and water are combined using light energy to make glucose and release oxygen: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂. Chlorophyll is the green pigment that absorbs the light.',
                ['What gas do plants release during photosynthesis?', ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], 2, 'Oxygen is released as a by-product when water molecules are split.'],
              ),
              lesson(
                'Cellular Respiration',
                'All living cells need energy. Cellular respiration releases the energy stored in glucose.',
                'From glucose to ATP',
                'In the mitochondria, glucose reacts with oxygen to form carbon dioxide and water, releasing energy that is stored as ATP. Respiration is roughly the reverse of photosynthesis — together they cycle carbon and oxygen through living things.',
              ),
            ],
            quiz: [
              ['Where does photosynthesis take place?', ['Mitochondria', 'Chloroplasts', 'Nucleus', 'Ribosomes'], 1],
              ['Which pigment absorbs light for photosynthesis?', ['Hemoglobin', 'Melanin', 'Chlorophyll', 'Keratin'], 2],
              ['Cellular respiration produces energy in the form of…', ['ATP', 'DNA', 'Glucose', 'Chlorophyll'], 0],
              ['Which gas is used up in cellular respiration?', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'], 1],
            ],
          },
        ],
      },
      {
        title: 'The Nervous System',
        description: 'Neurons, the brain and the senses.',
        chapters: [
          {
            title: 'Neurons and Nerve Signals',
            description: 'The cells that carry messages through the body.',
            lessons: [
              lesson(
                'Parts of a Neuron',
                'Neurons are specialised cells that carry electrical and chemical signals through the body.',
                'Dendrites, axon and synapse',
                'Dendrites receive signals from other cells. The cell body contains the nucleus. The axon carries the signal away, often insulated by a myelin sheath that speeds it up. At the synapse, chemical messengers called neurotransmitters pass the signal to the next cell.',
                ['Which part of a neuron receives signals?', ['Axon', 'Dendrite', 'Myelin sheath', 'Synapse'], 1, 'Dendrites branch out to collect incoming signals.'],
              ),
            ],
            quiz: [
              ['Which part of a neuron carries the signal away from the cell body?', ['Dendrite', 'Axon', 'Nucleus', 'Synapse'], 1],
              ['What speeds up the signal along an axon?', ['Myelin sheath', 'Cell wall', 'Ribosome', 'Chloroplast'], 0],
              ['Chemical messengers at the synapse are called…', ['Hormones', 'Enzymes', 'Neurotransmitters', 'Antibodies'], 2],
              ['The brain and spinal cord make up the…', ['Peripheral nervous system', 'Central nervous system', 'Endocrine system', 'Circulatory system'], 1],
            ],
          },
          {
            title: 'The Human Brain',
            description: 'The regions of the brain and how it is protected. Open the 3D brain to explore it.',
            lessons: [
              {
                ...lesson(
                  'Regions of the Brain',
                  'The brain is the control centre of the body. Open the 3D model to rotate it and tap each labelled point.',
                  'Cerebrum, cerebellum and brainstem',
                  'The cerebrum is the largest part and handles thinking, memory, language and voluntary movement; it is divided into the frontal, parietal, temporal and occipital lobes. The cerebellum at the back coordinates balance and fine movement. The brainstem connects the brain to the spinal cord and controls automatic functions such as breathing and heart rate.',
                  ['Which part of the brain coordinates balance?', ['Cerebrum', 'Cerebellum', 'Brainstem', 'Frontal lobe'], 1, 'The cerebellum fine-tunes movement and keeps you balanced.'],
                ),
                arModel: true,
              },
              lesson(
                'How the Brain Stays Protected',
                'The brain is soft and delicate, so the body protects it in several layers.',
                'Skull, meninges and fluid',
                'The skull forms a hard outer shell. Beneath it, three membranes called the meninges wrap the brain. Cerebrospinal fluid cushions the brain against shocks, and the blood–brain barrier keeps many harmful substances in the blood from reaching brain tissue.',
              ),
            ],
            quiz: [
              ['Which is the largest part of the brain?', ['Cerebellum', 'Brainstem', 'Cerebrum', 'Spinal cord'], 2],
              ['Breathing and heart rate are controlled by the…', ['Brainstem', 'Occipital lobe', 'Cerebellum', 'Frontal lobe'], 0],
              ['The occipital lobe mainly processes…', ['Hearing', 'Vision', 'Smell', 'Balance'], 1],
              ['What cushions the brain against shocks?', ['Blood', 'Cerebrospinal fluid', 'Bone marrow', 'Myelin'], 1],
            ],
          },
          {
            title: 'The Senses',
            description: 'How receptors turn the world into nerve signals.',
            lessons: [
              lesson(
                'From Stimulus to Sensation',
                'A stimulus is any change in the environment — light, sound, temperature or pressure — that the body can detect.',
                'Receptors',
                'Sense organs contain receptors that convert stimuli into nerve signals. Photoreceptors in the retina respond to light, hair cells in the cochlea respond to sound, and taste buds and olfactory receptors respond to chemicals. The brain then interprets these signals as sensations.',
              ),
            ],
            quiz: [
              ['Photoreceptors are found in the…', ['Cochlea', 'Retina', 'Tongue', 'Skin'], 1],
              ['Which organ contains receptors for hearing?', ['Cochlea', 'Cornea', 'Olfactory bulb', 'Iris'], 0],
              ['A change in the environment that the body can detect is a…', ['Receptor', 'Response', 'Stimulus', 'Reflex'], 2],
              ['Which sense relies on chemical receptors in the nose?', ['Sight', 'Touch', 'Hearing', 'Smell'], 3],
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'CHEM101',
    name: 'General Chemistry',
    description: 'Matter, atoms, the periodic table and chemical reactions.',
    modules: [
      {
        title: 'Matter and Atoms',
        description: 'What matter is made of.',
        chapters: [
          {
            title: 'States of Matter',
            description: 'Solids, liquids and gases.',
            lessons: [
              lesson(
                'Solids, Liquids and Gases',
                'Matter is anything that has mass and takes up space. It commonly exists in three states.',
                'Particles in motion',
                'In a solid, particles are packed tightly and vibrate in place, so it keeps its shape. In a liquid, particles slide past one another, so it takes the shape of its container. In a gas, particles move freely and far apart, filling any container. Adding or removing heat changes one state into another.',
                ['In which state do particles move most freely?', ['Solid', 'Liquid', 'Gas', 'All the same'], 2, 'Gas particles are far apart and move quickly in all directions.'],
              ),
            ],
            quiz: [
              ['Which state of matter has a fixed shape?', ['Solid', 'Liquid', 'Gas', 'Plasma'], 0],
              ['The change from liquid to gas is called…', ['Melting', 'Freezing', 'Evaporation', 'Condensation'], 2],
              ['The change from gas to liquid is called…', ['Condensation', 'Sublimation', 'Melting', 'Boiling'], 0],
              ['Which state takes the shape of its container but keeps its volume?', ['Solid', 'Liquid', 'Gas', 'None'], 1],
            ],
          },
          {
            title: 'Inside the Atom',
            description: 'Subatomic particles and atomic numbers.',
            lessons: [
              lesson(
                'Protons, Neutrons and Electrons',
                'Atoms are made of even smaller particles.',
                'The three subatomic particles',
                'Protons (positive) and neutrons (no charge) sit together in the tiny, dense nucleus. Electrons (negative) move around the nucleus in energy levels. A neutral atom has equal numbers of protons and electrons.',
                ['Which particle has a negative charge?', ['Proton', 'Neutron', 'Electron', 'Nucleus'], 2, 'Electrons carry a negative charge.'],
              ),
              lesson(
                'Atomic Number and Mass',
                'Each element is defined by how many protons its atoms have.',
                'Counting particles',
                'The atomic number is the number of protons. The mass number is protons plus neutrons. Atoms of the same element with different numbers of neutrons are called isotopes — for example carbon-12 and carbon-14.',
              ),
            ],
            quiz: [
              ['The atomic number tells you the number of…', ['Neutrons', 'Protons', 'Electrons and neutrons', 'Isotopes'], 1],
              ['Where are protons and neutrons found?', ['Electron cloud', 'Nucleus', 'Energy levels', 'Outside the atom'], 1],
              ['Atoms of the same element with different numbers of neutrons are…', ['Ions', 'Isotopes', 'Molecules', 'Compounds'], 1],
              ['Mass number equals…', ['Protons + electrons', 'Protons + neutrons', 'Neutrons only', 'Electrons only'], 1],
            ],
          },
        ],
      },
      {
        title: 'Chemical Bonds and Reactions',
        description: 'How atoms join and rearrange.',
        chapters: [
          {
            title: 'The Periodic Table',
            description: 'How elements are organised.',
            lessons: [
              lesson(
                'Groups and Periods',
                'The periodic table arranges all known elements by increasing atomic number.',
                'Reading the table',
                'Columns are called groups; elements in the same group have similar properties because they have the same number of valence electrons. Rows are called periods. Metals are on the left, non-metals on the right, and the noble gases in the last column are very unreactive.',
                ['Elements in the same group have the same number of…', ['Neutrons', 'Valence electrons', 'Protons', 'Isotopes'], 1, 'Valence electrons decide how an element reacts.'],
              ),
            ],
            quiz: [
              ['Vertical columns of the periodic table are called…', ['Periods', 'Groups', 'Rows', 'Blocks'], 1],
              ['Which group contains very unreactive elements?', ['Alkali metals', 'Halogens', 'Noble gases', 'Transition metals'], 2],
              ['Elements are arranged in order of increasing…', ['Mass number', 'Atomic number', 'Density', 'Melting point'], 1],
              ['Metals are mostly found on the…', ['Left side', 'Right side', 'Top row', 'Bottom row'], 0],
            ],
          },
          {
            title: 'Chemical Reactions',
            description: 'Bonds and balanced equations.',
            lessons: [
              lesson(
                'Ionic and Covalent Bonds',
                'Atoms bond to reach a stable arrangement of electrons.',
                'Two kinds of bond',
                'In an ionic bond, one atom gives electrons to another, forming oppositely charged ions that attract (e.g. NaCl). In a covalent bond, atoms share pairs of electrons (e.g. H₂O). Ionic compounds usually form between metals and non-metals; covalent compounds between non-metals.',
              ),
              lesson(
                'Balancing Equations',
                'In a chemical reaction, atoms are rearranged — never created or destroyed.',
                'Conservation of mass',
                'A balanced equation has the same number of each kind of atom on both sides. We balance by changing coefficients, never subscripts: 2H₂ + O₂ → 2H₂O has four hydrogen and two oxygen atoms on each side.',
                ['To balance an equation you may change the…', ['Subscripts', 'Coefficients', 'Elements', 'Charges'], 1, 'Changing subscripts would change the substance itself.'],
              ),
            ],
            quiz: [
              ['Sharing electrons forms a(n)… bond', ['Ionic', 'Covalent', 'Metallic', 'Hydrogen'], 1],
              ['Table salt (NaCl) is held together by… bonds', ['Covalent', 'Ionic', 'Hydrogen', 'Metallic'], 1],
              ['In 2H₂ + O₂ → 2H₂O, how many oxygen atoms are on each side?', ['1', '2', '3', '4'], 1],
              ['The law behind balancing equations is the conservation of…', ['Energy', 'Mass', 'Charge', 'Momentum'], 1],
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'PHYS101',
    name: 'General Physics',
    description: 'Motion, forces and energy.',
    modules: [
      {
        title: 'Describing Motion',
        description: 'Speed, velocity and acceleration.',
        chapters: [
          {
            title: 'Distance, Speed and Velocity',
            description: 'How fast and in what direction.',
            lessons: [
              lesson(
                'Speed and Velocity',
                'Motion is a change in position over time.',
                'Speed vs velocity',
                'Speed is distance divided by time (v = d / t) and has no direction. Velocity is speed in a given direction, so a car going 60 km/h north and one going 60 km/h south have the same speed but different velocities.',
                ['A runner covers 100 m in 20 s. What is the speed?', ['2 m/s', '5 m/s', '20 m/s', '120 m/s'], 1, 'Speed = 100 m ÷ 20 s = 5 m/s.'],
              ),
            ],
            quiz: [
              ['Speed is distance divided by…', ['Mass', 'Time', 'Force', 'Acceleration'], 1],
              ['Velocity includes speed and…', ['Mass', 'Direction', 'Time', 'Energy'], 1],
              ['A car travels 150 km in 3 h. Its average speed is…', ['30 km/h', '50 km/h', '150 km/h', '450 km/h'], 1],
              ['The SI unit of speed is…', ['km/h', 'm/s', 'm/s²', 'N'], 1],
            ],
          },
          {
            title: 'Acceleration',
            description: 'Changing velocity.',
            lessons: [
              lesson(
                'Changing Velocity',
                'Acceleration is the rate at which velocity changes.',
                'Calculating acceleration',
                'a = (final velocity − initial velocity) / time, measured in m/s². Speeding up, slowing down (deceleration) and changing direction are all forms of acceleration.',
              ),
            ],
            quiz: [
              ['The unit of acceleration is…', ['m/s', 'm/s²', 'N', 'J'], 1],
              ['A car goes from 0 to 20 m/s in 4 s. Its acceleration is…', ['4 m/s²', '5 m/s²', '20 m/s²', '80 m/s²'], 1],
              ['Turning a corner at constant speed is…', ['Not acceleration', 'Acceleration', 'Deceleration only', 'Impossible'], 1],
              ['Slowing down is also called…', ['Deceleration', 'Inertia', 'Momentum', 'Friction'], 0],
            ],
          },
        ],
      },
      {
        title: 'Forces and Energy',
        description: "Newton's laws, work and energy.",
        chapters: [
          {
            title: "Newton's Laws",
            description: 'How forces change motion.',
            lessons: [
              lesson(
                'The Three Laws of Motion',
                'Isaac Newton described how forces affect motion in three laws.',
                'First, second and third laws',
                'First law (inertia): an object stays at rest or in uniform motion unless a net force acts on it. Second law: F = m × a. Third law: for every action there is an equal and opposite reaction.',
                ['Which law is F = m × a?', ['First', 'Second', 'Third', 'None'], 1, "Newton's second law links force, mass and acceleration."],
              ),
              lesson(
                'Friction and Gravity',
                'Two forces we meet every day are friction and gravity.',
                'Everyday forces',
                'Friction opposes motion between surfaces in contact and turns kinetic energy into heat. Gravity pulls masses toward each other; on Earth it gives objects a weight of W = m × g, with g ≈ 9.8 m/s².',
              ),
            ],
            quiz: [
              ['An object at rest stays at rest unless acted on by a net force. This is…', ["Newton's first law", "Newton's second law", "Newton's third law", 'The law of gravity'], 0],
              ['A 2 kg object accelerates at 3 m/s². The net force is…', ['1.5 N', '5 N', '6 N', '9 N'], 2],
              ['Friction usually turns motion energy into…', ['Light', 'Heat', 'Sound only', 'Mass'], 1],
              ['For every action there is an equal and opposite…', ['Force', 'Reaction', 'Mass', 'Velocity'], 1],
            ],
          },
          {
            title: 'Work, Energy and Power',
            description: 'Energy and how it is transferred.',
            lessons: [
              lesson(
                'Work and Energy',
                'In physics, work is done when a force moves an object.',
                'Work, energy and power',
                'Work = force × distance (W = F × d), measured in joules. Kinetic energy is the energy of motion; potential energy is stored energy, such as an object held above the ground. Power is the rate of doing work, measured in watts.',
                ['The unit of work is the…', ['Watt', 'Newton', 'Joule', 'Pascal'], 2, 'Work and energy are both measured in joules.'],
              ),
            ],
            quiz: [
              ['Work equals force times…', ['Time', 'Distance', 'Mass', 'Speed'], 1],
              ['Energy of motion is called… energy', ['Potential', 'Kinetic', 'Chemical', 'Thermal'], 1],
              ['Power is measured in…', ['Joules', 'Watts', 'Newtons', 'Metres'], 1],
              ['A book on a high shelf has mostly… energy', ['Kinetic', 'Potential', 'Sound', 'Electrical'], 1],
            ],
          },
        ],
      },
    ],
  },
];

// ---------- instructor quizzes & exams (per subject) ----------

type Bank = Record<'quiz1' | 'midterm' | 'quiz2' | 'final', { title: string; instructions: string; questions: Question[] }>;

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
const q = (id: string, rest: WithoutId<Question>) => ({ id, ...rest }) as Question;

const BANKS: Record<string, Bank> = {
  BIO101: {
    quiz1: {
      title: 'Quiz 1: Cell Structure',
      instructions: 'Answer all questions. You have 20 minutes.',
      questions: [
        q('b1', { type: 'MULTIPLE_CHOICE', prompt: 'Which organelle is known as the powerhouse of the cell?', points: 2, choices: ['Nucleus', 'Mitochondrion', 'Ribosome', 'Golgi apparatus'], correct: 1 }),
        q('b2', { type: 'TRUE_FALSE', prompt: 'Animal cells have a cell wall.', points: 1, correct: false }),
        q('b3', { type: 'SHORT_ANSWER', prompt: 'What organelle carries out photosynthesis?', points: 2, accepted: ['chloroplast', 'chloroplasts'] }),
        q('b4', { type: 'MULTIPLE_SELECT', prompt: 'Which are found in plant cells? (Select all that apply.)', points: 3, choices: ['Cell wall', 'Chloroplast', 'Centriole', 'Large central vacuole'], correct: [0, 1, 3] }),
        q('b5', { type: 'MULTIPLE_CHOICE', prompt: 'Which process moves water across a membrane?', points: 2, choices: ['Osmosis', 'Active transport', 'Respiration', 'Mitosis'], correct: 0 }),
      ],
    },
    midterm: {
      title: 'Midterm Examination',
      instructions: 'Covers Module 1 (Cells). Answer every question. The essay is graded by your instructor.',
      questions: [
        q('m1', { type: 'MULTIPLE_CHOICE', prompt: 'The cell theory states that all cells come from…', points: 2, choices: ['Non-living matter', 'Pre-existing cells', 'Viruses', 'Sunlight'], correct: 1 }),
        q('m2', { type: 'MULTIPLE_CHOICE', prompt: 'Which process requires ATP?', points: 2, choices: ['Diffusion', 'Osmosis', 'Active transport', 'Facilitated diffusion'], correct: 2 }),
        q('m3', { type: 'TRUE_FALSE', prompt: 'Photosynthesis releases oxygen.', points: 1, correct: true }),
        q('m4', { type: 'TRUE_FALSE', prompt: 'Prokaryotic cells have a nucleus.', points: 1, correct: false }),
        q('m5', { type: 'ENUMERATION', prompt: 'Give the two products of photosynthesis.', points: 4, answers: ['glucose', 'oxygen'], ordered: false }),
        q('m6', {
          type: 'MATCHING',
          prompt: 'Match each organelle to its function.',
          points: 4,
          pairs: [
            { left: 'Nucleus', right: 'Stores DNA' },
            { left: 'Ribosome', right: 'Builds proteins' },
            { left: 'Mitochondrion', right: 'Releases energy' },
            { left: 'Chloroplast', right: 'Captures light' },
          ],
        }),
        q('m7', { type: 'ESSAY', prompt: 'Explain how photosynthesis and cellular respiration depend on each other.', points: 6, guide: 'Mentions that the products of one are the reactants of the other (CO₂, O₂, glucose, water) and the energy flow.' }),
      ],
    },
    quiz2: {
      title: 'Quiz 2: The Nervous System',
      instructions: 'Answer all questions. You have 15 minutes.',
      questions: [
        q('n1', { type: 'MULTIPLE_CHOICE', prompt: 'Which part of the brain controls breathing?', points: 2, choices: ['Cerebrum', 'Cerebellum', 'Brainstem', 'Frontal lobe'], correct: 2 }),
        q('n2', { type: 'TRUE_FALSE', prompt: 'The cerebellum coordinates balance.', points: 1, correct: true }),
        q('n3', { type: 'SHORT_ANSWER', prompt: 'Name the gap between two neurons.', points: 2, accepted: ['synapse', 'synaptic cleft'] }),
        q('n4', { type: 'MULTIPLE_CHOICE', prompt: 'Which lobe processes vision?', points: 2, choices: ['Frontal', 'Parietal', 'Temporal', 'Occipital'], correct: 3 }),
      ],
    },
    final: {
      title: 'Final Examination',
      instructions: 'Covers the whole course. Read each question carefully.',
      questions: [
        q('f1', { type: 'MULTIPLE_CHOICE', prompt: 'Which organelle releases energy from glucose?', points: 2, choices: ['Chloroplast', 'Mitochondrion', 'Nucleus', 'Vacuole'], correct: 1 }),
        q('f2', { type: 'TRUE_FALSE', prompt: 'Neurotransmitters carry signals across the synapse.', points: 1, correct: true }),
        q('f3', { type: 'ENUMERATION', prompt: 'List the four lobes of the cerebrum.', points: 4, answers: ['frontal', 'parietal', 'temporal', 'occipital'], ordered: false }),
        q('f4', { type: 'ESSAY', prompt: 'Describe how a nerve signal travels from a receptor to the brain.', points: 8, guide: 'Receptor → sensory neuron → spinal cord → brain; dendrite/axon/synapse.' }),
      ],
    },
  },
  CHEM101: {
    quiz1: {
      title: 'Quiz 1: Matter and Atoms',
      instructions: 'Answer all questions. You have 20 minutes.',
      questions: [
        q('c1', { type: 'MULTIPLE_CHOICE', prompt: 'Which particle has no charge?', points: 2, choices: ['Proton', 'Electron', 'Neutron', 'Ion'], correct: 2 }),
        q('c2', { type: 'TRUE_FALSE', prompt: 'Gases have a fixed volume.', points: 1, correct: false }),
        q('c3', { type: 'SHORT_ANSWER', prompt: 'What do you call the change from solid to liquid?', points: 2, accepted: ['melting', 'fusion'] }),
        q('c4', { type: 'MULTIPLE_CHOICE', prompt: 'Carbon has 6 protons and 8 neutrons. Its mass number is…', points: 2, choices: ['6', '8', '14', '2'], correct: 2 }),
      ],
    },
    midterm: {
      title: 'Midterm Examination',
      instructions: 'Covers Module 1. The essay is graded by your instructor.',
      questions: [
        q('cm1', { type: 'MULTIPLE_CHOICE', prompt: 'The atomic number equals the number of…', points: 2, choices: ['Neutrons', 'Protons', 'Nucleons', 'Shells'], correct: 1 }),
        q('cm2', { type: 'TRUE_FALSE', prompt: 'Isotopes of an element have different numbers of neutrons.', points: 1, correct: true }),
        q('cm3', { type: 'ENUMERATION', prompt: 'Name the three common states of matter.', points: 3, answers: ['solid', 'liquid', 'gas'], ordered: false }),
        q('cm4', {
          type: 'MATCHING',
          prompt: 'Match each particle to its charge.',
          points: 3,
          pairs: [
            { left: 'Proton', right: 'Positive' },
            { left: 'Electron', right: 'Negative' },
            { left: 'Neutron', right: 'Neutral' },
          ],
        }),
        q('cm5', { type: 'ESSAY', prompt: 'Using particle motion, explain why a gas fills its container.', points: 5, guide: 'Particles far apart, move fast and freely in all directions.' }),
      ],
    },
    quiz2: {
      title: 'Quiz 2: Bonds and Reactions',
      instructions: 'Answer all questions.',
      questions: [
        q('r1', { type: 'MULTIPLE_CHOICE', prompt: 'Water (H₂O) is held together by… bonds', points: 2, choices: ['Ionic', 'Covalent', 'Metallic', 'Nuclear'], correct: 1 }),
        q('r2', { type: 'TRUE_FALSE', prompt: 'Balancing an equation may change subscripts.', points: 1, correct: false }),
        q('r3', { type: 'SHORT_ANSWER', prompt: 'What are the columns of the periodic table called?', points: 2, accepted: ['groups', 'group', 'families'] }),
      ],
    },
    final: {
      title: 'Final Examination',
      instructions: 'Covers the whole course.',
      questions: [
        q('cf1', { type: 'MULTIPLE_CHOICE', prompt: 'Which group contains the noble gases?', points: 2, choices: ['Group 1', 'Group 2', 'Group 17', 'Group 18'], correct: 3 }),
        q('cf2', { type: 'ESSAY', prompt: 'Compare ionic and covalent bonding with an example of each.', points: 8, guide: 'Transfer vs sharing of electrons; NaCl vs H₂O.' }),
      ],
    },
  },
  PHYS101: {
    quiz1: {
      title: 'Quiz 1: Motion',
      instructions: 'Answer all questions. Show your reasoning on scratch paper.',
      questions: [
        q('p1', { type: 'MULTIPLE_CHOICE', prompt: 'A cyclist rides 30 km in 2 h. The average speed is…', points: 2, choices: ['15 km/h', '30 km/h', '60 km/h', '32 km/h'], correct: 0 }),
        q('p2', { type: 'TRUE_FALSE', prompt: 'Velocity has direction.', points: 1, correct: true }),
        q('p3', { type: 'SHORT_ANSWER', prompt: 'What is the SI unit of acceleration? (write it like m/s^2)', points: 2, accepted: ['m/s^2', 'm/s²', 'meters per second squared', 'metres per second squared'] }),
        q('p4', { type: 'MULTIPLE_CHOICE', prompt: 'From 10 m/s to 30 m/s in 5 s, the acceleration is…', points: 2, choices: ['2 m/s²', '4 m/s²', '6 m/s²', '8 m/s²'], correct: 1 }),
      ],
    },
    midterm: {
      title: 'Midterm Examination',
      instructions: 'Covers Module 1 (Motion). The essay is graded by your instructor.',
      questions: [
        q('pm1', { type: 'MULTIPLE_CHOICE', prompt: 'Which quantity has both size and direction?', points: 2, choices: ['Speed', 'Distance', 'Velocity', 'Time'], correct: 2 }),
        q('pm2', { type: 'TRUE_FALSE', prompt: 'An object moving at constant speed in a circle is accelerating.', points: 1, correct: true }),
        q('pm3', {
          type: 'MATCHING',
          prompt: 'Match each quantity to its unit.',
          points: 3,
          pairs: [
            { left: 'Speed', right: 'm/s' },
            { left: 'Acceleration', right: 'm/s²' },
            { left: 'Time', right: 's' },
          ],
        }),
        q('pm4', { type: 'ESSAY', prompt: 'Explain the difference between speed and velocity using an example.', points: 5, guide: 'Velocity includes direction; e.g. two cars, same speed, opposite directions.' }),
      ],
    },
    quiz2: {
      title: "Quiz 2: Newton's Laws",
      instructions: 'Answer all questions.',
      questions: [
        q('pn1', { type: 'MULTIPLE_CHOICE', prompt: 'A 5 kg box accelerates at 2 m/s². The net force is…', points: 2, choices: ['2.5 N', '7 N', '10 N', '3 N'], correct: 2 }),
        q('pn2', { type: 'TRUE_FALSE', prompt: 'Friction always helps objects move faster.', points: 1, correct: false }),
        q('pn3', { type: 'SHORT_ANSWER', prompt: "Newton's first law is also called the law of…", points: 2, accepted: ['inertia'] }),
      ],
    },
    final: {
      title: 'Final Examination',
      instructions: 'Covers the whole course.',
      questions: [
        q('pf1', { type: 'MULTIPLE_CHOICE', prompt: 'Work is measured in…', points: 2, choices: ['Watts', 'Joules', 'Newtons', 'Metres'], correct: 1 }),
        q('pf2', { type: 'ENUMERATION', prompt: "State Newton's three laws (in a few words each), in order.", points: 6, answers: ['inertia', 'f = ma', 'action and reaction'], ordered: true }),
        q('pf3', { type: 'ESSAY', prompt: 'Describe the energy changes of a ball thrown straight up and caught again.', points: 6, guide: 'Kinetic → potential → kinetic; some lost to air resistance.' }),
      ],
    },
  },
};

// ---------- students' simulated behaviour ----------

// ability = chance of answering a question right; reach = share of the subject done by `lastActiveDaysAgo`.
type Profile = 'strong' | 'average' | 'struggling' | 'inactive' | 'late';
const PROFILES: Record<Profile, { ability: [number, number]; reach: [number, number]; lastActiveDaysAgo: [number, number] }> = {
  strong: { ability: [0.86, 0.97], reach: [0.95, 1], lastActiveDaysAgo: [0, 3] },
  average: { ability: [0.74, 0.88], reach: [0.7, 0.9], lastActiveDaysAgo: [0, 5] },
  struggling: { ability: [0.42, 0.58], reach: [0.35, 0.55], lastActiveDaysAgo: [2, 8] },
  inactive: { ability: [0.62, 0.75], reach: [0.4, 0.55], lastActiveDaysAgo: [18, 26] }, // stopped weeks ago
  late: { ability: [0.6, 0.7], reach: [0, 0], lastActiveDaysAgo: [0, 0] }, // joined recently, hasn't started
};

interface ClassDef {
  subject: string;
  section: string;
  instructorId: string; // employee ID
  // SR-code number → profile. Maria (1) is a strong student in BIO101 A.
  students: [number, Profile][];
}

const CLASSES: ClassDef[] = [
  {
    subject: 'BIO101',
    section: 'A',
    instructorId: '10001',
    students: [[1, 'strong'], [2, 'average'], [3, 'strong'], [4, 'struggling'], [5, 'average'], [6, 'average'], [7, 'inactive'], [8, 'strong'], [9, 'average'], [10, 'late']],
  },
  {
    subject: 'BIO101',
    section: 'B',
    instructorId: '10001',
    students: [[11, 'average'], [12, 'strong'], [13, 'struggling'], [14, 'average'], [15, 'average'], [16, 'strong'], [17, 'inactive'], [18, 'average'], [19, 'struggling'], [20, 'average']],
  },
  {
    subject: 'CHEM101',
    section: 'A',
    instructorId: '10002',
    students: [[1, 'average'], [2, 'strong'], [3, 'average'], [4, 'average'], [5, 'struggling'], [6, 'strong'], [11, 'average'], [12, 'average'], [13, 'inactive'], [14, 'strong'], [15, 'late']],
  },
  {
    subject: 'PHYS101',
    section: 'A',
    instructorId: '10003',
    students: [[5, 'average'], [6, 'strong'], [7, 'average'], [8, 'strong'], [9, 'struggling'], [10, 'average'], [15, 'average'], [16, 'average'], [17, 'strong'], [18, 'inactive'], [19, 'average'], [20, 'struggling']],
  },
];

// A wrong-but-well-formed answer, or the right one with probability `ability`.
function answerFor(question: Question, ability: number): unknown {
  const right = chance(ability);
  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      if (right) return question.correct;
      const wrong = question.choices.map((_, i) => i).filter((i) => i !== question.correct);
      return pick(wrong);
    }
    case 'TRUE_FALSE':
      return right ? question.correct : !question.correct;
    case 'MULTIPLE_SELECT':
      return question.choices.map((_, i) => i).filter((i) => (question.correct.includes(i) ? chance(ability) : chance(1 - ability) && chance(0.5)));
    case 'SHORT_ANSWER':
      return right ? question.accepted[0] : pick(['I forgot', 'nucleus', 'not sure', '']);
    case 'ENUMERATION':
      return question.answers.map((a) => (chance(ability) ? a : ''));
    case 'MATCHING': {
      const rights = question.pairs.map((p) => p.right);
      const given = question.pairs.map((p) => (chance(ability) ? p.right : null));
      // Fill the misses with a leftover option so the answer looks like a real attempt.
      return given.map((g) => g ?? pick(rights));
    }
    case 'ESSAY':
      return right
        ? 'Both processes form a cycle: the products of one are the starting materials of the other, so energy and matter keep flowing between plants, animals and the environment.'
        : 'They are related because both happen in living things and use energy.';
  }
}

const ESSAY_FEEDBACK = ['Clear and complete explanation.', 'Good points — add a specific example next time.', 'Partly correct; review the lesson on this topic.', 'Missing the key idea. See me during consultation.'];

// ---------- the reset ----------

async function wipe() {
  // Everything except the AR library (ar_models + ar_triggers keep their rows and files).
  await prisma.assessmentAttempt.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.lessonCompletion.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.class.deleteMany();
  await prisma.subject.deleteMany(); // cascades modules, chapters, lessons, quizzes; AR models' subject is set to null
  await prisma.lessonImage.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  const images = await readdir(IMAGE_DIR).catch(() => [] as string[]);
  await Promise.all(images.map((f) => rm(path.join(IMAGE_DIR, f), { force: true })));
}

async function createCatalog(brainId: string | null) {
  const itemsBySubject = new Map<string, { id: string; type: 'LESSON' | 'QUIZ'; questions: QuizQ[] }[]>();
  const subjectIds = new Map<string, { id: string; code: string; name: string }>();
  for (const [si, s] of SUBJECTS.entries()) {
    const created = at(CLASS_START - (20 - si) * DAY);
    const subject = await prisma.subject.create({ data: { code: s.code, name: s.name, description: s.description, createdAt: created } });
    subjectIds.set(s.code, subject);
    const items: { id: string; type: 'LESSON' | 'QUIZ'; questions: QuizQ[] }[] = [];
    for (const [mi, m] of s.modules.entries()) {
      const mod = await prisma.module.create({ data: { subjectId: subject.id, title: m.title, description: m.description, position: mi, createdAt: created } });
      for (const [ci, c] of m.chapters.entries()) {
        const chapter = await prisma.chapter.create({ data: { moduleId: mod.id, title: c.title, description: c.description, position: ci, createdAt: created } });
        let position = 0;
        for (const l of c.lessons) {
          const item = await prisma.contentItem.create({
            data: {
              chapterId: chapter.id,
              type: 'LESSON',
              title: l.title,
              blocks: l.blocks as unknown as Prisma.InputJsonValue,
              position: position++,
              arModelId: l.arModel ? brainId : null,
              createdAt: created,
            },
          });
          items.push({ id: item.id, type: 'LESSON', questions: [] });
        }
        const quiz = await prisma.contentItem.create({
          data: {
            chapterId: chapter.id,
            type: 'QUIZ',
            title: `${c.title} Quiz`,
            position: position++,
            createdAt: created,
            questions: { create: c.quiz.map(([prompt, choices, correctChoice], i) => ({ prompt, choices, correctChoice, position: i })) },
          },
        });
        items.push({ id: quiz.id, type: 'QUIZ', questions: c.quiz });
      }
    }
    itemsBySubject.set(s.code, items);
  }
  if (brainId) await prisma.arModel.update({ where: { id: brainId }, data: { subjectId: subjectIds.get('BIO101')!.id } });
  return { itemsBySubject, subjectIds };
}

// When each of the class's quizzes & exams is open (relative to today).
const SCHEDULE: Record<keyof Bank, { opens: number; closes: number; kind: AssessmentKind; time: number; attempts: number | null }> = {
  quiz1: { opens: -45, closes: -38, kind: 'QUIZ', time: 20, attempts: 2 },
  midterm: { opens: -24, closes: -22, kind: 'EXAM', time: 60, attempts: 1 },
  quiz2: { opens: -3, closes: 5, kind: 'QUIZ', time: 15, attempts: 2 },
  final: { opens: 25, closes: 27, kind: 'EXAM', time: 90, attempts: 1 },
};

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('This DELETES all data except AR models, then reseeds a demo. Run: npm run seed:demo -- --yes');
    process.exitCode = 1;
    return;
  }
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    console.error('Refusing to reset: DATABASE_URL does not point at localhost.');
    process.exitCode = 1;
    return;
  }

  // The demo quizzes & exams must pass the same validation as ones built in the instructor portal.
  for (const bank of Object.values(BANKS)) for (const a of Object.values(bank)) questionsSchema.parse(a.questions);

  // The brain model to link to the brain lesson: the one with the most set up (trigger pictures, then oldest).
  const brain = await prisma.arModel.findFirst({
    where: { name: { contains: 'brain', mode: 'insensitive' } },
    orderBy: [{ triggers: { _count: 'desc' } }, { createdAt: 'asc' }],
    select: { id: true, name: true },
  });
  console.log('Wiping data (keeping AR models)…');
  await wipe();

  console.log('Seeding accounts…');
  execSync('npx tsx prisma/seed.ts', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
  const users = await prisma.user.findMany({ select: { id: true, role: true, employeeId: true, srCode: true } });
  const instructorByEmployeeId = new Map(users.filter((u) => u.role === 'INSTRUCTOR').map((u) => [u.employeeId!, u.id]));
  const studentByNumber = new Map(users.filter((u) => u.role === 'STUDENT').map((u) => [Number(u.srCode!.split('-')[1]), u.id]));

  console.log('Creating subjects, modules, lessons and quizzes…');
  const { itemsBySubject, subjectIds } = await createCatalog(brain?.id ?? null);

  console.log('Creating classes, enrollments, quizzes & exams and progress…');
  const counts = { classes: 0, enrollments: 0, lessons: 0, quizAttempts: 0, submissions: 0 };
  for (const [ci, def] of CLASSES.entries()) {
    const subject = subjectIds.get(def.subject)!;
    const cls = await prisma.class.create({
      data: {
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        section: def.section,
        term: 'FIRST_SEM',
        schoolYear: SCHOOL_YEAR,
        joinCode: `${subject.code}-${def.section}${String(7 + ci * 13).padStart(2, '0')}X`,
        instructorId: instructorByEmployeeId.get(def.instructorId)!,
        createdAt: at(CLASS_START - 7 * DAY),
      },
    });
    counts.classes += 1;

    const bank = BANKS[def.subject];
    const assessments = await Promise.all(
      (Object.keys(SCHEDULE) as (keyof Bank)[]).map(async (key) => {
        const s = SCHEDULE[key];
        const a = await prisma.assessment.create({
          data: {
            classId: cls.id,
            kind: s.kind,
            title: bank[key].title,
            instructions: bank[key].instructions,
            questions: bank[key].questions as unknown as Prisma.InputJsonValue,
            timeLimitMinutes: s.time,
            maxAttempts: s.attempts,
            opensAt: new Date(NOW + s.opens * DAY),
            closesAt: new Date(NOW + s.closes * DAY),
            showAnswers: s.kind === 'QUIZ',
            published: true,
            createdAt: new Date(NOW + (s.opens - 7) * DAY),
          },
        });
        return { key, schedule: s, questions: bank[key].questions, id: a.id };
      }),
    );

    const items = itemsBySubject.get(def.subject)!;
    for (const [number, profileName] of def.students) {
      const studentId = studentByNumber.get(number)!;
      const profile = PROFILES[profileName];
      const ability = between(...profile.ability);
      const joined = profileName === 'late' ? NOW - 12 * DAY : CLASS_START - between(0, 4) * DAY;
      await prisma.enrollment.create({ data: { classId: cls.id, studentId, source: chance(0.8) ? 'JOIN_CODE' : 'MANUAL', createdAt: new Date(joined) } });
      counts.enrollments += 1;
      if (profileName === 'late') continue;

      // Work through the subject in order (so chapter unlocking stays consistent), spread evenly from the start of
      // the class to this student's last active day.
      const stop = NOW - between(...profile.lastActiveDaysAgo) * DAY;
      const todo = items.slice(0, Math.round(items.length * between(...profile.reach)));
      const begin = CLASS_START + between(0, 2) * DAY;
      const step = (stop - begin) / Math.max(todo.length, 1);
      for (const [index, item] of todo.entries()) {
        const t = begin + step * (index + between(0.5, 1));
        if (item.type === 'LESSON') {
          // Another class of the same student may already have done this lesson (same subject) — skip duplicates.
          const exists = await prisma.lessonCompletion.findUnique({ where: { studentId_lessonId: { studentId, lessonId: item.id } } });
          if (!exists) {
            await prisma.lessonCompletion.create({ data: { studentId, lessonId: item.id, completedAt: at(t) } });
            counts.lessons += 1;
          }
          continue;
        }
        const attempt = async (skill: number, when: number) => {
          const answers = item.questions.map(([, choices, correct]) => (chance(skill) ? correct : pick(choices.map((_, i) => i).filter((i) => i !== correct))));
          const score = answers.filter((a, i) => a === item.questions[i][2]).length;
          await prisma.quizAttempt.create({ data: { studentId, quizId: item.id, answers, score, total: item.questions.length, submittedAt: at(when) } });
          counts.quizAttempts += 1;
          return score / item.questions.length;
        };
        const first = await attempt(ability, t);
        // Some students retake a quiz they did badly on.
        if (first < 0.6 && chance(0.6)) await attempt(Math.min(0.95, ability + 0.2), t + between(0.5, 2) * DAY);
      }

      // Instructor quizzes & exams: closed ones mostly taken; the open quiz by some; the final hasn't opened.
      for (const a of assessments) {
        if (a.key === 'final') continue;
        const opens = NOW + a.schedule.opens * DAY;
        const closes = Math.min(NOW + a.schedule.closes * DAY, NOW - 2 * 60 * 60 * 1000);
        if (profileName === 'inactive' && opens > stop) continue; // stopped before it opened
        if (a.key === 'quiz2' && (number === 1 || !chance(profileName === 'strong' ? 0.8 : 0.4))) continue; // Maria can still take it
        if (profileName === 'struggling' && chance(a.schedule.kind === 'EXAM' ? 0.35 : 0.25)) continue; // missed it
        const started = between(opens, closes - 70 * 60 * 1000);
        const submitted = started + between(0.4, 0.95) * a.schedule.time * 60 * 1000;
        const answers: Record<string, unknown> = {};
        for (const question of a.questions) answers[question.id] = answerFor(question, ability);
        const marked = markAttempt(a.questions, answers);
        // The instructor has graded most essays; a few midterm essays are still waiting.
        const results: Record<string, QuestionResult> = { ...marked.results };
        const essayPending = a.key === 'midterm' && chance(0.15);
        for (const question of a.questions) {
          if (question.type !== 'ESSAY' || essayPending) continue;
          const points = Math.round(question.points * Math.min(1, ability + between(-0.15, 0.1)));
          results[question.id] = { points, graded: true, feedback: pick(ESSAY_FEEDBACK) };
        }
        const { score, needsGrading } = summarise(a.questions, results);
        await prisma.assessmentAttempt.create({
          data: {
            assessmentId: a.id,
            studentId,
            startedAt: new Date(started),
            submittedAt: new Date(submitted),
            answers: answers as Prisma.InputJsonValue,
            results: results as unknown as Prisma.InputJsonValue,
            score,
            maxScore: totalPoints(a.questions),
            needsGrading,
          },
        });
        counts.submissions += 1;
      }
    }
  }

  console.log(
    `Demo ready: ${SUBJECTS.length} subjects, ${counts.classes} classes, ${counts.enrollments} enrollments, ${counts.lessons} lessons completed, ` +
      `${counts.quizAttempts} chapter-quiz attempts, ${counts.submissions} quiz/exam submissions.`,
  );
  console.log(brain ? `Kept AR model "${brain.name}" and linked it to BIO101 › The Human Brain › Regions of the Brain.` : 'No brain AR model found to link.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
