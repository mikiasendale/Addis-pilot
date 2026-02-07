export enum AppMode {
  STUDENT = 'STUDENT',
  PRINCIPAL = 'PRINCIPAL' // For the sales pitch
}

export type NavigationStep = 'GRADE_SELECT' | 'SUBJECT_SELECT' | 'VIEWING';
export type Language = 'ENGLISH' | 'AMHARIC' | 'OROMO';

export interface Subject {
  id: string;
  nameKey: string;
  iconName: string; 
  pdfUrl: string;
  startPage?: number;
}

export interface GradeLevel {
  id: string;
  labelKey: string;
  subjects: Subject[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface StudentStats {
  subject: string;
  currentGrade: number;
  predictedGrade: number;
  weakness: string;
}

// --- NEW QUIZ TYPES ---
export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizResult {
  score: number;
  total: number;
}