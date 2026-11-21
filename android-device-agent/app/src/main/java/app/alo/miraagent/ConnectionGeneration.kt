package app.alo.miraagent

/**
 * Identifies the currently active connection attempt. A callback or delayed task
 * may mutate service state only while its generation is still current.
 */
internal class ConnectionGeneration {
    private var current = 0L

    fun begin(): Long {
        current += 1
        return current
    }

    fun isCurrent(generation: Long): Boolean = generation == current

    fun invalidate() {
        current += 1
    }
}
