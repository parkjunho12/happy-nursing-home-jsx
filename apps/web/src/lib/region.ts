/**
 * 지역 SEO 페이지 공통 설정 (config 분리)
 * 시설 기본 정보 + 지도 길찾기 링크.
 *
 * ⚠️ 교통 정보(버스 번호, 도보·소요 시간, 주차 대수)는 검증 전까지 하드코딩하지 않는다.
 *    정확한 좌표/Place ID가 확인되면 아래 값만 채우면 전용 길찾기 링크로 자동 전환된다.
 */
export const FACILITY = {
  name: '행복한요양원 녹양역점',
  address: '경기도 양주시 외미로20번길 34',
  street: '외미로20번길 34',
  city: '양주시',
  region: '경기도',
  phone: '031-856-8090',
  phoneLabel: '856.8090',
  // 좌표가 확정되지 않았다면 주소 기반 검색 링크를 사용한다.
  geo: { lat: 37.76774123217728, lng: 127.04359415733941 },
  // 확인되면 채운다(비어 있으면 주소/좌표 기반 링크 사용)
  naverPlaceId: '',
  kakaoPlaceId: '',
} as const

const ADDR_Q = encodeURIComponent(`${FACILITY.name} ${FACILITY.address}`)

/** 실제 동작하는 길찾기/검색 링크 (Place ID 확인 시 전용 링크로 교체) */
export const MAP_LINKS = {
  // 네이버지도: Place ID가 있으면 전용 길찾기, 없으면 주소 검색(검색 후 길찾기 가능)
  naver: FACILITY.naverPlaceId
    ? `https://map.naver.com/p/entry/place/${FACILITY.naverPlaceId}`
    : `https://map.naver.com/p/search/${ADDR_Q}`,
  // 카카오맵: Place ID가 있으면 전용 길찾기, 없으면 좌표 기반 도착지 길찾기
  kakao: FACILITY.kakaoPlaceId
    ? `https://map.kakao.com/link/to/${FACILITY.kakaoPlaceId}`
    : `https://map.kakao.com/link/to/${encodeURIComponent(FACILITY.name)},${FACILITY.geo.lat},${FACILITY.geo.lng}`,
} as const

/** 공통 대중교통 안내 문구 (특정 노선이 시설 앞에 정차한다고 단정하지 않음) */
export const TRANSIT_NOTE =
  '출발 위치에 따라 이용 가능한 노선이 달라질 수 있습니다. 정확한 대중교통 경로는 네이버지도 또는 카카오맵 길찾기를 이용하시거나 031-856-8090으로 문의해 주세요.'

/** 차량 예상 시간 표기에 함께 쓰는 기준 문구 */
export const CAR_TIME_DISCLAIMER = '평일 기준 원활한 교통 상황, 교통 상황에 따라 달라질 수 있습니다.'

/** 인근을 지나는 대표 버스 예시 (실제 확인된 노선 / 시설 앞 정차 단정 금지) */
export const BUS_EXAMPLES = ['5번', '7번', '12-3번', '25-1번', '31번', '35번', '39번', '108번', '552번']
