
import { Profile, Interview, InterviewSession, InterviewResponse, EvaluationResult } from '../types';

const KEYS = {
  PROFILES: 'cogniview_profiles_v2',
  INTERVIEWS: 'cogniview_interviews_v2',
  SESSIONS: 'cogniview_sessions_v2',
  RESPONSES: 'cogniview_responses_v2',
  EVALUATIONS: 'cogniview_evaluations_v2',
  CURRENT_USER: 'cogniview_current_user_v2'
};

const get = <T,>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const set = <T,>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const db = {
  profiles: {
    getAll: () => get<Profile[]>(KEYS.PROFILES, []),
    getById: (id: string) => get<Profile[]>(KEYS.PROFILES, []).find(p => p.id === id),
    getByEmail: (email: string) => get<Profile[]>(KEYS.PROFILES, []).find(p => p.email === email),
    save: (profile: Profile) => {
      const all = get<Profile[]>(KEYS.PROFILES, []);
      const idx = all.findIndex(p => p.id === profile.id);
      if (idx > -1) all[idx] = profile;
      else all.push(profile);
      set(KEYS.PROFILES, all);
    }
  },
  interviews: {
    getAll: () => get<Interview[]>(KEYS.INTERVIEWS, []),
    getByCode: (code: string) => get<Interview[]>(KEYS.INTERVIEWS, []).find(i => i.code === code.toUpperCase()),
    save: (interview: Interview) => {
      const all = get<Interview[]>(KEYS.INTERVIEWS, []);
      const idx = all.findIndex(i => i.id === interview.id);
      if (idx > -1) all[idx] = interview;
      else all.push(interview);
      set(KEYS.INTERVIEWS, all);
    },
    delete: (id: string) => {
      set(KEYS.INTERVIEWS, get<Interview[]>(KEYS.INTERVIEWS, []).filter(i => i.id !== id));
    }
  },
  sessions: {
    save: (session: InterviewSession) => {
      const all = get<InterviewSession[]>(KEYS.SESSIONS, []);
      all.push(session);
      set(KEYS.SESSIONS, all);
    },
    getAll: () => get<InterviewSession[]>(KEYS.SESSIONS, []),
    getById: (id: string) => get<InterviewSession[]>(KEYS.SESSIONS, []).find(s => s.id === id),
    getByCandidateId: (candidateId: string) => get<InterviewSession[]>(KEYS.SESSIONS, []).filter(s => s.candidateId === candidateId),
    update: (session: InterviewSession) => {
      const all = get<InterviewSession[]>(KEYS.SESSIONS, []);
      const idx = all.findIndex(s => s.id === session.id);
      if (idx > -1) {
        all[idx] = session;
        set(KEYS.SESSIONS, all);
      }
    }
  },
  responses: {
    save: (res: InterviewResponse) => {
      const all = get<InterviewResponse[]>(KEYS.RESPONSES, []);
      all.push(res);
      set(KEYS.RESPONSES, all);
    },
    getBySession: (sessionId: string) => get<InterviewResponse[]>(KEYS.RESPONSES, []).filter(r => r.sessionId === sessionId)
  },
  evaluations: {
    save: (ev: EvaluationResult) => {
      const all = get<EvaluationResult[]>(KEYS.EVALUATIONS, []);
      all.push(ev);
      set(KEYS.EVALUATIONS, all);
    },
    getBySession: (sessionId: string) => {
      const responses = db.responses.getBySession(sessionId);
      const evals = get<EvaluationResult[]>(KEYS.EVALUATIONS, []);
      return evals.find(e => responses.some(r => r.id === e.responseId));
    }
  },
  auth: {
    getCurrentUser: () => get<Profile | null>(KEYS.CURRENT_USER, null),
    login: (profile: Profile) => set(KEYS.CURRENT_USER, profile),
    logout: () => localStorage.removeItem(KEYS.CURRENT_USER)
  }
};
