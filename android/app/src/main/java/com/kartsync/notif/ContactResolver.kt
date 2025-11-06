package com.kartsync.notif

import android.content.Context
import android.provider.ContactsContract

object ContactResolver {

    private fun normalizePhone(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val s = raw.trim()
        val plus = if (s.startsWith("+")) "+" else ""
        val digits = s.replace(Regex("[^\\d]"), "")
        return if (digits.length >= 7) plus + digits else null
    }

    /** If the string already looks like a number, normalize and return it. */
    fun phoneFromTitleIfNumber(title: String?): String? {
        if (title.isNullOrBlank()) return null
        // simple heuristic: title has at least 5 digits in total
        val digits = title.filter { it.isDigit() }
        return if (digits.length >= 5) normalizePhone(title) else null
    }

    /** Exact match on Contacts display name → first phone found. */
    fun resolvePhoneByDisplayName(ctx: Context, displayName: String?): String? {
        val name = displayName?.trim().orEmpty()
        if (name.isEmpty()) return null

        val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY
        )
        val selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY} = ?"
        val args = arrayOf(name)

        ctx.contentResolver.query(uri, projection, selection, args, null)?.use { c ->
            while (c.moveToNext()) {
                val number = c.getString(0) ?: continue
                val norm = normalizePhone(number)
                if (norm != null) return norm
            }
        }
        return null
    }
}