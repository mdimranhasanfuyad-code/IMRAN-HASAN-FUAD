export type Group = 'A' | 'B' | 'C';
export type Role = 'speaker' | 'listener' | 'none';
export type AttendanceStatus = 'present' | 'absent';
export type FineStatus = 'due' | 'paid';

export interface Member {
  id: string;
  name: string;
  group: Group;
  totalScore: number;
  totalFinePaid: number;
  totalFineDue: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  memberId: string;
  group: Group;
  role: Role;
  status: AttendanceStatus;
  marks: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FineRecord {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  reason: string;
  status: FineStatus;
  date: Date;
  createdAt: Date;
}

export interface Admin {
  id: string;
  email: string;
}
