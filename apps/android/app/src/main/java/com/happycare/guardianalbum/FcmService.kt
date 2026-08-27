package com.happycare.guardianalbum

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM 수신 서비스
 * - onNewToken: 토큰을 로컬 저장 → WebView 브릿지(NativeBridge.getFcmToken)가 읽어 백엔드 등록
 * - onMessageReceived: 알림 표시 (탭하면 앱 열림)
 */
class FcmService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_TOKEN, token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val n = message.notification
        val title = n?.title ?: message.data["title"] ?: getString(R.string.app_name)
        val body = n?.body ?: message.data["body"] ?: ""
        showNotification(title, body, message.data["album_id"], message.data["news_id"])
    }

    private fun showNotification(title: String, body: String, albumId: String?, newsId: String?) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "앨범 알림", NotificationManager.IMPORTANCE_HIGH)
            )
        }
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (!albumId.isNullOrEmpty()) putExtra("album_id", albumId)
            if (!newsId.isNullOrEmpty()) putExtra("news_id", newsId)
        }
        val pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pi)
            .build()
        nm.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        const val PREFS = "guardian_prefs"
        const val KEY_TOKEN = "fcm_token"
        const val CHANNEL_ID = "album_alerts"
    }
}
