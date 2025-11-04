package com.kartsync.bridge

import android.os.Build
import com.facebook.react.bridge.*
import com.kartsync.BuildConfig

class KSBuildInfoModule(reactContext: ReactApplicationContext)
  : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "KSBuildInfo"

  @ReactMethod
  fun get(promise: Promise) {
    try {
      val ctx = reactApplicationContext
      val pm = ctx.packageManager
      val pkg = ctx.packageName
      val pi = pm.getPackageInfo(pkg, 0)

      val versionName = pi.versionName ?: "0.0.0"
      val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        pi.longVersionCode.toInt()
      } else {
        @Suppress("DEPRECATION") pi.versionCode
      }
      val buildType = BuildConfig.BUILD_TYPE ?: "release"

      val map = Arguments.createMap().apply {
        putString("packageName", pkg)
        putString("versionName", versionName)
        putInt("versionCode", versionCode)
        putString("buildType", buildType)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("buildinfo_error", e)
    }
  }
}