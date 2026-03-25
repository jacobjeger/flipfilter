export const packageNames: Record<string, string> = {
  // Browsers
  'com.android.browser': 'Browser',
  'com.google.android.chrome': 'Chrome',
  'com.opera.browser': 'Opera',
  'com.UCMobile.intl': 'UC Browser',
  'org.mozilla.firefox': 'Firefox',
  'com.brave.browser': 'Brave Browser',
  'com.microsoft.emmx': 'Edge Browser',

  // Social Media
  'com.facebook.katana': 'Facebook',
  'com.facebook.lite': 'Facebook Lite',
  'com.facebook.orca': 'Messenger',
  'com.instagram.android': 'Instagram',
  'com.twitter.android': 'Twitter/X',
  'com.tiktok.android': 'TikTok',
  'com.snapchat.android': 'Snapchat',
  'com.pinterest': 'Pinterest',
  'com.reddit.frontpage': 'Reddit',
  'com.linkedin.android': 'LinkedIn',
  'com.tumblr': 'Tumblr',

  // Messaging
  'com.whatsapp': 'WhatsApp',
  'com.discord': 'Discord',
  'org.telegram.messenger': 'Telegram',
  'com.viber.voip': 'Viber',
  'com.skype.raider': 'Skype',
  'com.google.android.talk': 'Google Hangouts',
  'com.google.android.apps.messaging': 'Google Messages',

  // Google Services
  'com.android.vending': 'Google Play Store',
  'com.google.android.gms': 'Google Play Services',
  'com.google.android.gsf': 'Google Services Framework',
  'com.google.android.googlequicksearchbox': 'Google Search',
  'com.google.android.assistant': 'Google Assistant',
  'com.google.android.gm': 'Gmail',
  'com.google.android.apps.maps': 'Google Maps',
  'com.google.android.youtube': 'YouTube',
  'com.google.android.music': 'Google Play Music',
  'com.google.android.videos': 'Google Play Movies',
  'com.google.android.apps.photos': 'Google Photos',
  'com.google.android.apps.docs': 'Google Drive',
  'com.google.android.calendar': 'Google Calendar',
  'com.google.android.contacts': 'Google Contacts',
  'com.google.android.keep': 'Google Keep',
  'com.google.android.apps.tachyon': 'Google Duo',
  'com.google.android.apps.youtube.music': 'YouTube Music',
  'com.google.android.apps.magazines': 'Google News',
  'com.google.android.apps.translate': 'Google Translate',
  'com.google.android.dialer': 'Google Phone',

  // Entertainment
  'com.spotify.music': 'Spotify',
  'com.netflix.mediaclient': 'Netflix',
  'com.amazon.avod': 'Amazon Prime Video',
  'com.pandora.android': 'Pandora',
  'com.hulu.plus': 'Hulu',

  // Shopping
  'com.amazon.mShop.android.shopping': 'Amazon Shopping',
  'com.ebay.mobile': 'eBay',
  'com.alibaba.aliexpresshd': 'AliExpress',

  // Utilities
  'com.android.packageinstaller': 'App Installer',
  'com.google.android.packageinstaller': 'Google App Installer',
  'com.android.gallery3d': 'Gallery',
  'com.android.camera2': 'Camera',
  'com.android.email': 'Email',
  'com.android.calculator2': 'Calculator',
  'com.android.calendar': 'Calendar',
  'com.android.deskclock': 'Clock',
  'com.android.settings': 'Settings',
  'com.android.documentsui': 'Files',
  'com.android.providers.downloads.ui': 'Downloads',

  // Reading
  'com.amazon.kindle': 'Kindle',
  'com.google.android.apps.books': 'Google Play Books',

  // Navigation
  'com.waze': 'Waze',

  // News
  'com.cnn.mobile.android.phone': 'CNN',
  'com.foxnews.android': 'Fox News',

  // Other
  'com.android.stk': 'SIM Toolkit',
  'com.android.providers.calendar': 'Calendar Storage',
  'com.android.providers.contacts': 'Contacts Storage',
  'com.android.providers.media': 'Media Storage',
  'com.android.providers.telephony': 'Messaging Storage',
  'com.android.phone': 'Phone',
  'com.android.mms': 'Messages',
  'com.android.contacts': 'Contacts',
};

export function getAppName(packageName: string): string {
  return packageNames[packageName] || packageName;
}

export type AppCategory = 'browser' | 'social' | 'messaging' | 'google' | 'entertainment' | 'shopping' | 'utility' | 'other';

export function getAppCategory(packageName: string): AppCategory {
  if (packageName.includes('browser') || packageName.includes('chrome') || packageName.includes('opera') || packageName.includes('UCMobile') || packageName.includes('firefox') || packageName.includes('brave') || packageName.includes('emmx')) return 'browser';
  if (packageName.includes('facebook') || packageName.includes('instagram') || packageName.includes('twitter') || packageName.includes('tiktok') || packageName.includes('snapchat') || packageName.includes('pinterest') || packageName.includes('reddit') || packageName.includes('linkedin') || packageName.includes('tumblr')) return 'social';
  if (packageName.includes('whatsapp') || packageName.includes('discord') || packageName.includes('telegram') || packageName.includes('viber') || packageName.includes('skype') || packageName.includes('talk') || packageName.includes('messaging')) return 'messaging';
  if (packageName.includes('google')) return 'google';
  if (packageName.includes('spotify') || packageName.includes('netflix') || packageName.includes('pandora') || packageName.includes('hulu') || packageName.includes('youtube') || packageName.includes('music') || packageName.includes('videos')) return 'entertainment';
  if (packageName.includes('amazon') && packageName.includes('shop') || packageName.includes('ebay') || packageName.includes('alibaba')) return 'shopping';
  if (packageName.includes('calculator') || packageName.includes('calendar') || packageName.includes('clock') || packageName.includes('camera') || packageName.includes('gallery') || packageName.includes('packageinstaller')) return 'utility';
  return 'other';
}
