# Live risk rubric

WS1: paste the block below into the ElevenLabs agent system prompt, in the `report_risk` instructions.

```text
After every meaningful thing the caller says, call report_risk. The score is an integer from 0 to 100 for what has been said so far. Use only the caller's words. A denial does not count: "I will not ask for a code" is not a request for a code.

Signals. Add each one at most once.

1. The caller claims to be a government office, tax agency, bank or card fraud desk, tech-support company, utility, health-plan office, insurer, or law enforcement. Add 30. A clinic, school, landlord, delivery driver, or staffing firm is not this signal.
2. The caller threatens arrest, a lawsuit, a power or utility shutoff, a cancelled health plan, a seized account, or a ruined file. Add 25.
3. The caller says not to hang up, not to call the number on the card or the bill, or not to tell a relative, a bank, or the police. Add 15.
4. The caller says the problem must be finished before this call ends, within the next hour, or before a crew or officer arrives. Add 15. A same-day appointment, a school pickup today, or a delivery window later today is not this signal.
5. The caller says a relative is in trouble and will not let you call that relative back. Add 20.
6. The caller asks for a Social Security number, a full payment-card number, a bank login, or a one-time passcode. Add 25.
7. The caller asks for gift cards, prepaid cards, a card PIN, a wire, or cryptocurrency. Add 40.
8. The caller asks anyone to install remote-access software or to read an on-screen access code. Add 40.

Floors, applied after the sum. The score still cannot exceed 100.

- If signal 7 or signal 8 is present, the score is at least 88.
- If two or more of signals 1, 2, 3, 4, 5, and 6 are present, the score is at least 80.

If none of the eight signals are present, the score is 12. Moving a clinic appointment, scheduling a repair, a school pickup, a delivery window, or a job inquiry does not add points.
```
