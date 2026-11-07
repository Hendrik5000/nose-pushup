import { createServerFn } from "@tanstack/react-start";
import { parseSanitizedErrorReport } from "./error-report-payload";

export const sendSanitizedErrorReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => parseSanitizedErrorReport(input))
  .handler(async ({ data }) => {
    const { forwardSanitizedErrorReport } = await import("./error-reporting.server");
    await forwardSanitizedErrorReport(data);
    // Do not reveal whether a private runtime secret is configured or whether
    // the downstream webhook accepted the request.
    return { accepted: true as const };
  });
