package app.alo.miraagent

/** Classifies HTTP failures from the gateway's WebSocket upgrade request. */
internal object GatewayRetryPolicy {
    fun isAuthenticationFailure(statusCode: Int?): Boolean =
        statusCode == 401 || statusCode == 403

    /**
     * A missing response indicates a transport failure. Only explicitly transient
     * HTTP responses are retried; all other HTTP statuses need user intervention.
     */
    fun shouldRetry(statusCode: Int?): Boolean = when {
        statusCode == null -> true
        statusCode == 408 || statusCode == 429 -> true
        statusCode != null && statusCode in 500..599 -> true
        else -> false
    }
}
