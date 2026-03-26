package com.kosherflip

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.UserManager

/**
 * KosherFlip Guardian — Device Owner receiver.
 *
 * When set as Device Owner via:
 *   adb shell dpm set-device-owner com.kosherflip/.AdminReceiver
 *
 * It enforces the following restrictions based on lockdown level:
 *
 * LEVEL 1 (Standard):
 *   - DISALLOW_FACTORY_RESET
 *   - DISALLOW_SAFE_BOOT
 *   - DISALLOW_INSTALL_UNKNOWN_SOURCES
 *   - DISALLOW_ADD_USER
 *
 * LEVEL 2 (Maximum) — all of Level 1 plus:
 *   - DISALLOW_USB_FILE_TRANSFER
 *   - DISALLOW_MOUNT_PHYSICAL_MEDIA
 *
 * The lockdown level is controlled via ADB by setting a system property:
 *   adb shell settings put global kosherflip_lockdown_level 1
 *   adb shell settings put global kosherflip_lockdown_level 2
 *
 * Restrictions are applied automatically when the device boots or when
 * the Device Owner is first enabled.
 */
class AdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        applyRestrictions(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        // Re-apply on boot
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == DeviceAdminReceiver.ACTION_DEVICE_ADMIN_ENABLED) {
            applyRestrictions(context)
        }
    }

    companion object {
        fun getComponentName(context: Context): ComponentName {
            return ComponentName(context, AdminReceiver::class.java)
        }

        /**
         * Apply all kosher lockdown restrictions.
         * Call this from the receiver or externally after setting Device Owner.
         */
        fun applyRestrictions(context: Context, level: Int = 0) {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = getComponentName(context)

            // Check if we are actually the device owner
            if (!dpm.isDeviceOwnerApp(context.packageName)) {
                return
            }

            // Determine lockdown level
            val lockdownLevel = if (level > 0) level else {
                try {
                    android.provider.Settings.Global.getInt(
                        context.contentResolver,
                        "kosherflip_lockdown_level",
                        1 // Default to Level 1
                    )
                } catch (e: Exception) {
                    1
                }
            }

            // ===== LEVEL 1: Standard =====
            // Block factory reset
            dpm.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET)

            // Block safe boot (Android 6+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                dpm.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT)
            }

            // Block unknown sources / sideloading
            dpm.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)

            // Block adding new users
            dpm.addUserRestriction(admin, UserManager.DISALLOW_ADD_USER)

            // Note: We intentionally do NOT set DISALLOW_INSTALL_APPS or
            // DISALLOW_UNINSTALL_APPS — those block ADB-based app management
            // via KosherFlip. The phone is still protected by
            // DISALLOW_INSTALL_UNKNOWN_SOURCES + disabled package installer.

            // Block modifying accounts (prevent adding Google account)
            dpm.addUserRestriction(admin, UserManager.DISALLOW_MODIFY_ACCOUNTS)

            // ===== LEVEL 2: Maximum =====
            if (lockdownLevel >= 2) {
                // Block USB file transfer
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    dpm.addUserRestriction(admin, UserManager.DISALLOW_USB_FILE_TRANSFER)
                }

                // Block mounting external media
                dpm.addUserRestriction(admin, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA)

                // Block Bluetooth (optional — prevents file sharing)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    dpm.addUserRestriction(admin, UserManager.DISALLOW_BLUETOOTH)
                }
            }
        }

        /**
         * Remove all restrictions (for maintenance/reset).
         * Can be triggered via ADB:
         *   adb shell settings put global kosherflip_unlock 1
         */
        fun removeRestrictions(context: Context) {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = getComponentName(context)

            if (!dpm.isDeviceOwnerApp(context.packageName)) return

            val restrictions = arrayOf(
                UserManager.DISALLOW_FACTORY_RESET,
                UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
                UserManager.DISALLOW_ADD_USER,
                UserManager.DISALLOW_INSTALL_APPS,
                UserManager.DISALLOW_UNINSTALL_APPS,
                UserManager.DISALLOW_MODIFY_ACCOUNTS,
                UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA,
            )

            for (restriction in restrictions) {
                try {
                    dpm.clearUserRestriction(admin, restriction)
                } catch (e: Exception) {
                    // Some restrictions may not exist on older APIs
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    dpm.clearUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT)
                    dpm.clearUserRestriction(admin, UserManager.DISALLOW_USB_FILE_TRANSFER)
                } catch (e: Exception) { }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    dpm.clearUserRestriction(admin, UserManager.DISALLOW_BLUETOOTH)
                } catch (e: Exception) { }
            }
        }
    }
}
