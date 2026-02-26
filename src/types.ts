export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  category: string;
  registration_count: number;
}

export interface Registration {
  id: number;
  user_id: number;
  event_id: number;
  registered_at: string;
  attended: number;
  name?: string;
  email?: string;
  title?: string;
  date?: string;
  location?: string;
}

export interface AIPrediction {
  predicted_attendance_count: number;
  confidence_score: number;
  reasoning: string;
  suggestions: string[];
}
