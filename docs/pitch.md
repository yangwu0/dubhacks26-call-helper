# Sift pitch

## 60 seconds

People reported losing $3.5 billion to imposter scams in 2025. **VERIFY BEFORE USE** before you say that number on stage. The source to check is the Federal Trade Commission press release from June 15, 2026: https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025.

Sift answers your phone. It says it is an AI, and it says the call may be recorded. It asks who the caller wants and why, then scores the call from 0 to 100 while you watch.

A tax impersonator demanding gift cards crosses 75. Sift refuses, hangs up, and blocks the number. Your phone gets an iMessage in the moment: the score, the reason, and Block or Allow. You can reply `BLOCK` without ever picking up.

A clinic calling to move Thursday's checkup stays under 40. Sift rings you, whispers who it is, and bridges you in. When the call ends, the summary is waiting in the same iMessage thread. Noise goes in. Only the real calls come through.

## Devpost (3 sentences)

Sift is an AI receptionist that answers your phone, says it is an AI, and scores every caller for scam risk in real time. High-risk calls are refused and blocked, and a legitimate clinic, school, landlord, or delivery can be bridged to you after a short whisper. Summaries, live alerts, and replies such as `BLOCK` and `CALL` live in an iMessage thread through Photon, on the same number the voice agent uses.

## Judge questions

**Privacy and consent.** The first thing the caller hears is that this is an AI and that the call may be recorded. Sift does not give out the owner's address, full calendar, medical details, or finances. Availability is only free or busy. The owner sees the transcript and the summary in their own iMessage thread.

**False positives.** A forward only happens when the name matches and the score is under 40. Ordinary calls in our scripts, a clinic, a landlord, a school, a driver, and a recruiter, are written to stay under 40. At 75 or above the call is treated as a scam. The owner can tap Allow on the poll, or reply `UNBLOCK` if a number should come off the list.

**Latency.** The voice agent speaks as soon as the call connects. Risk updates are small tool calls, and the dashboard listens on Supabase Realtime. The post-call summary is written after hangup, so it does not sit on the live conversation. Anything slower than a couple of seconds is kicked off after the webhook returns.

**What if the AI is wrong?** Under 40 and a name match, Sift may ring the owner, and the owner can ignore it. The caller still gets a message taken if the bridge fails. At 75 or above, Sift will not pay, will not install anything, and will not hand over codes. The owner can `UNBLOCK` or tap Allow. The agent is not allowed to pretend it is human.

**Business model.** One number per person, sold as a subscription on top of the voice minutes and the iMessage thread. The wedge is people who already miss unknown calls: parents, clinicians, landlords, anyone who gets both real offices and impersonators. We did not build billing in the hackathon.

**Why ElevenLabs?** The caller needs a spoken agent that can use tools mid-call: check the name, report a risk score, and transfer when the call is real. ElevenLabs Agents does that on a phone call, including over a SIP trunk, and sends the transcript when the call ends.

**Why Photon?** The owner's interface is the iMessage thread, not another app. Spectrum sends the summary, the live Block / Allow poll, and takes `CALL`, `BLOCK`, and `REPORT` back. The same Photon line is the number people call. Voice arrives on that line and is handed to the ElevenLabs agent over SIP.

**What is next?** A tighter eval loop on the live rubric, then the stretch tools: forward a suspicious text or a photo of a bill to the same thread and get a plain-English verdict. After that, a real calendar instead of the weekday windows we book now.
