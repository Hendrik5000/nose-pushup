package app.alo.miraagent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ActionRequestPolicyTest {
    @Test
    fun allowsOnlyExplicitReadOnlyPing() {
        val result = ActionRequestPolicy.validate("request-1", "status.ping", true, emptySet(), false)

        assertTrue(result is ActionRequestDecision.ReadOnly)
        assertEquals("status.ping", (result as ActionRequestDecision.ReadOnly).toolId)
    }

    @Test
    fun allowsReadOnlyDeviceInfoWithoutArguments() {
        val result = ActionRequestPolicy.validate("request-2", "status.info", true, emptySet(), false)

        assertTrue(result is ActionRequestDecision.ReadOnly)
        assertEquals("status.info", (result as ActionRequestDecision.ReadOnly).toolId)
    }

    @Test
    fun rejectsMissingOrOversizedRequestIds() {
        assertEquals(
            "error",
            (ActionRequestPolicy.validate(null, "status.ping", true, emptySet(), false) as ActionRequestDecision.Rejected).status,
        )
        assertEquals(
            "error",
            (ActionRequestPolicy.validate("x".repeat(65), "status.ping", true, emptySet(), false) as ActionRequestDecision.Rejected).status,
        )
    }

    @Test
    fun rejectsMalformedArgumentsAndUnexpectedKeys() {
        val malformed = ActionRequestPolicy.validate("request-3", "status.ping", false, emptySet(), false)
        val unexpected = ActionRequestPolicy.validate("request-4", "status.ping", true, setOf("command"), false)

        assertEquals("error", (malformed as ActionRequestDecision.Rejected).status)
        assertEquals("error", (unexpected as ActionRequestDecision.Rejected).status)
    }

    @Test
    fun rejectsUnknownAndStateChangingTools() {
        val unknown = ActionRequestPolicy.validate("request-5", "shell.execute", true, emptySet(), true)
        val mutating = ActionRequestPolicy.validate("request-6", "programme.starten", true, emptySet(), false)

        assertEquals("nicht-implementiert", (unknown as ActionRequestDecision.Rejected).status)
        assertEquals("nicht-implementiert", (mutating as ActionRequestDecision.Rejected).status)
    }

    @Test
    fun criticalActionWithoutConfirmationIsRejectedExplicitly() {
        val result = ActionRequestPolicy.validate(
            "request-7",
            "einstellungen.herunterfahren",
            true,
            emptySet(),
            false,
        )

        assertEquals("bestaetigung-erforderlich", (result as ActionRequestDecision.Rejected).status)
    }

    @Test
    fun confirmationDoesNotEnableUnimplementedCriticalAction() {
        val result = ActionRequestPolicy.validate(
            "request-8",
            "einstellungen.herunterfahren",
            true,
            emptySet(),
            true,
        )

        assertEquals("nicht-implementiert", (result as ActionRequestDecision.Rejected).status)
    }

    @Test
    fun readOnlyToolsRejectArgumentsAndConfirmationFlags() {
        val result = ActionRequestPolicy.validate("request-9", "status.info", true, emptySet(), true)

        assertEquals("error", (result as ActionRequestDecision.Rejected).status)
    }
}
