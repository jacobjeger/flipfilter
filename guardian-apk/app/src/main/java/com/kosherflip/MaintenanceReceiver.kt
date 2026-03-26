package com.kosherflip

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Handles maintenance mode toggling via ADB broadcast.
 *
 * To unlock (enable maintenance / allow app changes):
 *   adb shell am broadcast -a com.kosherflip.MAINTENANCE_MODE --ez unlock true -n com.kosherflip/.MaintenanceReceiver
 *
 * To re-lock (re-apply all restrictions):
 *   adb shell am broadcast -a com.kosherflip.MAINTENANCE_MODE --ez unlock false -n com.kosherflip/.MaintenanceReceiver
 */
class MaintenanceReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "com.kosherflip.MAINTENANCE_MODE") return

        val unlock = intent.getBooleanExtra("unlock", false)

        if (unlock) {
            AdminReceiver.removeRestrictions(context)
        } else {
            AdminReceiver.applyRestrictions(context)
        }
    }
}
