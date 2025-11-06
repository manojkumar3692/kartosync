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

// ⬇ ensure this import exists (your ContactResolver from previous step)
import com.kartsync.notif.ContactResolver

class KSNotificationListener : NotificationListenerService() {

  companion object {
    private const val TAG = "KSNL"
    private val MEM_DEDUPE = ConcurrentHashMap<String, Long>() // sig -> ts
    private const val DEDUPE_WINDOW_MS = 2500L                 // drop repeats within 2.5s
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
  // Helpers to decide if this notification is a real chat message
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
    // Typical WhatsApp summary lines
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
    // Clean old entries opportunistically
    MEM_DEDUPE.entries.removeIf { (now - it.value) > (DEDUPE_WINDOW_MS * 4) }
    return last == null || (now - last) > DEDUPE_WINDOW_MS
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
    if (isGroupSummary(n)) {
      Log.d(TAG, "skip: group summary")
      return
    }
    if (isCallOrOngoing(n)) {
      Log.d(TAG, "skip: call/ongoing")
      return
    }

    // Prefer bigText if present
    val title = (extras.getCharSequence("android.title") ?: "").toString().trim()
    val text  = (extras.getCharSequence("android.text") ?: "").toString().trim()
    val big   = (extras.getCharSequence("android.bigText") ?: "").toString().trim()
    val body  = if (big.isNotBlank()) big else text
    if (body.isBlank()) {
      Log.d(TAG, "skip: empty body")
      return
    }

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
    // 1 If title looks like a number, use it directly; else 2 resolve from Contacts
    val fromPhone =
      ContactResolver.phoneFromTitleIfNumber(title)
        ?: ContactResolver.resolvePhoneByDisplayName(applicationContext, title)
        ?: ""

    // Local in-memory dedupe: (name|phone|body) per few seconds
    val sigLocal = hmacSha256Hex("local", orgPhone + "|" + fromName + "|" + fromPhone + "|" + body)
    if (!passMemoryDedupe(sigLocal)) {
      Log.d(TAG, "drop duplicate within window")
      return
    }

    // Build payload for backend (matches your /api/ingest/local expectation)
    val payload = JSONObject().apply {
      put("org_phone", orgPhone)
      put("from_name", fromName)
      put("from_phone", fromPhone)  // may be "" if not resolved
      put("text", body)
      put("ts", System.currentTimeMillis())
    }.toString()

    val sig = hmacSha256Hex(secret, payload)

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