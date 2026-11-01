import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RunwareCapability, RunwareResult, RunwareStatus } from "./runware";

const statusInput = (input: unknown) => {
  if (
    input !== undefined &&
    (!input || typeof input !== "object" || Object.keys(input).length !== 0)
  )
    throw new Error("Ungültige Statusanfrage.");
  return {};
};

export const getRunwareStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(statusInput)
  .handler(async ({ context }): Promise<RunwareStatus> => {
    const { getServerRunwareStatus } = await import("./runware.server");
    return getServerRunwareStatus(context.userId);
  });

export type RunMiraRunwareInput = {
  capability: RunwareCapability;
  model: string;
  prompt: string;
  inputImage?: string;
  confirmed: true;
  requestId: string;
};

function validateRunInput(input: unknown): RunMiraRunwareInput {
  if (!input || typeof input !== "object") throw new Error("Ungültige Runware-Anfrage.");
  const value = input as Partial<RunMiraRunwareInput>;
  if (
    typeof value.capability !== "string" ||
    typeof value.model !== "string" ||
    typeof value.prompt !== "string" ||
    value.confirmed !== true ||
    typeof value.requestId !== "string"
  )
    throw new Error("Ungültige Runware-Anfrage.");
  return value as RunMiraRunwareInput;
}

export const runMiraRunware = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRunInput)
  .handler(async ({ data, context }): Promise<RunwareResult> => {
    const { executeRunwareForUser } = await import("./runware.server");
    return executeRunwareForUser(context.userId, data);
  });

export const streamMiraRunware = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRunInput)
  .handler(async ({ data, context }): Promise<Response> => {
    const { streamRunwareForUser } = await import("./runware.server");
    return streamRunwareForUser(context.userId, data);
  });
