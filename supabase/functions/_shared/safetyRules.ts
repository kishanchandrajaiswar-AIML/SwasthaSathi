/**
 * Deterministic Emergency Safety Rules for Supabase Edge Functions.
 * Follows MoHFW India, WHO IMNCI, and Tele-MANAS guidelines.
 */

export interface EmergencyMatch {
  isEmergency: boolean;
  category: string;
  matchedTrigger: string;
  recommendedAction: string;
  firstAid: string[];
}

const RED_FLAGS = [
  // Cardiac
  {
    category: 'CARDIAC_EMERGENCY',
    triggers: [
      'chest pain', 'heart attack', 'chhati me dard', 'chhati me jalan', 'chhatit dukhne',
      'seene me dard', 'crushing chest', 'left arm pain', 'sweating chest pain'
    ],
    action: 'Immediate Emergency Transfer (Call 108/112). Patient requires immediate ECG and cardiac monitoring.',
    firstAid: ['Keep patient calm and seated', 'Loosen tight clothing', 'Do not allow physical exertion', 'Call 108 immediately']
  },
  // Respiratory
  {
    category: 'RESPIRATORY_DISTRESS',
    triggers: [
      'difficulty breathing', 'saas lene me takleef', 'saans phulna', 'dum ghutna',
      'shwas ghyayla tras', 'choking', 'gasping', 'blue lips', 'cyanosis'
    ],
    action: 'Immediate Emergency Care. Assess airway patency and administer high-flow oxygen at nearest casualty ward.',
    firstAid: ['Sit upright (orthopneic position)', 'Ensure fresh airflow', 'Do not force liquids', 'Rush to nearest emergency clinic']
  },
  // Stroke / Neurological
  {
    category: 'NEUROLOGICAL_STROKE',
    triggers: [
      'stroke', 'face drooping', 'arm weakness', 'speech slurred', 'paralysis',
      'lakwa', 'ek taraf kamzori', 'bolne me dikkat', 'sudden confusion', 'convulsion', 'daura'
    ],
    action: 'Acute Stroke Protocol. Rush immediately to nearest CT-scan enabled hospital (within golden window).',
    firstAid: ['Note exact time symptoms started', 'Do not give food or drink', 'Turn patient on their side if vomiting', 'Call 108']
  },
  // Poisoning / Toxic Ingestion
  {
    category: 'POISONING_INGESTION',
    triggers: [
      'poison', 'insecticide', 'pesticide', 'keetnashak', 'zeher', 'vish', 'chemical'
    ],
    action: 'Severe Poisoning / Ingestion Emergency. Transport patient with chemical container to nearest government hospital immediately.',
    firstAid: ['Do NOT induce vomiting unless instructed by poison center', 'Keep sample or photo of chemical bottle', 'Rush to emergency']
  },
  // Maternal / Obstetric
  {
    category: 'MATERNAL_EMERGENCY',
    triggers: [
      'pregnancy bleeding', 'garbhavastha me bleeding', 'garbhavastha raktasrav',
      'severe bleeding during pregnancy', 'amniotic fluid leakage'
    ],
    action: 'Obstetric Emergency. Immediate transfer to First Referral Unit (FRU) or District Hospital with blood bank.',
    firstAid: ['Keep patient lying on left side', 'Do not administer medications', 'Arrange transport to FRU immediately']
  },
  // Mental Health Crisis
  {
    category: 'MENTAL_HEALTH_CRISIS',
    triggers: [
      'suicide', 'kill myself', 'end my life', 'khudkushi', 'atmahatya', 'jeevan samapt'
    ],
    action: 'Crisis Support Protocol: Contact National Tele-MANAS Mental Health Helpline (14416 or 1800-891-4416) immediately.',
    firstAid: ['Stay with the person in a safe environment', 'Remove any harmful objects', 'Call Tele-MANAS toll-free 14416']
  }
];

export function checkDeterministicEmergency(text: string): EmergencyMatch | null {
  const normalized = (text || '').toLowerCase();
  for (const flag of RED_FLAGS) {
    for (const trigger of flag.triggers) {
      if (normalized.includes(trigger.toLowerCase())) {
        return {
          isEmergency: true,
          category: flag.category,
          matchedTrigger: trigger,
          recommendedAction: flag.action,
          firstAid: flag.firstAid
        };
      }
    }
  }
  return null;
}
