import { ShortTermMemory, LongTermMemory, TasteProfile, MemoryFact } from '@/types/memory';
import { db, auth } from '@/lib/firebase/client';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const LTM_STORAGE_KEY = 'breakbeats_ai_ltm_v1';
const STM_STORAGE_KEY = 'breakbeats_ai_stm_v1';

export const DEFAULT_TASTE_PROFILE: TasteProfile = {
  favoriteGenres: ['Boom Bap', '90s Breakbeat', 'Funk Breaks', 'Drum & Bass', 'Electro'],
  bpmSweetSpot: {
    min: 88,
    max: 135,
    preferred: 96,
  },
  eraPreferences: ['90s Golden Era', 'Mid-80s Early Sampling', 'Modern Vinyl Revival'],
  favoriteArtists: ['DJ Shadow', 'The Prodigy', 'Grandmaster Flash', 'J Dilla', 'Roni Size'],
  gearInterests: ['E-mu SP-1200', 'Akai MPC60', 'Technics SL-1200MK2', 'Ensoniq ASR-10'],
  vibeTags: ['Raw Dusty Drums', 'Analog Warmth', 'Heavy Basslines', 'Authentic Crate Digger'],
};

export const DEFAULT_INITIAL_FACTS: MemoryFact[] = [
  {
    id: 'fact-init-1',
    fact: 'Loves classic 12-bit sampler crunch, vinyl crackle, and unquantized organic break loops.',
    category: 'preference',
    timestamp: new Date().toISOString(),
    source: 'agent_inferred',
  },
  {
    id: 'fact-init-2',
    fact: 'Prefers high-tempo breakbeats and jungle for high-energy sessions and 90s boom bap for chill listening.',
    category: 'preference',
    timestamp: new Date().toISOString(),
    source: 'agent_inferred',
  },
  {
    id: 'fact-init-3',
    fact: 'Active audio crate digger interested in limited vinyl runs and analog production gear.',
    category: 'equipment',
    timestamp: new Date().toISOString(),
    source: 'agent_inferred',
  },
];

export const createDefaultLongTermMemory = (userId: string = 'default-user', userName?: string): LongTermMemory => ({
  userId,
  userName: userName || 'ChanceTEK One',
  tasteProfile: { ...DEFAULT_TASTE_PROFILE },
  explicitFacts: [...DEFAULT_INITIAL_FACTS],
  historicalSummary: 'Passionate breakbeat explorer, crate digger, and hip-hop culture enthusiast.',
  totalInteractions: 1,
  lastUpdated: new Date().toISOString(),
});

export const createDefaultShortTermMemory = (): ShortTermMemory => ({
  sessionId: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  sessionWorkingNotes: [],
  recentQueries: [],
  lastInteractionTime: new Date().toISOString(),
});

// Memory Manager Service
export class MemoryManager {
  // --- SHORT TERM MEMORY (SESSION) ---

