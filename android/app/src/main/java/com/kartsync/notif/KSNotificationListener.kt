package com.kartsync.notif

import android.app.Notification
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.security.MessageDigest

class KSNotificationListener : NotificationListenerService() {

  private val client by lazy {
    OkHttpClient.Builder()
      .connectTimeout(8, TimeUnit.SECONDS)
      .readTimeout(8, TimeUnit.SECONDS)
      .build()
  }

  private fun getPref(key: String): String? =
    getSharedPreferences("ks_prefs", MODE_PRIVATE).getString(key, null)

  private fun hmacSha256Hex(secret: String, data: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
    val bytes = mac.doFinal(data.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
  }

  private fun sha256(s: String): String {
    val md = MessageDigest.getInstance("SHA-256")
    val b = md.digest(s.toByteArray(Charsets.UTF_8))
    return b.joinToString("") { "%02x".format(it) }
  }

  private fun isSummaryOrSystemNoise(body: String, extras: Bundle, category: String?): Boolean {
    val b = body.trim().lowercase()

    // Common WhatsApp summary/system lines
    if (b.matches(Regex("""^\d+\s+new\s+message(s)?$"""))) return true
    if (b.contains("new messages")) return true
    if (b == "whatsapp web is active" || b == "whatsapp web") return true

    // Non-message categories (calls/status/etc.)
    if (category != null && category != Notification.CATEGORY_MESSAGE) return true

    // Group summaries or system recaps
    val isGroup = extras.getBoolean("android.isGroupConversation", false)
    val hasSummary = extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT) != null
    if (isGroup || hasSummary) return true

    // Multiple text lines => usually recap (not a single new message)
    if (extras.containsKey("android.textLines")) {
      val lines = extras.getCharSequenceArray("android.textLines")
      if (lines != null && lines.size > 1) return true
    }

    return false
  }

  // simple debounce to avoid OEM double-posts
  private var lastHash: String? = null
  private var lastSentAt: Long = 0L

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return

    val pkg = sbn.packageName ?: return
    if (pkg != "com.whatsapp" && pkg != "com.whatsapp.w4b") return

    val n = sbn.notification ?: return
    val extras = n.extras ?: return

    val title = (extras.getCharSequence("android.title") ?: "").toString()
    val text  = (extras.getCharSequence("android.text") ?: "").toString()
    val big   = (extras.getCharSequence("android.bigText") ?: "").toString()
    val body  = if (big.isNotBlank()) big else text
    if (body.isBlank()) return

    if (isSummaryOrSystemNoise(body, extras, n.category)) return

    val orgPhone   = getPref("org_phone") ?: return
    val ingestBase = getPref("ingest_url") ?: return
    val secret     = getPref("hmac_secret") ?: return

    // Stable idempotency key using postTime + content
    val ts = sbn.postTime
    val idemSeed = "$orgPhone|$title|$body|$ts"
    val idem = sha256(idemSeed)

    val now = System.currentTimeMillis()
    if (lastHash == idem && (now - lastSentAt) < 3000L) return
    lastHash = idem
    lastSentAt = now

    val payload = JSONObject().apply {
      put("org_phone", orgPhone)
      put("from", title)
      put("text", body)
      put("ts", ts)
      put("idempotency_key", idem)
    }.toString()

    val sig = hmacSha256Hex(secret, payload)
    val req = Request.Builder()
      .url("$ingestBase/api/ingest/local")
      .post(RequestBody.create("application/json".toMediaTypeOrNull(), payload))
      .header("X-Signature", sig)
      .build()

    client.newCall(req).enqueue(object : Callback {
      override fun onFailure(call: Call, e: java.io.IOException) { /* no-op */ }
      override fun onResponse(call: Call, response: Response) { response.close() }
    })
  }
}