import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Member, AttendanceRecord, FineRecord, Group, AttendanceStatus, Role } from '../types';
import { differenceInWeeks, startOfToday, isThursday, format, parseISO } from 'date-fns';

// Error Handling as per Firebase Skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Rotation Logic ---
const START_DATE = new Date(2026, 4, 14); // May 14, 2026

export function getSessionState(date: Date = new Date()) {
  if (!isThursday(date) && format(date, 'yyyy-MM-dd') !== format(START_DATE, 'yyyy-MM-dd')) {
    // Note: The constraint is Attendance is ONLY on Thursdays.
    // If it's not Thursday, we can still show who WOULD speak.
  }

  const weeksSinceStart = differenceInWeeks(date, START_DATE);
  if (weeksSinceStart < 0) return { groupSpeaking: 'A' as Group | 'none', isRestDay: false, weekIndex: 0 };

  const cycleIndex = weeksSinceStart % 4;
  
  if (cycleIndex === 0) return { groupSpeaking: 'A' as Group | 'none', isRestDay: false, weekIndex: 0 };
  if (cycleIndex === 1) return { groupSpeaking: 'B' as Group | 'none', isRestDay: false, weekIndex: 1 };
  if (cycleIndex === 2) return { groupSpeaking: 'C' as Group | 'none', isRestDay: false, weekIndex: 2 };
  return { groupSpeaking: 'none' as Group | 'none', isRestDay: true, weekIndex: 3 };
}

// --- Service Functions ---

export const memberService = {
  async getAll(): Promise<Member[]> {
    const path = 'members';
    try {
      const q = query(collection(db, path), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate(),
        updatedAt: (doc.data().updatedAt as Timestamp)?.toDate()
      } as Member));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async add(name: string, group: Group): Promise<void> {
    const path = 'members';
    try {
      const id = doc(collection(db, path)).id;
      const data = {
        name,
        group,
        totalScore: 0,
        totalFinePaid: 0,
        totalFineDue: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, path, id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async remove(id: string): Promise<void> {
    const path = `members/${id}`;
    try {
      await deleteDoc(doc(db, 'members', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};

export const attendanceService = {
  async getByDate(dateStr: string): Promise<AttendanceRecord[]> {
    const path = 'attendance';
    try {
      const q = query(collection(db, path), where('date', '==', dateStr));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate(),
        updatedAt: (doc.data().updatedAt as Timestamp)?.toDate()
      } as AttendanceRecord));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async markAttendance(
    member: Member, 
    dateStr: string, 
    status: AttendanceStatus, 
    role: Role, 
    marks: number
  ): Promise<void> {
    const path = 'attendance';
    const docId = `${dateStr}_${member.id}`;
    
    try {
      await runTransaction(db, async (transaction) => {
        const attendanceRef = doc(db, 'attendance', docId);
        const memberRef = doc(db, 'members', member.id);
        
        const attendanceDoc = await transaction.get(attendanceRef);
        const currentMemberDoc = await transaction.get(memberRef);
        
        if (!currentMemberDoc.exists()) throw new Error("Member not found");
        
        const memberData = currentMemberDoc.data() as Member;
        let scoreDiff = marks;
        
        if (attendanceDoc.exists()) {
          // If updating existing record, adjust the total score
          const oldMarks = (attendanceDoc.data() as AttendanceRecord).marks;
          scoreDiff = marks - oldMarks;
        }
        
        const newAttendance = {
          date: dateStr,
          memberId: member.id,
          group: member.group,
          role,
          status,
          marks,
          createdAt: attendanceDoc.exists() ? attendanceDoc.data().createdAt : serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        transaction.set(attendanceRef, newAttendance);
        transaction.update(memberRef, {
          totalScore: memberData.totalScore + scoreDiff,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};

export const fineService = {
  async getAll(): Promise<FineRecord[]> {
    const path = 'fines';
    try {
      const q = query(collection(db, path), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: (doc.data().date as Timestamp)?.toDate(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate()
      } as FineRecord));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async deductFine(member: Member, amount: number, reason: string): Promise<void> {
    const path = 'fines';
    try {
      await runTransaction(db, async (transaction) => {
        const memberRef = doc(db, 'members', member.id);
        const fineRef = doc(collection(db, 'fines'));
        
        const currentMemberDoc = await transaction.get(memberRef);
        if (!currentMemberDoc.exists()) throw new Error("Member not found");
        
        const memberData = currentMemberDoc.data() as Member;
        
        const fineData = {
          memberId: member.id,
          memberName: member.name,
          amount,
          reason,
          status: 'due',
          date: serverTimestamp(),
          createdAt: serverTimestamp()
        };
        
        transaction.set(fineRef, fineData);
        transaction.update(memberRef, {
          totalScore: memberData.totalScore - amount, // Prompt says: "Subtract from their Total Score (if applicable)"
          totalFineDue: memberData.totalFineDue + amount,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async payFine(fine: FineRecord): Promise<void> {
    const path = `fines/${fine.id}`;
    try {
      await runTransaction(db, async (transaction) => {
        const fineRef = doc(db, 'fines', fine.id);
        const memberRef = doc(db, 'members', fine.memberId);
        
        const currentFineDoc = await transaction.get(fineRef);
        const currentMemberDoc = await transaction.get(memberRef);
        
        if (!currentFineDoc.exists() || !currentMemberDoc.exists()) throw new Error("Document not found");
        if (currentFineDoc.data().status === 'paid') return; // Already paid
        
        const memberData = currentMemberDoc.data() as Member;
        
        transaction.update(fineRef, { status: 'paid' });
        transaction.update(memberRef, {
          totalFineDue: Math.max(0, memberData.totalFineDue - fine.amount),
          totalFinePaid: memberData.totalFinePaid + fine.amount,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};

export const adminService = {
  async isAdmin(email: string): Promise<boolean> {
    // First, check if it's the bootstrapped admin
    if (email === 'mdimranhasanfuyad@gmail.com') return true;
    
    const path = 'admins';
    try {
      const q = query(collection(db, path), where('email', '==', email));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      // If we can't read admins, they probably aren't admin or rules blocked it
      return false;
    }
  }
};
