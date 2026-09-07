/** Field phone contacts — unique lines + voice personality for SpeechSynthesis. */

export type PhoneContactId =
  | 'robot'
  | 'sasquatch'
  | 'bigfoot'
  | 'police'
  | 'fire'
  | 'ambulance'
  | 'zookeeper'
  | 'bank';

export interface PhoneContact {
  id: PhoneContactId;
  label: string;
  emoji: string;
  /** Spoken aloud through the device speaker */
  lines: string[];
  pitch: number;
  rate: number;
  /** Prefer male/female-ish voice matching */
  prefer: 'low' | 'mid' | 'high';
}

export const PHONE_CONTACTS: PhoneContact[] = [
  {
    id: 'robot',
    label: 'Call Robot',
    emoji: '🤖',
    prefer: 'mid',
    pitch: 1.35,
    rate: 1.05,
    lines: [
      'Beep boop. Robot online.',
      'I am following you, boss. Tracker signal is green.',
      'Need a tip? Drive west to the forest when you are ready.',
      'I will keep the path clear. End transmission.',
    ],
  },
  {
    id: 'sasquatch',
    label: 'Call Sasquatch',
    emoji: '🦍',
    prefer: 'low',
    pitch: 0.72,
    rate: 0.88,
    lines: [
      'Rrrraaah… who is calling me?',
      'I am deep in the trees. Leave me alone… or bring snacks.',
      'If you catch me, be gentle. I just want berries.',
      'Hmph. Fine. See you in the forest.',
    ],
  },
  {
    id: 'bigfoot',
    label: 'Call Bigfoot',
    emoji: '🦶',
    prefer: 'low',
    pitch: 0.65,
    rate: 0.85,
    lines: [
      'This is Bigfoot. Bigger than Sasquatch. Taller. Hairier.',
      'I saw your footprints. Or maybe those were mine.',
      'Stay off my trail… unless you brought pizza.',
      'Okay bye. I am going to hide behind a really big tree.',
    ],
  },
  {
    id: 'police',
    label: 'Call Police',
    emoji: '🚓',
    prefer: 'mid',
    pitch: 0.95,
    rate: 1.0,
    lines: [
      'City Police Desk. Officer Pike speaking.',
      'Cybertruck units are on patrol. Stay safe out there.',
      'If you see Sasquatch, do not panic — call security.',
      'Ten-four. We are rolling. Over and out.',
    ],
  },
  {
    id: 'fire',
    label: 'Call Fire Dept',
    emoji: '🚒',
    prefer: 'mid',
    pitch: 1.0,
    rate: 1.05,
    lines: [
      'Fire Department. What is your emergency?',
      'No smoke in the city right now. Magma blocks do not count as a fire.',
      'Keep a water bucket handy when you build.',
      'Copy that. Engine company standing by.',
    ],
  },
  {
    id: 'ambulance',
    label: 'Call Ambulance',
    emoji: '🚑',
    prefer: 'high',
    pitch: 1.15,
    rate: 1.08,
    lines: [
      'Ambulance dispatch. Are you hurt?',
      'Clinic has first-aid kits if you need one. Pick them up inside.',
      'Tiger scratches heal with kindness and bandages.',
      'Stay calm. Help is always nearby. Bye for now.',
    ],
  },
  {
    id: 'zookeeper',
    label: 'Call Zookeeper',
    emoji: '🐯',
    prefer: 'high',
    pitch: 1.2,
    rate: 1.0,
    lines: [
      'Zookeeper here! Please do not feed the tigers junk food.',
      'If the jungle cats chase you, use your whip — gently!',
      'Panthers leap and run. They are just saying hello… loudly.',
      'Thanks for calling. Watch your step near the forest.',
    ],
  },
  {
    id: 'bank',
    label: 'Call Bank Teller',
    emoji: '🏦',
    prefer: 'high',
    pitch: 1.1,
    rate: 0.98,
    lines: [
      'City Gold Bank. Teller speaking.',
      'Yes, the vault is full of gold. No safe. Just piles. Help yourself… carefully.',
      'Please put gold bars in your backpack. Do not leave them in the street.',
      'Thank you for banking with us. Have a golden day!',
    ],
  },
];

export function getContact(id: string): PhoneContact | undefined {
  return PHONE_CONTACTS.find((c) => c.id === id);
}

/** Pick one spoken line (cycles by call count). */
export function nextLine(contact: PhoneContact, callCount: number): string {
  return contact.lines[callCount % contact.lines.length];
}
