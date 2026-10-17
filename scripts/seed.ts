import { createServiceClient } from "../lib/supabase";

const OWNER_ID = "a1e00000-0000-4000-8000-000000000001";

const CALL_IDS = {
  scamIrs: "a1e00000-0000-4000-8000-000000000101",
  scamWarranty: "a1e00000-0000-4000-8000-000000000102",
  important: "a1e00000-0000-4000-8000-000000000103",
  routine: "a1e00000-0000-4000-8000-000000000104",
} as const;

function assertOk(error: { message: string } | null, step: string) {
  if (error) {
    throw new Error(`${step}: ${error.message}`);
  }
}

async function main() {
  const supabase = createServiceClient();
  const ownerPhone = process.env.OWNER_PHONE || "+12065550100";

  const owner = await supabase.from("owners").upsert(
    {
      id: OWNER_ID,
      name: "Alex Kim",
      aliases: ["Alex", "Alexander Kim"],
      phone: ownerPhone,
      imessage_handle: ownerPhone,
      timezone: "America/Los_Angeles",
    },
    { onConflict: "id" },
  );
  assertOk(owner.error, "owners");

  const contacts = await supabase.from("contacts").upsert(
    [
      { number: "+12065551001", name: "Jordan Lee", trusted: true },
      { number: "+12065551002", name: "Priya Shah", trusted: true },
      { number: "+12065551003", name: "Sam Ortiz", trusted: true },
    ],
    { onConflict: "number" },
  );
  assertOk(contacts.error, "contacts");

  const blocked = await supabase.from("blocked_numbers").upsert(
    [
      {
        number: "+18005550199",
        reason: "IRS impersonation. Demanded gift cards.",
      },
      {
        number: "+18005550288",
        reason: "Extended warranty scam. Asked for remote access.",
      },
    ],
    { onConflict: "number" },
  );
  assertOk(blocked.error, "blocked_numbers");

  const calls = await supabase.from("calls").upsert(
    [
      {
        id: CALL_IDS.scamIrs,
        owner_id: OWNER_ID,
        conversation_id: "seed-scam-irs",
        call_sid: "CA_seed_scam_irs",
        caller_number: "+18005550199",
        caller_name: "Officer Grant",
        claimed_target: "Alex Kim",
        target_match: true,
        status: "completed",
        classification: "scam",
        risk_score: 92,
        risk_reasons: [
          "Claimed to be the IRS",
          "Threatened immediate arrest",
          "Demanded payment in gift cards",
        ],
        caller_intent: "Collect a fake tax debt",
        action: "blocked",
        summary:
          "Caller claimed to be the IRS and told Alex to buy gift cards to avoid arrest. Sift refused and blocked the number.",
        transcript: [
          {
            role: "agent",
            message:
              "Hi, this is an AI assistant for Alex Kim. This call may be recorded. Who are you trying to reach?",
          },
          {
            role: "user",
            message:
              "This is Officer Grant with the IRS. Alex Kim owes back taxes and will be arrested today.",
          },
        ],
        started_at: "2026-10-15T09:12:00-07:00",
        ended_at: "2026-10-15T09:15:00-07:00",
      },
      {
        id: CALL_IDS.scamWarranty,
        owner_id: OWNER_ID,
        conversation_id: "seed-scam-warranty",
        call_sid: "CA_seed_scam_warranty",
        caller_number: "+18005550288",
        caller_name: "Vehicle Services",
        claimed_target: "the homeowner",
        target_match: false,
        status: "completed",
        classification: "scam",
        risk_score: 81,
        risk_reasons: [
          "Unsolicited car-warranty pitch",
          "Would not name who they were calling for",
          "Asked to install remote-access software",
        ],
        caller_intent: "Sell a fake vehicle warranty",
        action: "blocked",
        summary:
          "Caller pushed an expiring car warranty and asked Alex to install remote software. Sift ended the call and blocked the number.",
        transcript: [
          {
            role: "agent",
            message:
              "Hi, this is an AI assistant. This call may be recorded. Who are you trying to reach?",
          },
          {
            role: "user",
            message:
              "Your vehicle warranty expires today. I need you to download a support app so I can renew it.",
          },
        ],
        started_at: "2026-10-16T14:40:00-07:00",
        ended_at: "2026-10-16T14:43:00-07:00",
      },
      {
        id: CALL_IDS.important,
        owner_id: OWNER_ID,
        conversation_id: "seed-important-landlord",
        call_sid: "CA_seed_important_landlord",
        caller_number: "+12065551010",
        caller_name: "Dana Ruiz",
        claimed_target: "Alex Kim",
        target_match: true,
        status: "completed",
        classification: "legit_important",
        risk_score: 18,
        risk_reasons: [
          "Named Alex Kim",
          "Building maintenance, not a payment demand",
        ],
        caller_intent: "Schedule a kitchen-leak repair",
        action: "forwarded",
        summary:
          "Dana Ruiz from the building called about a kitchen leak. The name matched and the risk was low, so Sift bridged Alex into the call.",
        transcript: [
          {
            role: "agent",
            message:
              "Hi, this is an AI assistant for Alex Kim. This call may be recorded. Who are you trying to reach?",
          },
          {
            role: "user",
            message:
              "Dana Ruiz, the landlord. I need Alex Kim about a leak under the kitchen sink tomorrow.",
          },
        ],
        started_at: "2026-10-14T11:05:00-07:00",
        ended_at: "2026-10-14T11:12:00-07:00",
      },
      {
        id: CALL_IDS.routine,
        owner_id: OWNER_ID,
        conversation_id: "seed-routine-pharmacy",
        call_sid: "CA_seed_routine_pharmacy",
        caller_number: "+12065551020",
        caller_name: "Cascade Pharmacy",
        claimed_target: "Alex Kim",
        target_match: true,
        status: "completed",
        classification: "legit_routine",
        risk_score: 22,
        risk_reasons: ["Named Alex Kim", "Routine prescription notice"],
        caller_intent: "Prescription is ready for pickup",
        action: "message_taken",
        summary:
          "Cascade Pharmacy said Alex's prescription is ready for pickup today. Sift took the message instead of interrupting.",
        transcript: [
          {
            role: "agent",
            message:
              "Hi, this is an AI assistant for Alex Kim. This call may be recorded. Who are you trying to reach?",
          },
          {
            role: "user",
            message:
              "Cascade Pharmacy. Alex Kim's prescription is ready at the counter until 7.",
          },
        ],
        started_at: "2026-10-13T16:20:00-07:00",
        ended_at: "2026-10-13T16:22:00-07:00",
      },
    ],
    { onConflict: "id" },
  );
  assertOk(calls.error, "calls");

  const events = await supabase.from("calendar_events").upsert(
    [
      {
        id: "a1e00000-0000-4000-8000-000000000201",
        owner_id: OWNER_ID,
        title: "Dentist checkup",
        starts_at: "2026-10-19T09:00:00-07:00",
        ends_at: "2026-10-19T10:00:00-07:00",
        source: "manual",
        status: "planned",
      },
      {
        id: "a1e00000-0000-4000-8000-000000000202",
        owner_id: OWNER_ID,
        title: "Landlord: kitchen leak",
        starts_at: "2026-10-20T11:00:00-07:00",
        ends_at: "2026-10-20T11:30:00-07:00",
        source: "manual",
        status: "planned",
      },
      {
        id: "a1e00000-0000-4000-8000-000000000203",
        owner_id: OWNER_ID,
        title: "School conference",
        starts_at: "2026-10-21T14:00:00-07:00",
        ends_at: "2026-10-21T15:00:00-07:00",
        source: "manual",
        status: "planned",
      },
      {
        id: "a1e00000-0000-4000-8000-000000000204",
        owner_id: OWNER_ID,
        title: "Package delivery window",
        starts_at: "2026-10-22T16:00:00-07:00",
        ends_at: "2026-10-22T16:30:00-07:00",
        source: "manual",
        status: "planned",
      },
      {
        id: "a1e00000-0000-4000-8000-000000000205",
        owner_id: OWNER_ID,
        title: "Clinic follow-up",
        starts_at: "2026-10-23T10:00:00-07:00",
        ends_at: "2026-10-23T11:00:00-07:00",
        source: "manual",
        status: "planned",
      },
      {
        id: "a1e00000-0000-4000-8000-000000000206",
        owner_id: OWNER_ID,
        title: "Apartment walkthrough",
        starts_at: "2026-10-24T13:00:00-07:00",
        ends_at: "2026-10-24T14:00:00-07:00",
        source: "manual",
        status: "planned",
      },
    ],
    { onConflict: "id" },
  );
  assertOk(events.error, "calendar_events");

  const removed = await supabase
    .from("call_events")
    .delete()
    .in("call_id", Object.values(CALL_IDS));
  assertOk(removed.error, "call_events delete");

  const callEvents = await supabase.from("call_events").insert([
    {
      call_id: CALL_IDS.scamIrs,
      type: "risk",
      payload: { score: 92, reasons: ["IRS", "arrest threat", "gift cards"] },
    },
    {
      call_id: CALL_IDS.scamIrs,
      type: "action",
      payload: { action: "blocked" },
    },
    {
      call_id: CALL_IDS.scamWarranty,
      type: "risk",
      payload: { score: 81, reasons: ["warranty", "remote access"] },
    },
    {
      call_id: CALL_IDS.scamWarranty,
      type: "action",
      payload: { action: "blocked" },
    },
    {
      call_id: CALL_IDS.important,
      type: "risk",
      payload: { score: 18, reasons: ["name matched", "maintenance"] },
    },
    {
      call_id: CALL_IDS.important,
      type: "action",
      payload: { action: "forwarded" },
    },
    {
      call_id: CALL_IDS.routine,
      type: "risk",
      payload: { score: 22, reasons: ["prescription pickup"] },
    },
    {
      call_id: CALL_IDS.routine,
      type: "action",
      payload: { action: "message_taken" },
    },
  ]);
  assertOk(callEvents.error, "call_events insert");

  console.log("Seeded owner Alex Kim, contacts, calendar, and 4 calls.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
