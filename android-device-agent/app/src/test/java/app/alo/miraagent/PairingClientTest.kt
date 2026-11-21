package app.alo.miraagent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PairingClientTest {
    @Test
    fun acceptsHttpsOriginAndNormalizesSingleTrailingSlash() {
        assertEquals(
            "https://gateway.example",
            PairingClient.validateGatewayUrl("  https://gateway.example/  "),
        )
    }

    @Test
    fun acceptsHttpsOriginWithPort() {
        assertEquals(
            "https://gateway.example:9443",
            PairingClient.validateGatewayUrl("https://gateway.example:9443"),
        )
    }

    @Test
    fun rejectsPlainHttp() {
        assertThrows(IllegalArgumentException::class.java) {
            PairingClient.validateGatewayUrl("http://gateway.example")
        }
    }

    @Test
    fun rejectsPath() {
        assertThrows(IllegalArgumentException::class.java) {
            PairingClient.validateGatewayUrl("https://gateway.example/api")
        }
    }

    @Test
    fun rejectsRepeatedTrailingSlashes() {
        assertThrows(IllegalArgumentException::class.java) {
            PairingClient.validateGatewayUrl("https://gateway.example///")
        }
    }

    @Test
    fun rejectsCredentials() {
        assertThrows(IllegalArgumentException::class.java) {
            PairingClient.validateGatewayUrl("https://user:secret@gateway.example")
        }
    }

    @Test
    fun rejectsQueryAndFragment() {
        assertThrows(IllegalArgumentException::class.java) {
            PairingClient.validateGatewayUrl("https://gateway.example?token=secret")
        }
        assertThrows(IllegalArgumentException::class.java) {
            PairingClient.validateGatewayUrl("https://gateway.example#section")
        }
    }
}
