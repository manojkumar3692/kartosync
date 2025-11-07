// android/app/src/main/java/com/kartsync/notif/KSNotificationListener.kt
package com.kartsync.notif

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

import com.kartsync.notif.ContactResolver

class KSNotificationListener : NotificationListenerService() {

  companion object {
    private const val TAG = "KSNL"
    private val MEM_DEDUPE = ConcurrentHashMap<String, Long>() // sig -> ts
    // Longer client dedupe to avoid history replays bringing back deleted orders
    private const val DEDUPE_WINDOW_MS = 10 * 60 * 1000L       // 10 minutes
  }

  private val client by lazy {
    OkHttpClient.Builder()
      .connectTimeout(8, TimeUnit.SECONDS)
      .readTimeout(8, TimeUnit.SECONDS)
      .build()
  }

  private fun getPref(key: String): String? =
    getSharedPreferences("ks_prefs", MODE_PRIVATE).getString(key, null)

  // ───────────────────────────────────────────────────────────────────────────
  // PING: tell backend when listener binds/unbinds
  // ───────────────────────────────────────────────────────────────────────────
  private fun ping(state: String, reason: String? = null) {
    val orgPhone   = getPref("org_phone") ?: return
    val ingestBase = getPref("ingest_url") ?: return

    val payload = JSONObject().apply {
      put("org_phone", orgPhone)
      put("device", android.os.Build.MODEL ?: "android")
      put("state", state)
      put("pkg", packageName ?: "com.kartsync")
      if (reason != null) put("reason", reason)
      put("ts", System.currentTimeMillis())
    }.toString()

    val body = payload.toRequestBody("application/json".toMediaTypeOrNull())
    val req = Request.Builder()
      .url("$ingestBase/api/ingest/nl-ping")
      .post(body)
      .build()

    client.newCall(req).enqueue(object : Callback {
      override fun onFailure(call: Call, e: java.io.IOException) {
        Log.w(TAG, "nl-ping fail: ${e.message}")
      }
      override fun onResponse(call: Call, response: Response) {
        response.close()
        Log.i(TAG, "nl-ping ok: $state")
      }
    })
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    Log.i(TAG, "listener CONNECTED")
    ping("connected")
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    Log.w(TAG, "listener DISCONNECTED")
    ping("disconnected")
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────────────
  private fun isFromWhatsApp(pkg: String?): Boolean {
    if (pkg == null) return false
    return (pkg == "com.whatsapp" || pkg == "com.whatsapp.w4b")
  }

  private fun isGroupSummary(n: Notification?): Boolean {
    if (n == null) return false
    return (n.flags and Notification.FLAG_GROUP_SUMMARY) != 0
  }

  private fun isCallOrOngoing(n: Notification?): Boolean {
    if (n == null) return false
    val cat = n.category
    if ("call" == cat) return true
    return (n.flags and Notification.FLAG_ONGOING_EVENT) != 0
  }

  private fun looksLikeSummaryText(body: String): Boolean {
    val t = body.trim().lowercase()
    if (Regex("^\\d+\\s+new\\s+message(s)?$").matches(t)) return true
    if (t == "new message" || t == "new messages") return true
    if (t.endsWith("new messages")) return true
    return false
  }

  private fun hmacSha256Hex(secret: String, data: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
    val bytes = mac.doFinal(data.toByteArray(Charsets.UTF_8))
    val sb = StringBuilder(bytes.size * 2)
    for (b in bytes) sb.append(String.format("%02x", b))
    return sb.toString()
  }

  private fun passMemoryDedupe(sig: String): Boolean {
    val now = System.currentTimeMillis()
    val last = MEM_DEDUPE[sig]
    MEM_DEDUPE[sig] = now
    // clean old entries opportunistically
    MEM_DEDUPE.entries.removeIf { (now - it.value) > (DEDUPE_WINDOW_MS * 2) }
    return last == null || (now - last) > DEDUPE_WINDOW_MS
  }

  /**
   * OLD behavior: returned only the last non-empty line.
   * We now use this ONLY for the stacked `textLines` case (many messages),
   * NOT for single-message bigText/text (where we want full multi-line).
   */
  private fun lastNonEmptyLine(s: String): String {
    val lines = s.split('\n').map { it.trim() }.filter { it.isNotEmpty() }
    return if (lines.isNotEmpty()) lines.last() else s.trim()
  }

  /**
   * Extract body robustly:
   * - If `android.textLines` exists → likely stacked messages: take ONLY the last message.
   * - Else use `android.bigText` or `android.text` as-is (trim only ends, keep internal `\n`).
   *
   * This preserves multi-line orders in a single message while still
   * avoiding re-sending whole chat history.
   */
  private fun extractBody(extras: android.os.Bundle): String {
    val textLines = extras.getCharSequenceArray("android.textLines")
    if (textLines != null && textLines.isNotEmpty()) {
      // Inbox-style / multiple messages: we want just the latest message.
      val last = textLines.last().toString()
      return lastNonEmptyLine(last)
    }

    // Single notification body: may include newlines (multi-line order)
    val big = (extras.getCharSequence("android.bigText") ?: "").toString()
    val txt = (extras.getCharSequence("android.text") ?: "").toString()
    val body = if (big.isNotBlank()) big else txt

    // IMPORTANT: keep embedded newlines; just trim edges
    return body.trim()
  }

  // Heuristic: try to detect "edited" notifications
  private fun detectEditedFlag(extras: android.os.Bundle?, body: String): Boolean {
    val sub = (extras?.getCharSequence("android.subText") ?: "").toString().lowercase()
    val info = (extras?.getCharSequence("android.infoText") ?: "").toString().lowercase()
    val hintEdited = body.lowercase().contains("(edited)") ||
      sub.contains("edited") || info.contains("edited")
    return hintEdited
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WhatsApp → backend ingest
  // ───────────────────────────────────────────────────────────────────────────
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val pkg = sbn.packageName
    if (!isFromWhatsApp(pkg)) return

    val n = sbn.notification
    val extras = n?.extras ?: return

    // Skip summaries / ongoing / calls
    if (isGroupSummary(n)) { Log.d(TAG, "skip: group summary"); return }
    if (isCallOrOngoing(n)) { Log.d(TAG, "skip: call/ongoing"); return }

    val title = (extras.getCharSequence("android.title") ?: "").toString().trim()
    val body  = extractBody(extras)
    if (body.isBlank()) { Log.d(TAG, "skip: empty body"); return }

    // Skip classic summary lines like "3 new messages"
    if (looksLikeSummaryText(body)) {
      Log.d(TAG, "skip: summary text = $body")
      return
    }

    val orgPhone   = getPref("org_phone") ?: return
    val ingestBase = getPref("ingest_url") ?: return
    val secret     = getPref("hmac_secret") ?: return

    // Resolve sender info
    val fromName  = title
    // If title looks like a number, use it directly; else resolve from Contacts
    val fromPhone =
      ContactResolver.phoneFromTitleIfNumber(title)
        ?: ContactResolver.resolvePhoneByDisplayName(applicationContext, title)
        ?: ""

    // Local in-memory dedupe: (name|phone|body) per window
    val sigLocal = hmacSha256Hex("local", orgPhone + "|" + fromName + "|" + fromPhone + "|" + body)
    if (!passMemoryDedupe(sigLocal)) {
      Log.d(TAG, "drop duplicate within window")
      return
    }

    // Message identity from Android Notification framework
    // sbn.key is unique per notification; good enough as msg_id for replacement attempts
    val msgId = try {
      (sbn.key ?: (sbn.id.toString()))
    } catch (e: Throwable) {
      sbn.id.toString()
    }

    val edited = detectEditedFlag(extras, body)
    val editedAt = if (edited) System.currentTimeMillis() else 0L

    // Build payload for backend (matches /api/ingest/local expectation)
    val payload = JSONObject().apply {
      put("org_phone", orgPhone)
      put("from_name", fromName)
      put("from_phone", fromPhone)  // may be "" if not resolved
      put("text", body)             // FULL body; may contain \n for multi-line orders
      put("ts", System.currentTimeMillis())
      put("msg_id", msgId)
      if (editedAt > 0L) put("edited_at", editedAt)
    }.toString()

    val sig = hmacSha256Hex(secret, payload)

    Log.d(TAG, "SEND → /api/ingest/local payload=$payload")

    val req = Request.Builder()
      .url("$ingestBase/api/ingest/local")
      .post(payload.toRequestBody("application/json".toMediaTypeOrNull()))
      .header("X-Signature", sig)
      .build()

    client.newCall(req).enqueue(object : Callback {
      override fun onFailure(call: Call, e: java.io.IOException) {
        Log.w(TAG, "ingest fail: ${e.message}")
      }
      override fun onResponse(call: Call, response: Response) {
        response.close()
        Log.i(TAG, "ingest ok")
      }
    })
  }
}