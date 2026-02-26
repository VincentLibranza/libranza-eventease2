export interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  created_at: string;
  participants?: Participant[];
}

export interface Participant {
  id: number;
  event_id: number;
  name: string;
  email: string;
  department: string;
  status: string;
  registered_at: string;
}

export interface Attendance {
  id: number;
  participant_id: number;
  event_id: number;
  attended_at: string;
}

export interface Stats {
  totalEvents: number;
  totalParticipants: number;
  totalAttendance: number;
  departmentStats: { department: string; count: number }[];
  eventStats: { title: string; date: string; registrations: number; attendance: number }[];
}
