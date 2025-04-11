interface DevelopmentPhase {
  features: string[];
  timeline: string;
  steps: string[];
}

export const PHASE_1: DevelopmentPhase = {
  features: [
    'Advanced Analytics Dashboard',
    'Enhanced Customer Portal',
    'Multi-currency Support'
  ],
  timeline: '4 weeks',
  steps: [
    'Database schema migrations',
    'API endpoint implementation',
    'Frontend component development',
    'Integration testing'
  ]
};

export const PHASE_2: DevelopmentPhase = {
  features: [
    'Tax Management System',
    'Dunning Management',
    'Audit Logging'
  ],
  timeline: '3 weeks',
  steps: [
    'Tax calculation engine',
    'Automated dunning workflows',
    'Compliance reporting'
  ]
};

export const PHASE_3: DevelopmentPhase = {
  features: [
    'Multi-channel Notifications',
    'API Integration System',
    'Export Capabilities'
  ],
  timeline: '3 weeks',
  steps: [
    'Notification system implementation',
    'API documentation',
    'Integration testing'
  ]
};

// Add more phases as needed
export const DEVELOPMENT_PHASES = {
  PHASE_1,
  PHASE_2,
  PHASE_3
};

export default DEVELOPMENT_PHASES;
