package com.kosherflip

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-applies all Device Owner restrictions on every boot.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            AdminReceiver.applyRestrictions(context)
        }
    }
}
