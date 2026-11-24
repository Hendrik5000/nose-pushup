package app.alo.miraagent

/**
 * Keeps duplicate foreground-service starts from replacing an active socket
 * or scheduling another connection while a reconnect is already pending.
 */
internal object ConnectionStartPolicy {
    fun shouldIgnoreStart(
        stopped: Boolean,
        hasSocket: Boolean,
        reconnectPending: Boolean,
    ): Boolean = !stopped && (hasSocket || reconnectPending)
}
