package app.alo.miraagent

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewayRetryPolicyTest {
    @Test
    fun unauthorizedResponseIsAuthenticationFailureAndIsNotRetried() {
        assertTrue(GatewayRetryPolicy.isAuthenticationFailure(401))
        assertFalse(GatewayRetryPolicy.shouldRetry(401))
    }

    @Test
    fun forbiddenResponseIsAuthenticationFailureAndIsNotRetried() {
        assertTrue(GatewayRetryPolicy.isAuthenticationFailure(403))
        assertFalse(GatewayRetryPolicy.shouldRetry(403))
    }

    @Test
    fun missingResponseIsTreatedAsTransientTransportFailure() {
        assertFalse(GatewayRetryPolicy.isAuthenticationFailure(null))
        assertTrue(GatewayRetryPolicy.shouldRetry(null))
    }

    @Test
    fun timeoutRateLimitAndServerResponsesAreRetried() {
        listOf(408, 429, 500, 503, 599).forEach { statusCode ->
            assertTrue("HTTP $statusCode should be retried", GatewayRetryPolicy.shouldRetry(statusCode))
        }
    }

    @Test
    fun otherHttpResponsesArePermanentAndNotRetried() {
        listOf(400, 404, 422).forEach { statusCode ->
            assertFalse("HTTP $statusCode must not be retried", GatewayRetryPolicy.shouldRetry(statusCode))
        }
    }
}
