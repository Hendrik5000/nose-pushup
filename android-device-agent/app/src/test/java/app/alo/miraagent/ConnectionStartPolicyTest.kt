package app.alo.miraagent

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConnectionStartPolicyTest {
    @Test
    fun idleServiceCanStartAConnection() {
        assertFalse(
            ConnectionStartPolicy.shouldIgnoreStart(
                stopped = false,
                hasSocket = false,
                reconnectPending = false,
            ),
        )
    }

    @Test
    fun activeSocketSuppressesDuplicateServiceStart() {
        assertTrue(
            ConnectionStartPolicy.shouldIgnoreStart(
                stopped = false,
                hasSocket = true,
                reconnectPending = false,
            ),
        )
    }

    @Test
    fun pendingReconnectSuppressesDuplicateServiceStart() {
        assertTrue(
            ConnectionStartPolicy.shouldIgnoreStart(
                stopped = false,
                hasSocket = false,
                reconnectPending = true,
            ),
        )
    }

    @Test
    fun stoppedServiceCanBeStartedAgain() {
        assertFalse(
            ConnectionStartPolicy.shouldIgnoreStart(
                stopped = true,
                hasSocket = false,
                reconnectPending = false,
            ),
        )
    }
}
