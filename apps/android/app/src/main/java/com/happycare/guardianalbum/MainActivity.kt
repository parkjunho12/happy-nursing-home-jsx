package com.happycare.guardianalbum

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.firebase.messaging.FirebaseMessaging

/**
 * 행복한요양원 보호자앨범 — WebView 래퍼 앱
 * - 로고 스플래시 / 첫 로딩 표시 / 당겨서 새로고침
 * - 친절한 오류 화면 / 네트워크 복구 시 자동 재시도 / 실수 종료 방지
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var loadingView: LinearLayout
    private lateinit var errorView: LinearLayout
    private lateinit var errorText: TextView

    private var firstLoadDone = false
    private var hasError = false
    private var lastBackTime = 0L

    private val connectivityManager by lazy {
        getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    }
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.Theme_GuardianAlbum)   // 스플래시 → 일반 테마로 전환
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)
        loadingView = findViewById(R.id.loadingView)
        errorView = findViewById(R.id.errorView)
        errorText = findViewById(R.id.errorText)
        findViewById<Button>(R.id.retryButton).setOnClickListener { reload() }

        swipeRefresh.setColorSchemeColors(getColor(R.color.brand_orange))
        swipeRefresh.setOnRefreshListener {
            if (isOnline()) webView.reload()
            else { swipeRefresh.isRefreshing = false; showError(getString(R.string.error_network)) }
        }

        // release 빌드에서는 WebView 디버깅 비활성화
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        setupWebView()
        registerBackHandler()
        registerNetworkCallback()
        requestNotificationPermission()
        cacheFcmToken()

        loadAlbumOrError()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val s: WebSettings = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        @Suppress("DEPRECATION")
        s.databaseEnabled = true
        s.loadsImagesAutomatically = true
        s.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        s.cacheMode = WebSettings.LOAD_DEFAULT
        s.javaScriptCanOpenWindowsAutomatically = false

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        // WebView ↔ 앱 브릿지 (FCM 토큰 전달용) — 내부 도메인만 로드하므로 안전
        webView.addJavascriptInterface(NativeBridge(), "NativeBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                handleUrl(request.url)

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String?): Boolean =
                url?.let { handleUrl(Uri.parse(it)) } ?: false

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                hasError = false
                if (firstLoadDone) progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                if (!firstLoadDone && !hasError) {
                    firstLoadDone = true
                    loadingView.visibility = View.GONE   // 첫 로딩 완료
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) showError(getString(R.string.error_load))
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (firstLoadDone) {
                    progressBar.progress = newProgress
                    progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                }
            }
        }
    }

    private fun handleUrl(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase()
        val host = uri.host ?: return false
        when (scheme) {
            // 내부(허용) 도메인은 WebView에서 로드. 외부 도메인은 기본 브라우저.
            // http도 내부면 그대로 로드 — 평문 허용 여부는 빌드타입이 결정(release=차단, debug=허용).
            "https", "http" -> return if (isAllowedHost(host)) false else { openExternal(uri); true }
            else -> { openExternal(uri); return true }
        }
    }

    private fun isAllowedHost(host: String): Boolean {
        val allowed = BuildConfig.ALLOWED_HOST
        return host.equals(allowed, ignoreCase = true) || host.endsWith(".$allowed", ignoreCase = true)
    }

    private fun openExternal(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
    }

    private fun loadAlbumOrError() {
        if (isOnline()) { hideError(); webView.loadUrl(targetUrl()) }
        else showError(getString(R.string.error_network))
    }

    /** 알림 탭으로 들어온 경우 해당 딥링크 URL, 아니면 기본 앨범 URL */
    private fun targetUrl(): String = deepLinkUrl(intent) ?: BuildConfig.ALBUM_URL

    // ALBUM_URL(=".../family/albums")은 빌드타입별 scheme·host를 이미 갖고 있으므로 그대로 사용
    private fun albumUrl(id: String): String = "${BuildConfig.ALBUM_URL}/$id"
    // 가족 웹 베이스(=".../family") — 앨범/소식 등 하위 경로 조립에 사용
    private fun familyBase(): String = BuildConfig.ALBUM_URL.removeSuffix("/albums")
    private fun newsUrl(id: String): String = "${familyBase()}/news/$id"

    /** 푸시 인텐트 → 열어야 할 URL. 앨범(album_id) 우선, 없으면 시설소식(news_id). */
    private fun deepLinkUrl(intent: Intent?): String? {
        intent?.getStringExtra("album_id")?.takeIf { it.isNotEmpty() }?.let { return albumUrl(it) }
        intent?.getStringExtra("news_id")?.takeIf { it.isNotEmpty() }?.let { return newsUrl(it) }
        return null
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = deepLinkUrl(intent)
        if (url != null && this::webView.isInitialized) webView.loadUrl(url)
    }

    private fun startDownload(url: String, contentDisposition: String?, mimeType: String?) {
        try {
            val req = DownloadManager.Request(Uri.parse(url))
            req.setMimeType(mimeType)
            val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            @Suppress("DEPRECATION") req.allowScanningByMediaScanner()
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            Toast.makeText(this, "저장을 시작했어요", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "저장에 실패했어요", Toast.LENGTH_SHORT).show()
        }
    }

    private fun reload() {
        if (!isOnline()) { showError(getString(R.string.error_network)); return }
        hideError()
        if (!firstLoadDone) loadingView.visibility = View.VISIBLE
        val current = webView.url
        if (current.isNullOrEmpty()) webView.loadUrl(BuildConfig.ALBUM_URL) else webView.reload()
    }

    private fun showError(message: String) {
        hasError = true
        errorText.text = message
        errorView.visibility = View.VISIBLE
        loadingView.visibility = View.GONE
        progressBar.visibility = View.GONE
        swipeRefresh.isRefreshing = false
    }

    private fun hideError() {
        hasError = false
        errorView.visibility = View.GONE
    }

    private fun isOnline(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val caps = connectivityManager.getNetworkCapabilities(network) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            connectivityManager.activeNetworkInfo?.isConnected == true
        }
    }

    /** 오류 화면에서 네트워크가 돌아오면 자동 재시도 */
    private fun registerNetworkCallback() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build()
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread { if (errorView.visibility == View.VISIBLE) reload() }
            }
        }
        networkCallback = cb
        try { connectivityManager.registerNetworkCallback(request, cb) } catch (_: Exception) {}
    }

    private fun registerBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    // 실수 종료 방지: 2초 안에 한 번 더 눌러야 종료
                    val now = System.currentTimeMillis()
                    if (now - lastBackTime < 2000) finish()
                    else {
                        lastBackTime = now
                        Toast.makeText(this@MainActivity, getString(R.string.exit_hint), Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    /** WebView에 노출되는 브릿지 — 로그인된 가족 페이지가 FCM 토큰을 읽어 백엔드에 등록한다. */
    inner class NativeBridge {
        @JavascriptInterface
        fun getFcmToken(): String =
            getSharedPreferences(FcmService.PREFS, Context.MODE_PRIVATE)
                .getString(FcmService.KEY_TOKEN, "") ?: ""

        @JavascriptInterface
        fun isApp(): Boolean = true
    }

    private fun cacheFcmToken() {
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                getSharedPreferences(FcmService.PREFS, Context.MODE_PRIVATE)
                    .edit().putString(FcmService.KEY_TOKEN, token).apply()
            }
        } catch (_: Exception) { /* google-services.json 미설정 시 무시 */ }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
            }
        }
    }

    override fun onDestroy() {
        networkCallback?.let { try { connectivityManager.unregisterNetworkCallback(it) } catch (_: Exception) {} }
        super.onDestroy()
    }
}