  static getShortTermMemory(): ShortTermMemory {
    if (typeof window === 'undefined') return createDefaultShortTermMemory();
    try {
      const stored = localStorage.getItem(STM_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse STM from localStorage', e);
    }
    const fresh = createDefaultShortTermMemory();
    this.saveShortTermMemory(fresh);
    return fresh;
  }

  static saveShortTermMemory(stm: ShortTermMemory): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STM_STORAGE_KEY, JSON.stringify(stm));
    } catch (e) {
      console.warn('Failed to save STM to localStorage', e);
    }
  }

  static updateShortTermContext(updates: Partial<ShortTermMemory>): ShortTermMemory {
    const current = this.getShortTermMemory();
    const updated: ShortTermMemory = {
      ...current,
      ...updates,
      lastInteractionTime: new Date().toISOString(),
    };
    this.saveShortTermMemory(updated);
    return updated;
  }

  static addSessionWorkingNote(note: string): ShortTermMemory {
    const current = this.getShortTermMemory();
    const notes = current.sessionWorkingNotes || [];
    if (!notes.includes(note)) {
      notes.push(note);
      if (notes.length > 8) notes.shift(); // Keep latest 8 working notes
    }
    const updated = { ...current, sessionWorkingNotes: notes };
    this.saveShortTermMemory(updated);
    return updated;
  }

  static addRecentQuery(query: string): ShortTermMemory {
    const current = this.getShortTermMemory();
    const queries = current.recentQueries || [];
    if (!queries.includes(query)) {
      queries.push(query);
      if (queries.length > 5) queries.shift();
    }
    const updated = { ...current, recentQueries: queries };
    this.saveShortTermMemory(updated);
    return updated;
  }

  static clearShortTermMemory(): ShortTermMemory {
    const fresh = createDefaultShortTermMemory();
    this.saveShortTermMemory(fresh);
    return fresh;
  }

  // --- LONG TERM MEMORY (PERSISTENT USER PROFILE) ---

  static getLongTermMemory(userId: string = 'default-user', userName?: string): LongTermMemory {
    if (typeof window === 'undefined') return createDefaultLongTermMemory(userId, userName);
    try {
      const stored = localStorage.getItem(`${LTM_STORAGE_KEY}_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (userName && !parsed.userName) parsed.userName = userName;
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to read LTM from localStorage', e);
    }

    const fresh = createDefaultLongTermMemory(userId, userName);
    this.saveLongTermMemory(fresh);
    return fresh;
  }

  static saveLongTermMemory(memory: LongTermMemory): void {
    if (typeof window === 'undefined') return;
    try {
      memory.lastUpdated = new Date().toISOString();
      localStorage.setItem(`${LTM_STORAGE_KEY}_${memory.userId}`, JSON.stringify(memory));

      // Optional background sync with Firestore if online & db exists
      this.syncWithFirestore(memory).catch(() => {});
    } catch (e) {
      console.warn('Failed to save LTM to localStorage', e);
    }
  }

  static addExplicitFact(
    fact: string,
    category: MemoryFact['category'] = 'preference',
    userId: string = 'default-user',
    source: 'user_stated' | 'agent_inferred' = 'user_stated'
  ): MemoryFact {
    const ltm = this.getLongTermMemory(userId);
    const newFact: MemoryFact = {
      id: `fact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fact: fact.trim(),
      category,
      timestamp: new Date().toISOString(),
      source,
    };

    // Prevent duplicate or identical facts
    const exists = ltm.explicitFacts.some(
      (f) => f.fact.toLowerCase() === newFact.fact.toLowerCase()
    );

    if (!exists) {
      ltm.explicitFacts.unshift(newFact);
      if (ltm.explicitFacts.length > 25) {
        ltm.explicitFacts.pop(); // Keep top 25 recent salient facts
      }
      this.saveLongTermMemory(ltm);
    }

    return newFact;
  }

  static removeFact(factId: string, userId: string = 'default-user'): void {
    const ltm = this.getLongTermMemory(userId);
    ltm.explicitFacts = ltm.explicitFacts.filter((f) => f.id !== factId);
    this.saveLongTermMemory(ltm);
  }

  static updateTasteProfile(
    updates: Partial<TasteProfile>,
    userId: string = 'default-user'
  ): TasteProfile {
    const ltm = this.getLongTermMemory(userId);
    ltm.tasteProfile = {
      ...ltm.tasteProfile,
      ...updates,
      bpmSweetSpot: {
        ...ltm.tasteProfile.bpmSweetSpot,
        ...(updates.bpmSweetSpot || {}),
      },
    };
    this.saveLongTermMemory(ltm);
    return ltm.tasteProfile;
  }

  static resetLongTermMemory(userId: string = 'default-user', userName?: string): LongTermMemory {
    const fresh = createDefaultLongTermMemory(userId, userName);
    this.saveLongTermMemory(fresh);
    return fresh;
  }

  // --- FIRESTORE SYNC ---

  private static async syncWithFirestore(memory: LongTermMemory): Promise<void> {
    if (!db || !auth?.currentUser || !memory.userId || memory.userId === 'default-user' || auth.currentUser.uid !== memory.userId) {
      return;
    }
    try {
      const memoryRef = doc(db, 'users', memory.userId, 'ai_memory', 'profile');
      await setDoc(memoryRef, memory, { merge: true });
    } catch {
      // Quiet fail if offline, unauthenticated, or permission not yet provisioned
    }
  }

  static async hydrateFromFirestore(userId: string): Promise<LongTermMemory | null> {
    if (!db || !auth?.currentUser || !userId || userId === 'default-user' || auth.currentUser.uid !== userId) {
      return null;
    }
    try {
      const memoryRef = doc(db, 'users', userId, 'ai_memory', 'profile');
      const snap = await getDoc(memoryRef);
      if (snap.exists()) {
        const data = snap.data() as LongTermMemory;
        this.saveLongTermMemory(data);
        return data;
      }
    } catch {
      // Quiet fail to local storage cache if permission or network issue occurs
    }
    return null;
  }

  // --- HEURISTIC INSIGHT EXTRACTOR ---
  static extractMemoryInsights(userText: string, userId: string = 'default-user'): { newFact?: MemoryFact; tasteUpdate?: Partial<TasteProfile> } {
    const text = userText.toLowerCase();
    let newFact: MemoryFact | undefined;
    let tasteUpdate: Partial<TasteProfile> | undefined;

    // Detect explicit remember instruction
    const rememberMatch = userText.match(/(?:remember that|note that|don'?t forget that)\s+(.*)/i);
    if (rememberMatch && rememberMatch[1]) {
      newFact = this.addExplicitFact(rememberMatch[1].trim(), 'preference', userId, 'user_stated');
    }

    // Detect BPM preference
    const bpmMatch = text.match(/(?:bpm|tempo)\s*(?:is|of|around|at)?\s*(\d{2,3})/i);
    if (bpmMatch && bpmMatch[1]) {
      const bpmNum = parseInt(bpmMatch[1], 10);
      if (bpmNum >= 60 && bpmNum <= 200) {
        tasteUpdate = {
          bpmSweetSpot: {
            min: Math.max(60, bpmNum - 15),
            max: Math.min(200, bpmNum + 15),
            preferred: bpmNum,
          },
        };
        this.updateTasteProfile(tasteUpdate, userId);
      }
    }

    // Detect Gear Mentions
    const gearList = ['sp-1200', 'sp1200', 'mpc60', 'mpc 60', 'mpc2000', 'asr-10', 'technics', 'turntables', 'vinyl'];
    const foundGear = gearList.find((g) => text.includes(g));
    if (foundGear && !newFact) {
      newFact = this.addExplicitFact(`Uses/interested in ${foundGear.toUpperCase()} equipment`, 'equipment', userId, 'agent_inferred');
    }

    return { newFact, tasteUpdate };
  }
}
