package com.kartsync.bridge

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.*

class KSBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "KSBridge"

  private fun prefs(): SharedPreferences =
    reactContext.getSharedPreferences("ks_prefs", Context.MODE_PRIVATE)

  @ReactMethod
  fun setIngestConfig(orgPhone: String, ingestUrl: String, hmacSecret: String, promise: Promise) {
    try {
      prefs().edit()
        .putString("org_phone", orgPhone)
        .putString("ingest_url", ingestUrl.trimEnd('/'))
        .putString("hmac_secret", hmacSecret)
        .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_SET_CFG", e)
    }
  }
}