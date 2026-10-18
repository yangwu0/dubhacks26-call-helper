import { ownerSealPatch, type SealableOwner } from "../lib/account-crypto";
import { createServiceClient } from "../lib/supabase";

function status(value: string | null): string {
  if (!value) return "empty";
  return value.startsWith("enc:v1:") ? "sealed" : "plaintext";
}

async function main() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("owners")
    .select("id, name, aliases, phone, imessage_handle");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as SealableOwner[];
  let sealed = 0;
  for (const row of rows) {
    const patch = ownerSealPatch(row);
    if (!patch) continue;
    const updated = await supabase.from("owners").update(patch).eq("id", row.id);
    if (updated.error) throw new Error(updated.error.message);
    sealed += 1;
  }

  const check = await supabase
    .from("owners")
    .select("id, name, aliases, phone, imessage_handle");
  if (check.error) throw new Error(check.error.message);
  const after = (check.data ?? []) as SealableOwner[];
  console.log(`sealed ${sealed} of ${rows.length} accounts`);
  for (const row of after) {
    const aliases = row.aliases ?? [];
    const aliasState =
      aliases.length === 0
        ? "empty"
        : aliases.every((alias) => alias.startsWith("enc:v1:"))
          ? "sealed"
          : "plaintext";
    console.log(
      `${row.id} name=${status(row.name)} phone=${status(row.phone)} imessage=${status(row.imessage_handle)} aliases=${aliasState}`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "seal failed";
  console.error(message);
  process.exit(1);
});
