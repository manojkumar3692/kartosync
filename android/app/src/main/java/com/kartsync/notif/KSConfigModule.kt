package com.kartsync.notif

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KSConfigModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "KSConfig"

  private fun prefs(): SharedPreferences =
    reactContext.getSharedPreferences("ks_prefs", Context.MODE_PRIVATE)

  @ReactMethod
  fun setConfig(ingestUrl: String, orgPhone: String, hmacSecret: String, promise: Promise) {
    try {
      val u = ingestUrl.replace(Regex("/+$"), "")
      prefs().edit()
        .putString("ingest_url", u)
        .putString("org_phone", orgPhone.trim())
        .putString("hmac_secret", hmacSecret.trim())
        .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SET_CONFIG_FAILED", e)
    }
  }

  @ReactMethod
  fun getConfig(promise: Promise) {
    val p = prefs()
    val map = com.facebook.react.bridge.WritableNativeMap().apply {
      putString("ingest_url", p.getString("ingest_url", null))
      putString("org_phone", p.getString("org_phone", null))
      putString("hmac_secret", p.getString("hmac_secret", null))
    }
    promise.resolve(map)
  }
}