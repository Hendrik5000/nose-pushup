package app.alo.miraagent

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConnectionGenerationTest {
    @Test
    fun newerConnectionInvalidatesCallbacksFromPreviousSocket() {
        val generations = ConnectionGeneration()
        val previous = generations.begin()
        val current = generations.begin()

        assertFalse(generations.isCurrent(previous))
        assertTrue(generations.isCurrent(current))
    }

    @Test
    fun stopInvalidatesPendingCallbacks() {
        val generations = ConnectionGeneration()
        val active = generations.begin()

        generations.invalidate()

        assertFalse(generations.isCurrent(active))
    }

    @Test
    fun generationRemainsCurrentUntilReplacedOrStopped() {
        val generations = ConnectionGeneration()
        val active = generations.begin()

        assertTrue(generations.isCurrent(active))
        assertTrue(generations.isCurrent(active))
    }
}
