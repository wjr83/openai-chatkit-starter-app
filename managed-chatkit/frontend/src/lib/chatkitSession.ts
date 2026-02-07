const readEnvString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const workflowId = (() => {
  const id = readEnvString(import.meta.env.VITE_CHATKIT_WORKFLOW_ID);
  if (!id || id.startsWith("wf_replace")) {
    throw new Error("Set VITE_CHATKIT_WORKFLOW_ID in your .env file.");
  }
  return id;
})();

export const workflowVersion = readEnvString(
  import.meta.env.VITE_CHATKIT_WORKFLOW_VERSION
);

export const domainKey =
  readEnvString(import.meta.env.VITE_CHATKIT_API_DOMAIN_KEY) ??
  "domain_pk_localhost_dev";

export function createClientSecretFetcher(
  workflow: string,
  version?: string,
  endpoint = "/api/create-session"
) {
  return async (currentSecret: string | null) => {
    if (currentSecret) return currentSecret;

    const workflowPayload: Record<string, string> = { id: workflow };
    if (version) {
      workflowPayload.version = version;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: workflowPayload }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      client_secret?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to create session");
    }

    if (!payload.client_secret) {
      throw new Error("Missing client secret in response");
    }

    return payload.client_secret;
  };
}
