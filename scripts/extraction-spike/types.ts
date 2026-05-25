export interface Email {
  id: string;
  messageId?: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  date: string;
  body: string;
}

export type Owner = "me" | "other";
export type Priority = "high" | "medium" | "low";

export interface Commitment {
  task: string;
  owner: Owner;
  ownerName?: string;
  dueDate?: string;
  priority?: Priority;
  sourceQuote?: string;
}

export interface CorpusEntry {
  email: Email;
  expectedCommitments: Commitment[];
  notes?: string;
}

export interface ExtractionResult {
  emailId: string;
  extracted: Commitment[];
  rawResponse?: string;
  error?: string;
  model: string;
  latencyMs: number;
}

export interface ScoreEntry {
  emailId: string;
  truePositives: { extracted: Commitment; expected: Commitment }[];
  falsePositives: Commitment[];
  falseNegatives: Commitment[];
}

export interface AggregateScore {
  totalEmails: number;
  totalExtracted: number;
  totalExpected: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}
