import { verifySecret } from "@/lib/auth";
import { scanContent, type ScanImageType } from "@/lib/anthropic";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function POST(req: Request) {
  if (!verifySecret(req)) return json({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "invalid body" }, 400);
  const record = body as {
    text?: unknown;
    image_url?: unknown;
    image_base64?: unknown;
    media_type?: unknown;
  };
  const text = typeof record.text === "string" ? record.text : undefined;
  const imageUrl = typeof record.image_url === "string" ? record.image_url : undefined;
  const imageBase64 =
    typeof record.image_base64 === "string" ? record.image_base64 : undefined;
  const mediaType = IMAGE_TYPES.find((type) => type === record.media_type);

  if (!text?.trim() && !imageUrl?.trim() && !imageBase64?.trim()) {
    return json({ error: "text or image_url is required" }, 400);
  }

  try {
    const result = await scanContent({
      text,
      imageUrl,
      imageBase64,
      mediaType: mediaType as ScanImageType | undefined,
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "scan failed";
    console.error("scan", message);
    return json({ error: message }, 500);
  }
}
