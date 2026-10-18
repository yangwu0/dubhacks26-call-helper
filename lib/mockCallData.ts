export type RoutingStatus =
  | "waiting"
  | "screening"
  | "forwarding"
  | "blocked"
  | "message_taken";

export type TranscriptLine = {
  id: string;
  role: "agent" | "caller";
  text: string;
  at: string;
};

export type RiskPoint = {
  at: string;
  score: number;
  reasons: string[];
};

export type CallRecord = {
  id: string;
  callerNumber: string;
  callerName: string;
  targetMatch: boolean | null;
  status: "in_progress" | "completed";
  classification: "scam" | "legit_important" | "legit_routine" | "unknown";
  riskScore: number;
  riskReasons: string[];
  action: "none" | "blocked" | "forwarded" | "message_taken" | "booked";
  summary: string;
  transcript: TranscriptLine[];
  riskTimeline: RiskPoint[];
  startedAt: string;
  endedAt: string | null;
};

export type OwnerProfile = {
  id: string;
  name: string;
  aliases: string[];
  phone: string;
  photonNumber: string;
  isDndOn: boolean;
};

export type FlaggedNumber = {
  number: string;
  reason: string;
  createdAt: string;
};

export type DemoLine = Omit<TranscriptLine, "id" | "at">;

export type DemoStep = {
  score: number;
  action: RoutingStatus;
  reasons: string[];
  callerName: string;
  callerNumber: string;
  claimedTarget: string;
  targetMatch: boolean | null;
  lines: DemoLine[];
};

export const DEMO_INTERVAL_MS = 1800;

export const SCAM_DEMO_STEPS: DemoStep[] = [
  {
    score: 10,
    action: "screening",
    reasons: ["Caller just asked for Alex"],
    callerName: "Unknown caller",
    callerNumber: "+18005550199",
    claimedTarget: "Alex Kim",
    targetMatch: null,
    lines: [
      {
        role: "agent",
        text: "Hi, I'm Sift, an AI assistant for Alex. This call may be recorded. Who are you trying to reach?",
      },
      {
        role: "caller",
        text: "Hello, I am trying to reach Alex Kim. Is this the right number?",
      },
    ],
  },
  {
    score: 45,
    action: "screening",
    reasons: ["Claimed to be the IRS", "Hinted at a warrant"],
    callerName: "Officer Grant",
    callerNumber: "+18005550199",
    claimedTarget: "Alex Kim",
    targetMatch: true,
    lines: [
      {
        role: "caller",
        text: "This is Officer Grant from the IRS. Alex Kim has a warrant for unpaid taxes.",
      },
    ],
  },
  {
    score: 80,
    action: "blocked",
    reasons: [
      "Claimed to be the IRS",
      "Threatened arrest",
      "Demanded gift cards",
    ],
    callerName: "Officer Grant",
    callerNumber: "+18005550199",
    claimedTarget: "Alex Kim",
    targetMatch: true,
    lines: [
      {
        role: "agent",
        text: "I can take a message, but I can't move money or share private details. I'm an AI assistant.",
      },
      {
        role: "caller",
        text: "Then buy two thousand dollars in gift cards right now, or the arrest happens today.",
      },
    ],
  },
];

function line(
  id: string,
  role: TranscriptLine["role"],
  text: string,
  at: string,
): TranscriptLine {
  return { id, role, text, at };
}

export const MOCK_OWNER: OwnerProfile = {
  id: "a1e00000-0000-4000-8000-000000000001",
  name: "Alex Kim",
  aliases: ["Alex", "Alexander Kim"],
  phone: "+12065550100",
  photonNumber: "",
  isDndOn: false,
};

export const MOCK_FLAGGED: FlaggedNumber[] = [
  {
    number: "+18005550199",
    reason: "IRS impersonation. Demanded gift cards.",
    createdAt: "2026-10-15T09:15:00-07:00",
  },
  {
    number: "+18005550288",
    reason: "Extended warranty scam. Asked for remote access.",
    createdAt: "2026-10-16T14:43:00-07:00",
  },
];

