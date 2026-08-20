export interface Clip {
  id: string;
  title: string;
  sourceUrl: string;
  durationS: number;
  licence: string;
  attribution: string;
  source: string;
}

export interface ClipsResponse {
  clips: Clip[];
}

export interface PlayEventInput {
  clipId: string;
  completed: boolean;
  sessionHash: string;
}

export interface SubmissionInput {
  submitterEmail: string;
  urlOrKey: string;
  durationS: number;
  note: string;
}

export interface SubmissionResponse {
  id: string;
  status: 'pending';
}
