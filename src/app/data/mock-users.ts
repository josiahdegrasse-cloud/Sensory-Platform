// Mock user database
export interface User {
  id: string;
  email: string;
  password: string;
  role: 'panelist' | 'developer' | 'admin';
  name: string;
  panelistId?: string;
}

export interface QuestionnaireResponse {
  id: string;
  userId: string;
  productId: string;
  timestamp: string;
  cataAttributes: string[];
  intensityRatings: Record<string, number>;
  hedonicScores: {
    overall: number;
    appearance: number;
    aroma: number;
    flavor: number;
    texture: number;
  };
  emotionalProfile: Record<string, number>;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  createdDate: string;
  status: 'active' | 'completed';
  customAttributes?: string[];
  isMultiSample?: boolean;
  samples?: {
    id: string;
    code: string;
    label: string;
  }[];
}

export const MOCK_USERS: User[] = [
  // Panelists
  { id: 'p1', email: 'panelist1@example.com', password: 'demo123', role: 'panelist', name: 'Sarah Johnson', panelistId: 'P001' },
  { id: 'p2', email: 'panelist2@example.com', password: 'demo123', role: 'panelist', name: 'Michael Chen', panelistId: 'P002' },
  { id: 'p3', email: 'panelist3@example.com', password: 'demo123', role: 'panelist', name: 'Emily Rodriguez', panelistId: 'P003' },
  { id: 'p4', email: 'panelist4@example.com', password: 'demo123', role: 'panelist', name: 'James Wilson', panelistId: 'P004' },
  { id: 'p5', email: 'panelist5@example.com', password: 'demo123', role: 'panelist', name: 'Maria Garcia', panelistId: 'P005' },
  
  // Developer
  { id: 'd1', email: 'developer@example.com', password: 'demo123', role: 'developer', name: 'Dev User' },

  // Admin
  { id: 'a1', email: 'admin@example.com', password: 'demo123', role: 'admin', name: 'Admin User' },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'prod1', name: 'Coconut Cheddar v2.1', category: 'Coconut-based', createdDate: '2024-03-15', status: 'active' },
  { id: 'prod2', name: 'Cashew Mozzarella', category: 'Cashew-based', createdDate: '2024-03-18', status: 'active' },
  { id: 'prod3', name: 'Mixed Base Sharp Cheddar', category: 'Mixed base', createdDate: '2024-03-20', status: 'completed' },
  { id: 'prod4', name: 'Almond Gouda', category: 'Almond-based', createdDate: '2024-03-22', status: 'active' },
  {
    id: 'prod5',
    name: 'Coconut Cheddar Comparison',
    category: 'Multi-sample comparison',
    createdDate: '2024-03-25',
    status: 'active',
    isMultiSample: true,
    samples: [
      { id: '1', code: '341', label: 'Coconut Cheddar v2.0' },
      { id: '2', code: '872', label: 'Coconut Cheddar v2.1' },
      { id: '3', code: '529', label: 'Dairy Cheddar (Control)' }
    ]
  },
  {
    id: 'prod6',
    name: 'Mozzarella Benchmarking',
    category: 'Multi-sample comparison',
    createdDate: '2024-03-28',
    status: 'active',
    isMultiSample: true,
    samples: [
      { id: '1', code: '156', label: 'Cashew Mozzarella' },
      { id: '2', code: '734', label: 'Almond Mozzarella' },
      { id: '3', code: '982', label: 'Dairy Mozzarella (Control)' }
    ]
  },
{ id: '9', name: 'Almond Feta v1.5', category: 'Almond-based', createdDate: '2024-04-03', status: 'active' },
  { id: '10', name: 'Oat-based Brie', category: 'Oat-based', createdDate: '2024-04-04', status: 'active' },
  { id: '11', name: 'Coconut Parmesan', category: 'Coconut-based', createdDate: '2024-04-05', status: 'active' },
  { id: '12', name: 'Cashew Cream Cheese', category: 'Cashew-based', createdDate: '2024-04-06', status: 'active' },
];

export const MOCK_RESPONSES: QuestionnaireResponse[] = [
  {
    id: 'r1',
    userId: 'p1',
    productId: 'prod1',
    timestamp: '2024-03-15T10:30:00Z',
    cataAttributes: ['Milk', 'Creamy', 'Butter', 'Nutty', 'Salty'],
    intensityRatings: { 'Milk': 6, 'Creamy': 7, 'Butter': 5, 'Nutty': 4, 'Salty': 6 },
    hedonicScores: { overall: 7.5, appearance: 7, aroma: 7, flavor: 8, texture: 7 },
    emotionalProfile: { 'Happy': 3, 'Satisfied': 4, 'Pleasant': 3, 'Interested': 2 }
  },
  {
    id: 'r2',
    userId: 'p2',
    productId: 'prod1',
    timestamp: '2024-03-15T11:15:00Z',
    cataAttributes: ['Milk', 'Butter', 'Salty', 'Tangy', 'Creamy'],
    intensityRatings: { 'Milk': 5, 'Butter': 6, 'Salty': 7, 'Tangy': 3, 'Creamy': 6 },
    hedonicScores: { overall: 6.5, appearance: 6, aroma: 6, flavor: 7, texture: 6 },
    emotionalProfile: { 'Satisfied': 3, 'Pleasant': 2, 'Curious': 2 }
  },
  {
    id: 'r3',
    userId: 'p3',
    productId: 'prod2',
    timestamp: '2024-03-18T09:45:00Z',
    cataAttributes: ['Milk', 'Creamy', 'Mild', 'Fresh'],
    intensityRatings: { 'Milk': 7, 'Creamy': 8, 'Mild': 6, 'Fresh': 5 },
    hedonicScores: { overall: 8, appearance: 8, aroma: 7, flavor: 8, texture: 9 },
    emotionalProfile: { 'Happy': 4, 'Satisfied': 5, 'Pleasant': 4, 'Delighted': 3 }
  },
];

// Default CATA attributes (can be customized per product)
export const DEFAULT_CATA_ATTRIBUTES = [
  // Positive dairy notes
  'Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Fresh', 'Mild', 'Sharp', 
  'Aged', 'Nutty', 'Sweet', 'Salty', 'Umami',
  // Textural
  'Smooth', 'Firm', 'Spreadable', 'Crumbly',
  // Off-notes
  'Rancid', 'Cardboard', 'Fermented', 'Bitter', 'Astringent', 'Soapy',
  'Coconut', 'Beany', 'Chalky', 'Oily'
];

export const INTENSITY_ATTRIBUTES = [
  'Milk', 'Creamy', 'Butter', 'Cheese', 'Tangy', 'Nutty', 'Salty', 'Sweet'
];

export const ESSENSE25_EMOTIONS = {
  positive: [
    'Happy', 'Satisfied', 'Pleasant', 'Delighted', 'Interested', 'Curious',
    'Enthusiastic', 'Calm', 'Comfortable', 'Energetic', 'Good', 'Joyful',
    'Loving', 'Nostalgic', 'Peaceful', 'Secure', 'Warm'
  ],
  negative: [
    'Disgusted', 'Bored', 'Disappointed', 'Worried', 'Aggressive', 'Guilty',
    'Tame', 'Uninterested'
  ]
};