export const MOCK_CALLS: CallRecord[] = [
  {
    id: "a1e00000-0000-4000-8000-000000000101",
    callerNumber: "+18005550199",
    callerName: "Officer Grant",
    targetMatch: true,
    status: "completed",
    classification: "scam",
    riskScore: 92,
    riskReasons: [
      "Claimed to be the IRS",
      "Threatened immediate arrest",
      "Demanded payment in gift cards",
    ],
    action: "blocked",
    summary:
      "Caller claimed to be the IRS and told Alex to buy gift cards to avoid arrest. Sift refused and blocked the number.",
    startedAt: "2026-10-15T09:12:00-07:00",
    endedAt: "2026-10-15T09:15:00-07:00",
    transcript: [
      line(
        "irs-1",
        "agent",
        "Hi, this is an AI assistant for Alex Kim. This call may be recorded. Who are you trying to reach?",
        "2026-10-15T09:12:10-07:00",
      ),
      line(
        "irs-2",
        "caller",
        "This is Officer Grant with the IRS. Alex Kim owes back taxes and will be arrested today.",
        "2026-10-15T09:12:28-07:00",
      ),
      line(
        "irs-3",
        "agent",
        "I can't take payment or share personal details. What number should Alex use if this is legitimate?",
        "2026-10-15T09:13:00-07:00",
      ),
      line(
        "irs-4",
        "caller",
        "There is no time. Buy gift cards and stay on the line or the arrest goes through.",
        "2026-10-15T09:13:40-07:00",
      ),
    ],
    riskTimeline: [
      {
        at: "2026-10-15T09:12:30-07:00",
        score: 48,
        reasons: ["Claimed to be the IRS"],
      },
      {
        at: "2026-10-15T09:13:10-07:00",
        score: 74,
        reasons: ["Claimed to be the IRS", "Threatened immediate arrest"],
      },
      {
        at: "2026-10-15T09:13:45-07:00",
        score: 92,
        reasons: [
          "Claimed to be the IRS",
          "Threatened immediate arrest",
          "Demanded payment in gift cards",
        ],
      },
    ],
  },
  {
    id: "a1e00000-0000-4000-8000-000000000102",
    callerNumber: "+18005550288",
    callerName: "Vehicle Services",
    targetMatch: false,
    status: "completed",
    classification: "scam",
    riskScore: 81,
    riskReasons: [
      "Unsolicited car-warranty pitch",
      "Would not name who they were calling for",
      "Asked to install remote-access software",
    ],
    action: "blocked",
    summary:
      "Caller pushed an expiring car warranty and asked Alex to install remote software. Sift ended the call and blocked the number.",
    startedAt: "2026-10-16T14:40:00-07:00",
    endedAt: "2026-10-16T14:43:00-07:00",
    transcript: [
      line(
        "war-1",
        "agent",
        "Hi, this is an AI assistant. This call may be recorded. Who are you trying to reach?",
        "2026-10-16T14:40:08-07:00",
      ),
      line(
        "war-2",
        "caller",
        "Your vehicle warranty expires today. I need you to download a support app so I can renew it.",
        "2026-10-16T14:40:30-07:00",
      ),
    ],
    riskTimeline: [
      {
        at: "2026-10-16T14:40:40-07:00",
        score: 55,
        reasons: ["Unsolicited car-warranty pitch"],
      },
      {
        at: "2026-10-16T14:41:20-07:00",
        score: 81,
        reasons: [
          "Unsolicited car-warranty pitch",
          "Asked to install remote-access software",
        ],
      },
    ],
  },
  {
    id: "a1e00000-0000-4000-8000-000000000103",
    callerNumber: "+12065551010",
    callerName: "Dana Ruiz",
    targetMatch: true,
    status: "completed",
    classification: "legit_important",
    riskScore: 18,
    riskReasons: ["Named Alex Kim", "Building maintenance, not a payment demand"],
    action: "forwarded",
    summary:
      "Dana Ruiz from the building called about a kitchen leak. The name matched and the risk was low, so Sift bridged Alex into the call.",
    startedAt: "2026-10-14T11:05:00-07:00",
    endedAt: "2026-10-14T11:12:00-07:00",
    transcript: [
      line(
        "land-1",
        "agent",
        "Hi, this is an AI assistant for Alex Kim. This call may be recorded. Who are you trying to reach?",
        "2026-10-14T11:05:08-07:00",
      ),
      line(
        "land-2",
        "caller",
        "Dana Ruiz, the landlord. I need Alex Kim about a leak under the kitchen sink tomorrow.",
        "2026-10-14T11:05:24-07:00",
      ),
    ],
    riskTimeline: [
      {
        at: "2026-10-14T11:05:30-07:00",
        score: 18,
        reasons: ["Named Alex Kim", "Building maintenance, not a payment demand"],
      },
    ],
  },
  {
    id: "a1e00000-0000-4000-8000-000000000104",
    callerNumber: "+12065551020",
    callerName: "Cascade Pharmacy",
    targetMatch: true,
    status: "completed",
    classification: "legit_routine",
    riskScore: 22,
    riskReasons: ["Named Alex Kim", "Routine prescription notice"],
    action: "message_taken",
    summary:
      "Cascade Pharmacy said Alex's prescription is ready for pickup today. Sift took the message instead of interrupting.",
    startedAt: "2026-10-13T16:20:00-07:00",
    endedAt: "2026-10-13T16:22:00-07:00",
    transcript: [
      line(
        "rx-1",
        "agent",
        "Hi, this is an AI assistant for Alex Kim. This call may be recorded. Who are you trying to reach?",
        "2026-10-13T16:20:06-07:00",
      ),
      line(
        "rx-2",
        "caller",
        "Cascade Pharmacy. Alex Kim's prescription is ready at the counter until 7.",
        "2026-10-13T16:20:22-07:00",
      ),
    ],
    riskTimeline: [
      {
        at: "2026-10-13T16:20:30-07:00",
        score: 22,
        reasons: ["Named Alex Kim", "Routine prescription notice"],
      },
    ],
  },
];

export const REPORT_PLACEHOLDER =
  "Your weekly note from Sift will land here. It will say how many calls were handled, which scams were stopped, and how much of your week you got back.";
