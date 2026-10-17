# ElevenLabs agent setup

`SIFT_PROMPTS.md` is not in this repo, so this prompt follows the routing rules in `AGENTS.md` and the tool schemas in `lib/contracts.ts`. Paste Part D over the system prompt below if you have that file.

Replace `https://YOUR_APP` with the public app URL (`NEXT_PUBLIC_APP_URL`). Store `SIFT_WEBHOOK_SECRET` as an ElevenLabs secret and send it on every tool and on the conversation-initiation webhook.

## First message

```text
Hi, this is an AI assistant for {{owner_name}}. This call may be recorded. Who are you trying to reach?
```

## System prompt

```text
You are Sift, the AI phone assistant for {{owner_name}}. You are not a person. Never claim to be human, never invent a human identity, and never pretend the owner is already on the line.

The caller is {{caller_number}}. Known contact: {{is_known_contact}}. Blocked number: {{is_blocked}}. Call SID: {{call_sid}}.

Rules you cannot break:
- Say you are an AI and that the call may be recorded before you collect information. The first message already does this. Repeat it if asked.
- Never share the owner's address, full schedule, finances, medical details, or other private facts. When talking about time, only say free or busy windows returned by check_availability.
- Every tool body must include conversation_id. It is filled from the system variable. Do not ask the caller for it.
- Keep each reply to one or two short sentences.

If is_blocked is true, stay calm, refuse every request, and end the call with the end-call tool.

Otherwise follow this order:
1. Ask who they are trying to reach and why they are calling.
2. Call verify_caller_target with the name they claim. If match is false, do not forward the call. You may still take a message.
3. After each meaningful thing the caller says, call report_risk with an integer score from 0 to 100, short reasons, caller_intent, and caller_name once you know it. Raise the score for government impersonation, arrest threats, gift cards, cryptocurrency, wire or payment demands, remote-access software, refusal to name a person, pressure to act immediately, or a name that does not match. Lower the score by 20 or more only when you have a concrete reason, and put that reason in reasons.
4. Obey recommended_action:
   - end_as_scam: stay calm. Ask one to three short questions so the owner has a record. Agree to nothing. Do not transfer, pay, or install anything. Then end the call.
   - may_forward: only for a real scheduling, medical, school, landlord, or delivery matter, and only after verify_caller_target returned match true. Call forward_call with the reason and urgency. If it returns ok true and a transfer_number, immediately call the transfer_to_number tool with that number, client_message "Connecting you now.", and do not read the phone number aloud. If forward_call returns ok false, or the transfer does not connect, take a message instead.
   - continue: if they want to schedule something, call check_availability, offer two of the returned free windows, and call book_event only after they accept one. For anything routine, call take_message.

Do not call forward_call unless the latest report_risk response is may_forward. Do not invent free times. If book_event returns ok false, that slot is taken or outside weekday hours from 9am to 6pm, so offer another returned window.
```

## Dynamic variables

Define these on the agent. The conversation-initiation webhook returns all of them. Placeholders are only for dashboard tests.

| Variable | Type | Test placeholder |
| --- | --- | --- |
| `owner_name` | string | Alex Kim |
| `caller_number` | string | +12065551001 |
| `is_blocked` | boolean | false |
| `is_known_contact` | boolean | false |
| `call_sid` | string | CA_test |

Do not create custom variables with the `system__` prefix. Pass `system__conversation_id` into every tool as `conversation_id` (value type: Dynamic variable).

## Phone number

Use a Photon number, not Twilio. In the Photon Voice profile, point inbound calls at `sips:sip.rtc.elevenlabs.io:5061` with TLS. Import that number into ElevenLabs with From SIP Trunk, using the Photon outbound SIP username, password, and address (for example `sip.photon.codes:5061`, transport TLS). Assign this agent to the imported number.

Stable Spectrum docs say `spectrum-ts` cannot place or join calls yet. ElevenLabs is the SIP application.

## Conversation initiation webhook

The same webhook runs for inbound SIP trunk calls. Enable "Fetch initiation client data from a webhook" on the agent Security tab.

- Method: POST
- URL: `https://YOUR_APP/api/elevenlabs/init`
- Header: `x-sift-secret: <SIFT_WEBHOOK_SECRET>`
- Body ElevenLabs sends: `caller_id`, `agent_id`, `called_number`, `conversation_id`, and `call_sid` or `call_id` when the provider includes one
- Response: `type: conversation_initiation_client_data` and `dynamic_variables` for the five variables above

## Post-call webhook

ElevenLabs docs: post-call webhooks. Enable the transcription webhook.

- Method: POST
- URL: `https://YOUR_APP/api/elevenlabs/post-call`
- Authentication: ElevenLabs HMAC. The route verifies the `elevenlabs-signature` header with `ELEVENLABS_WEBHOOK_SECRET` using `elevenlabs.webhooks.constructEvent`.
- If the webhook settings let you add a header, also send `x-sift-secret`. A wrong value is rejected. A missing value is allowed because the signature is the documented authentication.

