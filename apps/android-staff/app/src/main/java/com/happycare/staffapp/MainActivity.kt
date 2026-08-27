package com.happycare.staffapp

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.messaging.FirebaseMessaging

/**
 * 행복한요양원 직원앱 — 직원 전용 웹 페이지 WebView 래퍼
 * 권한 분기(요양보호사/사회복지사/관리자)는 기존 웹 로그인·백엔드에서 처리한다.
 * (네이티브 로그인/푸시/출퇴근/카메라 없음)
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorView: LinearLayout
    private lateinit var loadingView: LinearLayout
    private var firstLoadDone = false
    private lateinit var errorText: TextView

    // 사진 선택(<input type="file">) 처리용
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = filePathCallback
            filePathCallback = null
            cb?.onReceiveValue(
                if (result.resultCode == Activity.RESULT_OK)
                    WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
                else null
            )
        }

    // 사진/영상 다중 선택 (안드로이드 포토 피커)
    private val pickMediaLauncher =
        registerForActivityResult(ActivityResultContracts.PickMultipleVisualMedia()) { uris ->
            val cb = filePathCallback
            filePathCallback = null
            cb?.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 스크린샷/화면 녹화 방지 (민감정보 보호)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        setTheme(R.style.Theme_StaffApp)   // 스플래시 → 일반 테마로 전환
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        errorView = findViewById(R.id.errorView)
        loadingView = findViewById(R.id.loadingView)
        errorText = findViewById(R.id.errorText)
        findViewById<Button>(R.id.retryButton).setOnClickListener { reload() }

        // release 빌드에서는 WebView 디버깅 비활성화 (debug 빌드에서만 true)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        setupWebView()
        registerBackHandler()
        cacheFcmToken()
        requestNotificationPermission()

        loadStaffOrError()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val s: WebSettings = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        @Suppress("DEPRECATION")
        s.databaseEnabled = true
        s.loadsImagesAutomatically = true
        s.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW   // 혼합 콘텐츠 차단
        s.cacheMode = WebSettings.LOAD_DEFAULT                       // 일반 브라우저 수준 캐시
        s.javaScriptCanOpenWindowsAutomatically = false

        // 쿠키 허용 (일반 브라우저 수준) — 계정정보/토큰은 앱에 저장하지 않음
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
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                if (!firstLoadDone) {
                    firstLoadDone = true
                    loadingView.visibility = View.GONE   // 첫 로딩 완료
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                // 메인 프레임(주요 페이지) 로드 실패만 에러 화면 표시
                // (URL/토큰/개인정보는 로그로 남기지 않는다)
                if (request.isForMainFrame) {
                    showError(getString(R.string.error_load))
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            // 사진 업로드: <input type="file"> 탭 시 파일 선택기 띄우기
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)   // 이전 콜백 정리
                filePathCallback = callback
                // 1순위: 포토 피커(다중 선택). 실패 시 일반 파일 선택기로 폴백.
                return try {
                    pickMediaLauncher.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
                    )
                    true
                } catch (e: Exception) {
                    try {
                        val intent = params.createIntent().apply {
                            if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                        }
                        fileChooserLauncher.launch(intent)
                        true
                    } catch (e2: Exception) {
                        filePathCallback = null
                        false
                    }
                }
            }
        }
    }

    /**
     * 내부(직원 전용) 도메인은 WebView 안에서, 그 외 도메인은 외부 브라우저로 연다.
     * http 링크는 https로 전환 시도. (HTTPS만 허용)
     */
    private fun handleUrl(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase()
        val host = uri.host ?: return false

        when (scheme) {
            // 내부(허용) 도메인은 WebView에서 로드, 그 외는 기본 브라우저.
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
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
        }
    }

    private fun loadStaffOrError() {
        if (isOnline()) {
            hideError()
            if (!firstLoadDone) loadingView.visibility = View.VISIBLE
            webView.loadUrl(targetUrl())
        } else {
            showError(getString(R.string.error_network))
        }
    }

    private fun reload() {
        if (!isOnline()) {
            showError(getString(R.string.error_network))
            return
        }
        hideError()
        val current = webView.url
        if (current.isNullOrEmpty()) webView.loadUrl(BuildConfig.STAFF_URL) else webView.reload()
    }

    private fun showError(message: String) {
        errorText.text = message
        errorView.visibility = View.VISIBLE
        loadingView.visibility = View.GONE
        webView.visibility = View.GONE
        progressBar.visibility = View.GONE
    }

    private fun hideError() {
        errorView.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            cm.activeNetworkInfo?.isConnected == true
        }
    }

    private fun registerBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    /** 알림 탭(item_id)으로 들어오면 체크리스트, 아니면 기본 직원 페이지 */
    private fun checklistUrl(): String = "${BuildConfig.STAFF_URL}eval/checklist"

    private fun targetUrl(): String {
        val itemId = intent?.getStringExtra("item_id")
        val pushType = intent.getStringExtra("push_type")
        // 근무표 알림을 누르면 본인 근무표로 바로 — 목록을 헤매지 않게
        if (pushType == "my-schedule") return BuildConfig.STAFF_URL + "/my-schedule"
        return if (!itemId.isNullOrEmpty()) checklistUrl() else BuildConfig.STAFF_URL
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val itemId = intent.getStringExtra("item_id")
        val pushType = intent.getStringExtra("push_type")
        if (this::webView.isInitialized) {
            if (pushType == "my-schedule") webView.loadUrl(BuildConfig.STAFF_URL + "/my-schedule")
            else if (!itemId.isNullOrEmpty()) webView.loadUrl(checklistUrl())
        }
    }

    private fun cacheFcmToken() {
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                getSharedPreferences(StaffFcmService.PREFS, Context.MODE_PRIVATE)
                    .edit().putString(StaffFcmService.KEY_TOKEN, token).apply()
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

    /** WebView에 노출되는 브릿지 — 직원 로그인 페이지가 FCM 토큰을 읽어 백엔드에 등록 */
    inner class NativeBridge {
        @JavascriptInterface
        fun getFcmToken(): String =
            getSharedPreferences(StaffFcmService.PREFS, Context.MODE_PRIVATE)
                .getString(StaffFcmService.KEY_TOKEN, "") ?: ""

        @JavascriptInterface
        fun getPlatform(): String = "android"

        @JavascriptInterface
        fun isApp(): Boolean = true
    }
}
