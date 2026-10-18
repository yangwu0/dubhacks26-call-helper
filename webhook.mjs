// ElevenLabs "conversation initiation" webhook.
// ElevenLabs POSTs { caller_id, agent_id, called_number, call_sid } when a SIP call arrives,
// and uses the dynamic variables you return to start the conversation.
//
// Run:  node --env-file=.env webhook.mjs
// Env:  FORWARD_NUMBER   number contacts get transferred to (E.164, e.g. +1206...)
//       USER_NAME        the name callers must say (your {{user_name}} variable)
//       WEBHOOK_SECRET   optional shared secret, sent by ElevenLabs as a header (see below)
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const contacts = JSON.parse(readFileSync("contacts.json", "utf8")); // { "+1...": "Name" }
const { FORWARD_NUMBER, USER_NAME = "the owner", WEBHOOK_SECRET, PORT = 3000 } = process.env;

// Keep digits and a leading +, so "(360) 445-1823" and "+13604451823" compare equal for US numbers.
const norm = (n = "") => {
  const d = n.replace(/[^\d+]/g, "");
  return d.startsWith("+") ? d : d.length === 10 ? `+1${d}` : `+${d}`;
};

createServer((req, res) => {
  const send = (body, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method !== "POST" || req.url !== "/init") return send({ error: "not found" }, 404);
  // Header name must match what you configure in ElevenLabs (x-webhook-secret here).
  if (WEBHOOK_SECRET && req.headers["x-webhook-secret"] !== WEBHOOK_SECRET) return send({ error: "unauthorized" }, 401);

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    // A failing or slow webhook can stop the conversation from starting,
    // so ALWAYS return valid JSON with every variable set.
    let vars = {
      user_name: USER_NAME,
      dest_phone_number: FORWARD_NUMBER ?? "",
      is_contact: "false",
      caller_name: "",
      greeting: "Hello! Who is this call for, please?",
    };
    try {
      const { caller_id } = JSON.parse(raw);
      const name = contacts[norm(caller_id)];
      console.log(new Date().toISOString(), "incoming", caller_id, name ? `(contact: ${name})` : "(unknown)");
      if (name) {
        vars = { ...vars, is_contact: "true", caller_name: name, greeting: `Hi ${name}, connecting you now.` };
      }
    } catch (e) {
      console.error("bad request body:", e.message);
    }
    send({ type: "conversation_initiation_client_data", dynamic_variables: vars });
  });
}).listen(PORT, () => console.log(`Webhook listening on :${PORT}/init`));
