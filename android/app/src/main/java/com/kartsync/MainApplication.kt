package com.kartsync

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

// Existing custom package(s)
import com.kartsync.bridge.KSBridgePackage
// NEW: native config package used by Connect screen to save ks_prefs for the listener
import com.kartsync.notif.KSConfigPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Register custom native packages
          add(KSBridgePackage())
          add(KSConfigPackage())  // <-- required for KSConfig.setConfig/getConfig
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}