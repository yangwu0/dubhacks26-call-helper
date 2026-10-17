export interface MessagingProvider {
  send(to: string, body: string): Promise<void>;
}

// TODO(photon): WS3 implements this with spectrum-ts.
// Docs: https://photon.codes/docs/spectrum-ts/introduction
export class PhotonMessaging implements MessagingProvider {
  async send(to: string, body: string): Promise<void> {
    throw new Error(
      `TODO(photon): WS3 send via spectrum-ts to ${to} (${body.length} chars)`,
    );
  }
}

export function getMessagingProvider(): MessagingProvider {
  const provider = process.env.MESSAGING_PROVIDER ?? "photon";
  if (provider === "photon") return new PhotonMessaging();
  throw new Error(
    `Unknown MESSAGING_PROVIDER "${provider}". Sift uses photon only (Twilio SMS removed).`,
  );
}
