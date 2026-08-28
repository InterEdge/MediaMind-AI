import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = supabase.storage.from("documents");

const { data: documents, error: documentsError } = await supabase
  .from("documents")
  .select("id, workspace_id, file_path, title")
  .order("uploaded_at", { ascending: true });
if (documentsError) throw documentsError;

let migrated = 0;
let alreadyScoped = 0;
let withoutFile = 0;

for (const document of documents ?? []) {
  if (!document.workspace_id) throw new Error(`Document ${document.id} has no workspace_id.`);
  if (!document.file_path) {
    withoutFile++;
    continue;
  }

  const prefix = `${document.workspace_id}/`;
  if (document.file_path.startsWith(prefix)) {
    const { error: verifyError } = await bucket.download(document.file_path);
    if (verifyError) throw new Error(`Missing scoped object for document ${document.id}: ${verifyError.message}`);
    alreadyScoped++;
    continue;
  }

  const extension = (document.file_path.split(".").pop() || document.title?.split(".").pop() || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "bin";
  const destination = `${document.workspace_id}/${randomUUID()}.${extension}`;

  const { error: copyError } = await bucket.copy(document.file_path, destination);
  if (copyError) throw new Error(`Copy failed for document ${document.id}: ${copyError.message}`);

  const { error: verifyError } = await bucket.download(destination);
  if (verifyError) throw new Error(`Verification failed for document ${document.id}: ${verifyError.message}`);

  const { error: updateError } = await supabase
    .from("documents")
    .update({ file_path: destination })
    .eq("id", document.id)
    .eq("workspace_id", document.workspace_id);
  if (updateError) throw new Error(`Metadata update failed for document ${document.id}: ${updateError.message}`);

  migrated++;
}

const { data: finalDocuments, error: finalError } = await supabase
  .from("documents")
  .select("id, workspace_id, file_path");
if (finalError) throw finalError;

const invalid = (finalDocuments ?? []).filter(
  (document) => document.file_path && !document.file_path.startsWith(`${document.workspace_id}/`),
);
if (invalid.length > 0) throw new Error(`Storage migration incomplete for ${invalid.length} document(s).`);

console.log(JSON.stringify({ migrated, alreadyScoped, withoutFile, legacyObjectsDeleted: 0 }, null, 2));
console.log("Legacy source objects were intentionally retained. Delete them only after independent verification and backup.");