The route returns 200 before it summarizes the call.

## Tools

All six tools are webhook tools. Method POST. Content type JSON. Header on every tool:

`x-sift-secret: <SIFT_WEBHOOK_SECRET>`

`conversation_id` on every tool is a dynamic variable bound to `system__conversation_id`. Every other body field is an LLM prompt.

### verify_caller_target

URL: `https://YOUR_APP/api/tools/verify_caller_target`

Description: Check whether the name the caller asked for is the owner. Call this once you hear who they are trying to reach.

| Identifier | Type | Description |
| --- | --- | --- |
| conversation_id | string | ElevenLabs conversation id. Dynamic variable `system__conversation_id`. |
| claimed_target | string | The person the caller says they are trying to reach, in their words. |

Response: `{ "match": boolean, "confidence": number }`. `confidence` is from 0 to 1.

### report_risk

URL: `https://YOUR_APP/api/tools/report_risk`

Description: Record the current scam risk after something new is said. Call it throughout the conversation, not only once.

| Identifier | Type | Description |
| --- | --- | --- |
| conversation_id | string | ElevenLabs conversation id. Dynamic variable `system__conversation_id`. |
| score | number | Integer risk from 0 to 100. 75 or higher is a scam. |
| reasons | array of strings | Short reasons for this score. Required when you lower the score by 20 or more. |
| caller_intent | string | What the caller wants, in one sentence. |
| caller_name | string | The caller's own name, if they gave one. Optional. |

Response: `{ "ok": true, "recommended_action": "continue" \| "end_as_scam" \| "may_forward" }`.

The server keeps the score from falling unless the new score is at least 20 points lower and `reasons` is not empty. A blocked caller number forces the score to 100 and `end_as_scam`.

### forward_call

URL: `https://YOUR_APP/api/tools/forward_call`

Description: Ring the owner and join them to this call. Use only when recommended_action is may_forward and the caller is scheduling, medical, school, landlord, or delivery.

| Identifier | Type | Description |
| --- | --- | --- |
| conversation_id | string | ElevenLabs conversation id. Dynamic variable `system__conversation_id`. |
| reason | string | Why the owner is being connected, in a few words the owner can hear. |
| urgency | string | How time-sensitive this is, such as today or this week. |

Response: `{ "ok": boolean, "message": string, "transfer_number"?: string }`. Say `message` to the caller. When `transfer_number` is present, call `transfer_to_number` with that exact number. Do not speak the number. `ok: false` means the server refused. Take a message instead.

The server refuses unless `target_match` is true and `risk_score` is under 40. The handoff is an ElevenLabs conference transfer over the Photon SIP trunk. SIP transfers do not play a separate whisper to the owner.

### check_availability

URL: `https://YOUR_APP/api/tools/check_availability`

Description: List free windows on weekdays from 9am to 6pm in the owner's timezone. Windows are aligned to 30 minutes. Never describe the busy events.

| Identifier | Type | Description |
| --- | --- | --- |
| conversation_id | string | ElevenLabs conversation id. Dynamic variable `system__conversation_id`. |
| date_from | string | First day to check, YYYY-MM-DD in the owner's timezone, or an ISO-8601 timestamp. |
| date_to | string | Last day to check, same format. Inclusive. At most 14 days are returned. |

Response: `{ "free_slots": [{ "start": string, "end": string }] }`. Times include the owner's UTC offset.

### book_event

URL: `https://YOUR_APP/api/tools/book_event`

Description: Book one free window the caller accepted. Use a start and end from check_availability.

| Identifier | Type | Description |
| --- | --- | --- |
| conversation_id | string | ElevenLabs conversation id. Dynamic variable `system__conversation_id`. |
| title | string | Short event title, such as "Landlord: kitchen leak". |
| starts_at | string | ISO-8601 start, copied from a free window. |
| ends_at | string | ISO-8601 end, copied from that same window. |
| caller_name | string | Name of the person the appointment is with. |

Response: `{ "ok": boolean, "event_id": string }`. `ok: false` and an empty `event_id` means the slot is outside weekday 9am to 6pm or it overlaps something already booked.

### take_message

URL: `https://YOUR_APP/api/tools/take_message`

Description: Save a message and text the owner. Use this for routine calls and whenever a transfer is refused or the owner does not need to be interrupted.

| Identifier | Type | Description |
| --- | --- | --- |
| conversation_id | string | ElevenLabs conversation id. Dynamic variable `system__conversation_id`. |
| caller_name | string | The caller's name. |
| callback_number | string | Number where the owner can call them back. |
| message | string | The message, in one or two sentences. |

Response: `{ "ok": true }`.

## System tools

Enable End call. Use it after `end_as_scam`, after a message is taken, and after a booking is confirmed.

Enable Transfer to number. Add one conference-transfer rule whose phone number is the owner's E.164 phone. Condition: "forward_call returned ok true". The agent must pass `transfer_number` from that tool response. `client_message` is "Connecting you now."
