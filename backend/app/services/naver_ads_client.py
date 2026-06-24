"""
네이버 검색광고 API 클라이언트.

인증: timestamp + method + uri + secret 기반 HMAC-SHA256 서명.
  - X-Timestamp : 밀리초 단위 timestamp
  - X-API-KEY   : API Key (액세스 라이선스)
  - X-Customer  : 광고주(customer) ID
  - X-Signature : base64(HMAC_SHA256(secret, "{timestamp}.{method}.{uri}"))

보안 원칙:
  - 인증 정보(API Key / Secret / Signature)는 env에서만 읽고, 절대 로그/응답에 남기지 않는다.
  - API 실패 시 호출부에는 일반 메시지(NaverAdsError)만 전달한다.
  - 내부 로그에는 status_code / error_code 수준만 남긴다.
  - 실패한 요청은 재시도하지 않는다.

※ 참고: 네이버 검색광고 API의 일부 통계(StatReport) 엔드포인트/필드명은
  계정·문서 버전에 따라 다를 수 있으므로, 실제 연동 시 반드시 공식 문서로 검증한다.
  (아래 get_performance_report 의 TODO 참고)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("naver_ads")


class NaverAdsError(Exception):
    """네이버 광고 API 호출 실패 (호출부에는 일반 메시지만 노출)."""

    def __init__(self, message: str = "네이버 광고 API 요청에 실패했습니다.",
                 status_code: Optional[int] = None, error_code: Optional[str] = None,
                 detail: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.detail = detail   # 네이버가 준 에러 설명(title/detail/message) — 인증정보 아님


class NaverAdsNotConfigured(NaverAdsError):
    """API 키 등 환경변수가 설정되지 않음."""


class NaverAdsClient:
    def __init__(self) -> None:
        self.base_url = (settings.NAVER_ADS_BASE_URL or "https://api.searchad.naver.com").rstrip("/")
        self._api_key = settings.NAVER_ADS_API_KEY or ""
        self._secret_key = settings.NAVER_ADS_SECRET_KEY or ""
        self._customer_id = settings.NAVER_ADS_CUSTOMER_ID or ""
        self.timeout = 15.0
        # 마스터 데이터(캠페인/광고그룹/키워드) 단기 캐시 — 반복 조회 속도 개선
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = 120.0  # 초
        self._max_workers = 4
        self._time_offset_ms = 0   # 네이버 서버와의 시계 오차 보정값

    # ------------------------------------------------------------------ #
    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._secret_key and self._customer_id)

    def _require_config(self) -> None:
        if not self.is_configured:
            # 어떤 값이 비었는지는 로그에 남기지 않는다.
            raise NaverAdsNotConfigured("네이버 광고 API가 설정되지 않았습니다. 환경변수를 확인해주세요.")

    # ------------------------------------------------------------------ #
    def generate_signature(self, method: str, uri: str, timestamp: str) -> str:
        """
        서명 생성: base64(HMAC_SHA256(secret, "{timestamp}.{METHOD}.{uri}")).
        uri 는 path 만 사용한다(쿼리스트링 제외).
        """
        message = f"{timestamp}.{method.upper()}.{uri}"
        digest = hmac.new(
            self._secret_key.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(digest).decode("utf-8")

    def _headers(self, method: str, uri: str) -> Dict[str, str]:
        timestamp = str(int(time.time() * 1000) + self._time_offset_ms)
        signature = self.generate_signature(method, uri, timestamp)
        return {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Timestamp": timestamp,
            "X-API-KEY": self._api_key,
            "X-Customer": str(self._customer_id),
            "X-Signature": signature,
        }

    # ------------------------------------------------------------------ #
    def request(
        self,
        method: str,
        uri: str,
        params: Optional[Dict[str, Any]] = None,
        body: Optional[Any] = None,
    ) -> Any:
        """
        공통 요청 처리. 실패 시 NaverAdsError(일반 메시지) 발생. 재시도 없음.
        """
        self._require_config()
        url = f"{self.base_url}{uri}"

        # 429(레이트리밋)/503 일시 오류만 제한적으로 백오프 재시도. 그 외 4xx는 즉시 실패.
        max_retries = 3
        backoff = 0.5
        attempt = 0
        resp = None
        ts_synced = False
        while True:
            attempt += 1
            headers = self._headers(method, uri)  # 매 시도마다 timestamp/서명 갱신
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.request(method.upper(), url, params=params, json=body, headers=headers)
            except httpx.HTTPError as exc:
                logger.warning("naver_ads request transport error: %s", type(exc).__name__)
                raise NaverAdsError("네이버 광고 서버에 연결하지 못했습니다.")

            # 시계 오차(Invalid Timestamp)로 인한 403 → 네이버 Date 헤더로 오프셋 보정 후 1회 재시도
            if resp.status_code == 403 and not ts_synced:
                date_hdr = resp.headers.get("Date")
                if date_hdr:
                    try:
                        from email.utils import parsedate_to_datetime
                        naver_ms = int(parsedate_to_datetime(date_hdr).timestamp() * 1000)
                        self._time_offset_ms = naver_ms - int(time.time() * 1000)
                        ts_synced = True
                        logger.warning("naver_ads clock skew corrected: offset=%dms", self._time_offset_ms)
                        continue
                    except Exception:
                        pass

            if resp.status_code in (429, 503) and attempt <= max_retries:
                retry_after = resp.headers.get("Retry-After")
                try:
                    wait = float(retry_after) if retry_after else backoff
                except (TypeError, ValueError):
                    wait = backoff
                wait = min(wait, 5.0)
                logger.warning("naver_ads rate-limited (status=%s), retry %s/%s after %.1fs uri=%s",
                               resp.status_code, attempt, max_retries, wait, uri)
                time.sleep(wait)
                backoff *= 2
                continue
            break

        if resp.status_code >= 400:
            error_code = None
            detail = None
            try:
                j = resp.json() or {}
                error_code = j.get("code")
                detail = j.get("title") or j.get("detail") or j.get("message")
            except Exception:
                error_code = None
            # Authorization/Signature 등 민감정보는 남기지 않고 상태/에러코드/설명만 기록
            logger.warning(
                "naver_ads api error: status=%s code=%s uri=%s detail=%s",
                resp.status_code, error_code, uri, detail,
            )
            raise NaverAdsError(
                status_code=resp.status_code,
                error_code=str(error_code) if error_code else None,
                detail=str(detail) if detail else None,
            )

        if not resp.content:
            return None
        try:
            return resp.json()
        except Exception:
            return None

    # ------------------------------------------------------------------ #
    # 캐시 / 병렬 유틸
    # ------------------------------------------------------------------ #
    def _cached(self, key: str, producer):
        hit = self._cache.get(key)
        if hit and (time.time() - hit[0] < self._cache_ttl):
            return hit[1]
        val = producer()
        self._cache[key] = (time.time(), val)
        return val

    def clear_cache(self) -> None:
        self._cache.clear()

    def _parallel(self, fn, items):
        """items 각각에 fn 적용을 병렬 실행(순서 보존). 개별 실패는 빈 결과."""
        if not items:
            return []
        results: List[Any] = [None] * len(items)
        def _wrap(i_item):
            i, item = i_item
            try:
                results[i] = fn(item)
            except NaverAdsError:
                results[i] = []
        with ThreadPoolExecutor(max_workers=min(self._max_workers, len(items))) as ex:
            list(ex.map(_wrap, list(enumerate(items))))
        return results

    # ------------------------------------------------------------------ #
    # Master data
    # ------------------------------------------------------------------ #
    def get_campaigns(self) -> List[Dict[str, Any]]:
        """캠페인 목록. GET /ncc/campaigns (캐시)"""
        return self._cached("campaigns", lambda: self.request("GET", "/ncc/campaigns") or [])

    def get_adgroups(self, campaign_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """광고그룹 목록. GET /ncc/adgroups[?nccCampaignId=...]"""
        key = f"adgroups:{campaign_id or 'all'}"
        params = {"nccCampaignId": campaign_id} if campaign_id else None
        return self._cached(key, lambda: self.request("GET", "/ncc/adgroups", params=params) or [])

    def get_keywords(self, adgroup_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        키워드 목록. GET /ncc/keywords?nccAdgroupId=...
        ※ 네이버 API는 보통 adgroup 단위 조회를 요구한다. adgroup_id 미지정 시
          상위에서 광고그룹을 순회하며 수집한다.
        """
        if adgroup_id:
            return self._cached(
                f"keywords:{adgroup_id}",
                lambda: self.request("GET", "/ncc/keywords", params={"nccAdgroupId": adgroup_id}) or [],
            )

        def _all():
            ag_ids = [a.get("nccAdgroupId") for a in self.get_adgroups() if a.get("nccAdgroupId")]
            # 광고그룹별 키워드 조회를 병렬 실행 (순차 → 병렬로 로딩 단축)
            chunks = self._parallel(
                lambda ag_id: self.request("GET", "/ncc/keywords", params={"nccAdgroupId": ag_id}) or [],
                ag_ids,
            )
            out: List[Dict[str, Any]] = []
            for c in chunks:
                if c:
                    out.extend(c)
            return out

        return self._cached("keywords:all", _all)

    # ------------------------------------------------------------------ #
    # Performance (Stat) report
    # ------------------------------------------------------------------ #
    def get_performance_report(
        self,
        ids: List[str],
        start_date: str,
        end_date: str,
        fields: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        키워드/광고그룹 성과 조회.

        TODO(실연동 검증 필요): 네이버 검색광고는 즉시 통계용 `/stats` 와
        대용량 보고서용 `StatReport`(/stat-reports) 두 방식이 있다.
        계정/문서 버전에 따라 파라미터(fields, timeRange, datePreset)와
        응답 스키마가 다르므로 공식 문서로 반드시 검증할 것.

        여기서는 `/stats` (즉시 통계) 방식을 가정한다:
          GET /stats?ids=<id>,<id>&fields=["impCnt","clkCnt",...]&timeRange={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
        """
        import json as _json

        if not ids:
            return []
        if fields is None:
            # 카운트 가능한 핵심 필드만 요청(파생값 ctr/cpc는 호출부에서 계산)
            # impCnt(노출) clkCnt(클릭) salesAmt(비용) ccnt(전환)
            # ccnt=전환수, convAmt=전환매출 (전환추적/프리미엄 로그분석이 설정된 계정만 값이 들어옴)
            fields = ["impCnt", "clkCnt", "salesAmt", "ccnt", "convAmt"]

        time_range = _json.dumps({"since": start_date, "until": end_date})
        fields_json = _json.dumps(fields)

        # URL too long 방지 + 레이트리밋 방지:
        #  - 청크를 크게(80개) 잡아 요청 수를 줄이고,
        #  - 동시 대량 발사 대신 '순차 + 짧은 페이싱'으로 호출한다(429 폭주 방지).
        CHUNK = 80
        chunks = [ids[i:i + CHUNK] for i in range(0, len(ids), CHUNK)]

        merged: List[Dict[str, Any]] = []
        for idx, chunk in enumerate(chunks):
            params = {"ids": chunk, "fields": fields_json, "timeRange": time_range}
            try:
                data = self.request("GET", "/stats", params=params)
            except NaverAdsError:
                continue  # 일부 청크 실패는 건너뜀(재시도는 request 내부에서 제한적으로)
            if isinstance(data, dict):
                part = data.get("data", []) or []
            else:
                part = data or []
            if part:
                merged.extend(part)
            if idx + 1 < len(chunks):
                time.sleep(0.12)  # 청크 간 간격으로 레이트리밋 완화
        return merged

    # ------------------------------------------------------------------ #
    # Mutation
    # ------------------------------------------------------------------ #
    def update_keyword_bid(self, keyword_id: str, bid_amount: int,
                           adgroup_id: Optional[str] = None) -> Dict[str, Any]:
        """
        키워드 입찰가 변경.
        PUT /ncc/keywords/{keywordId}?fields=bidAmt
        body: {"nccKeywordId": keyword_id, "nccAdgroupId": ..., "bidAmt": ..., "useGroupBidAmt": false}
        adgroup_id 를 넘기면 사전 조회 GET 을 생략한다(대량 처리 시 호출수 절감).
        """
        uri = f"/ncc/keywords/{keyword_id}"

        # 네이버는 입찰가 수정 시 본문에 키워드가 속한 광고그룹 번호(nccAdgroupId)를 요구한다.
        # adgroup_id 가 없을 때만 키워드 객체를 조회해 가져온다.
        if not adgroup_id:
            try:
                objs = self.request("GET", "/ncc/keywords", params={"ids": [keyword_id]}) or []
                if objs:
                    adgroup_id = objs[0].get("nccAdgroupId")
            except NaverAdsError:
                adgroup_id = None

        body = {
            "nccKeywordId": keyword_id,
            "bidAmt": int(bid_amount),
            "useGroupBidAmt": False,   # 키워드 개별 입찰가 사용(그룹 입찰가 미사용)으로 전환
        }
        if adgroup_id:
            body["nccAdgroupId"] = adgroup_id

        # fields=bidAmt 단일 필드 갱신(useGroupBidAmt/nccAdgroupId는 body로 함께 전달)
        return self.request("PUT", uri, params={"fields": "bidAmt"}, body=body) or {}


_client: Optional[NaverAdsClient] = None


def get_naver_ads_client() -> NaverAdsClient:
    global _client
    if _client is None:
        _client = NaverAdsClient()
    return _client
