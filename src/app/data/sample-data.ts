// 10 cheese samples with instrumental + semi-trained panel data
// Focus: Task-level evaluation for escalation decision

export interface SampleData {
  id: number;
  sampleName: string;
  instrumental: {
    // E-Tongue (TSS) - taste intensities
    sourness: number;
    umami: number;
    saltiness: number;
    bitterness: number;
    
    // GC-MS peak areas (standardized 0-6 scale)
    volatileFattyAcids: number; // Cheesy aroma proxy
    diacetyl: number; // Fermented note proxy
    shortChainFA: number; // Rancid note proxy (off-note critical)
    
    // Rheology
    firmness: number; // Texture analyzer (N)
  };
  
  semiTrained: {
    // Semi-trained panel intensity ratings (using lexicon anchors)
    sourness: number;
    umami: number;
    saltiness: number;
    bitterness: number;
    
    cheesyAroma: number;
    fermentedNote: number;
    rancidNote: number; // Off-note critical
    
    firmness: number;
    
    // Off-note flag
    offNoteDetected: boolean;
    offNoteDescriptor?: string;
    
    // Overall pleasantness (optional)
    pleasantness: number; // 1-5 scale
  };
}

export const samples: SampleData[] = [
  {
    id: 1,
    sampleName: "Sample A",
    instrumental: {
      sourness: 3.8,
      umami: 4.5,
      saltiness: 2.9,
      bitterness: 2.1,
      volatileFattyAcids: 3.5,
      diacetyl: 2.7,
      shortChainFA: 1.2,
      firmness: 3.6,
    },
    semiTrained: {
      sourness: 3.7,
      umami: 4.4,
      saltiness: 3.0,
      bitterness: 2.3,
      cheesyAroma: 3.4,
      fermentedNote: 2.8,
      rancidNote: 1.1,
      firmness: 3.5,
      offNoteDetected: false,
      pleasantness: 4,
    },
  },
  {
    id: 2,
    sampleName: "Sample B",
    instrumental: {
      sourness: 2.4,
      umami: 3.2,
      saltiness: 3.5,
      bitterness: 1.8,
      volatileFattyAcids: 4.1,
      diacetyl: 3.4,
      shortChainFA: 0.9,
      firmness: 4.2,
    },
    semiTrained: {
      sourness: 2.6,
      umami: 3.1,
      saltiness: 3.6,
      bitterness: 1.9,
      cheesyAroma: 4.0,
      fermentedNote: 3.5,
      rancidNote: 0.8,
      firmness: 4.1,
      offNoteDetected: false,
      pleasantness: 4,
    },
  },
  {
    id: 3,
    sampleName: "Sample C",
    instrumental: {
      sourness: 4.2,
      umami: 2.8,
      saltiness: 2.2,
      bitterness: 2.9,
      volatileFattyAcids: 2.9,
      diacetyl: 2.1,
      shortChainFA: 3.8, // High rancid compound
      firmness: 2.8,
    },
    semiTrained: {
      sourness: 4.0,
      umami: 2.9,
      saltiness: 2.3,
      bitterness: 3.1,
      cheesyAroma: 2.7,
      fermentedNote: 2.0,
      rancidNote: 3.9, // Detected by semi-trained
      firmness: 2.7,
      offNoteDetected: true,
      offNoteDescriptor: "Rancid, unpleasant",
      pleasantness: 2,
    },
  },
  {
    id: 4,
    sampleName: "Sample D",
    instrumental: {
      sourness: 3.1,
      umami: 4.8,
      saltiness: 3.8,
      bitterness: 1.5,
      volatileFattyAcids: 3.8,
      diacetyl: 3.1,
      shortChainFA: 1.0,
      firmness: 3.9,
    },
    semiTrained: {
      sourness: 3.0,
      umami: 4.7,
      saltiness: 3.9,
      bitterness: 1.6,
      cheesyAroma: 3.7,
      fermentedNote: 3.2,
      rancidNote: 1.0,
      firmness: 3.8,
      offNoteDetected: false,
      pleasantness: 4,
    },
  },
  {
    id: 5,
    sampleName: "Sample E",
    instrumental: {
      sourness: 2.9,
      umami: 3.6,
      saltiness: 2.7,
      bitterness: 2.4,
      volatileFattyAcids: 3.2,
      diacetyl: 2.5,
      shortChainFA: 2.8, // Moderate rancid
      firmness: 3.3,
    },
    semiTrained: {
      sourness: 2.8,
      umami: 3.5,
      saltiness: 2.8,
      bitterness: 2.6,
      cheesyAroma: 3.1,
      fermentedNote: 2.6,
      rancidNote: 3.2, // Detected
      firmness: 3.2,
      offNoteDetected: true,
      offNoteDescriptor: "Slight rancid note",
      pleasantness: 3,
    },
  },
  {
    id: 6,
    sampleName: "Sample F",
    instrumental: {
      sourness: 3.5,
      umami: 4.1,
      saltiness: 3.2,
      bitterness: 1.9,
      volatileFattyAcids: 3.6,
      diacetyl: 2.9,
      shortChainFA: 1.1,
      firmness: 3.7,
    },
    semiTrained: {
      sourness: 3.4,
      umami: 4.0,
      saltiness: 3.3,
      bitterness: 2.0,
      cheesyAroma: 3.5,
      fermentedNote: 3.0,
      rancidNote: 1.2,
      firmness: 3.6,
      offNoteDetected: false,
      pleasantness: 4,
    },
  },
  {
    id: 7,
    sampleName: "Sample G",
    instrumental: {
      sourness: 4.5,
      umami: 3.4,
      saltiness: 2.5,
      bitterness: 3.2,
      volatileFattyAcids: 2.7,
      diacetyl: 2.3,
      shortChainFA: 1.5,
      firmness: 2.6,
    },
    semiTrained: {
      sourness: 4.3,
      umami: 3.6,
      saltiness: 2.6,
      bitterness: 3.0,
      cheesyAroma: 2.6,
      fermentedNote: 2.4,
      rancidNote: 1.6,
      firmness: 2.5,
      offNoteDetected: false,
      pleasantness: 3,
    },
  },
  {
    id: 8,
    sampleName: "Sample H",
    instrumental: {
      sourness: 2.7,
      umami: 4.3,
      saltiness: 3.6,
      bitterness: 1.7,
      volatileFattyAcids: 4.0,
      diacetyl: 3.3,
      shortChainFA: 1.0,
      firmness: 4.1,
    },
    semiTrained: {
      sourness: 2.8,
      umami: 4.2,
      saltiness: 3.7,
      bitterness: 1.8,
      cheesyAroma: 3.9,
      fermentedNote: 3.4,
      rancidNote: 1.0,
      firmness: 4.0,
      offNoteDetected: false,
      pleasantness: 4,
    },
  },
  {
    id: 9,
    sampleName: "Sample I",
    instrumental: {
      sourness: 3.9,
      umami: 3.9,
      saltiness: 3.0,
      bitterness: 2.2,
      volatileFattyAcids: 3.3,
      diacetyl: 2.8,
      shortChainFA: 1.8, // Borderline
      firmness: 3.4,
    },
    semiTrained: {
      sourness: 3.7,
      umami: 3.8,
      saltiness: 3.1,
      bitterness: 2.4,
      cheesyAroma: 3.2,
      fermentedNote: 2.9,
      rancidNote: 2.1, // Mild detection
      firmness: 3.3,
      offNoteDetected: false, // Borderline - not flagged
      pleasantness: 3,
    },
  },
  {
    id: 10,
    sampleName: "Sample J",
    instrumental: {
      sourness: 3.2,
      umami: 4.6,
      saltiness: 3.4,
      bitterness: 1.6,
      volatileFattyAcids: 3.7,
      diacetyl: 3.0,
      shortChainFA: 0.8,
      firmness: 3.8,
    },
    semiTrained: {
      sourness: 3.1,
      umami: 4.5,
      saltiness: 3.5,
      bitterness: 1.7,
      cheesyAroma: 3.6,
      fermentedNote: 3.1,
      rancidNote: 0.9,
      firmness: 3.7,
      offNoteDetected: false,
      pleasantness: 4,
    },
  },
];

// Attribute definitions for task evaluation
export const tastAttributes = ['sourness', 'umami', 'saltiness', 'bitterness'];
export const aromaAttributes = [
  { instrumental: 'volatileFattyAcids', semiTrained: 'cheesyAroma', name: 'Cheesy Aroma' },
  { instrumental: 'diacetyl', semiTrained: 'fermentedNote', name: 'Fermented Note' },
  { instrumental: 'shortChainFA', semiTrained: 'rancidNote', name: 'Rancid Note' },
];
export const textureAttribute = 'firmness';
