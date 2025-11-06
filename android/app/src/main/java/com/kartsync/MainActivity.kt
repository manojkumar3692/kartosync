package com.kartsync

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

// ⬇ new imports for runtime permission
import android.Manifest
import android.os.Build
import android.os.Bundle
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "KartSync"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // ⬇ request READ_CONTACTS once so we can resolve WhatsApp display names → numbers
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    ensureContactsPermission()
  }

  private fun ensureContactsPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val granted = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.READ_CONTACTS
    ) == PackageManager.PERMISSION_GRANTED
    if (!granted) {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.READ_CONTACTS),
        1001
      )
    }
  }
}