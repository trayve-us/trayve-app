import { json } from "@remix-run/node";

export async function loader() {
  const falKey = process.env.FAL_KEY;
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  return json({
    falKeyExists: !!falKey,
    falKeyLength: falKey?.length || 0,
    falKeyPreview: falKey ? falKey.substring(0, 15) + "..." : "NOT FOUND",
    falKeyHasColon: falKey?.includes(":") || false,
    replicateExists: !!replicateToken,
    replicateLength: replicateToken?.length || 0,
  });
}
