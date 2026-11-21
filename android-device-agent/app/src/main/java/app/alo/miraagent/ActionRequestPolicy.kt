package app.alo.miraagent

internal sealed class ActionRequestDecision {
    data class ReadOnly(val requestId: String, val toolId: String) : ActionRequestDecision()
    data class Rejected(val status: String, val detail: String) : ActionRequestDecision()
}

/**
 * Local allowlist mirror for Android. Only explicitly implemented, read-only
 * status requests may run. All state-changing tools remain disabled.
 */
internal object ActionRequestPolicy {
    fun validate(
        requestId: String?,
        toolId: String?,
        argsAreObject: Boolean,
        argumentKeys: Set<String>,
        confirmationGranted: Boolean,
    ): ActionRequestDecision {
        if (requestId.isNullOrBlank() || requestId.length > 64) {
            return ActionRequestDecision.Rejected("error", "Ungültige Request-ID.")
        }
        if (toolId.isNullOrBlank() || toolId.length > 64) {
            return ActionRequestDecision.Rejected("error", "Ungültiger Aktionstyp.")
        }
        if (!argsAreObject) {
            return ActionRequestDecision.Rejected("error", "Ungültige Aktionsargumente.")
        }

        if (toolId == "einstellungen.herunterfahren" && !confirmationGranted) {
            return ActionRequestDecision.Rejected(
                "bestaetigung-erforderlich",
                "Diese kritische Aktion benötigt eine ausdrückliche Bestätigung in Mira.",
            )
        }

        if (toolId == "status.ping" || toolId == "status.info") {
            if (argumentKeys.isNotEmpty() || confirmationGranted) {
                return ActionRequestDecision.Rejected(
                    "error",
                    "Read-only-Statusabfragen akzeptieren keine Argumente oder Aktionsbestätigung.",
                )
            }
            return ActionRequestDecision.ReadOnly(requestId, toolId)
        }

        return ActionRequestDecision.Rejected(
            "nicht-implementiert",
            "Diese Android-Aktion ist noch nicht freigegeben.",
        )
    }
}
