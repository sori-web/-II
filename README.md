# 네이버 커머스API 고정 IP 프록시 서버

Lovable / Cloudflare Workers는 outbound IP가 매 요청마다 달라져 네이버 커머스API의 IP 허용 정책을 통과할 수 없습니다. 이 폴더는 **고정 IP를 가진 작은 Node.js 서버**로, Lovable에서 들어오는 요청을 받아 네이버 API에 그대로 전달합니다.

```
[Lovable] --HTTPS--> [이 프록시 서버 (고정 IP)] --HTTPS--> [api.commerce.naver.com]
```

## 1. Railway에 배포 (가장 쉬움 — 5분)

1. 이 `proxy-server/` 폴더를 별도 GitHub 저장소에 푸시 (또는 `Deploy from local` 사용)
2. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → 해당 저장소 선택
3. **Settings → Networking → Static Outbound IP** 토글 ON ($3/월 추가)
   - 표시되는 고정 IPv4 주소를 **메모** (예: `35.x.x.x`)
4. **Variables** 탭에서 환경변수 추가:
   - `PROXY_TOKEN` — 임의의 긴 랜덤 문자열 (예: `openssl rand -hex 32` 결과)
   - (선택) `ALLOW_HOSTS=api.commerce.naver.com`
5. 배포 완료되면 **Settings → Networking → Generate Domain** 클릭
   - 발급된 URL을 메모 (예: `https://naver-proxy-production.up.railway.app`)

## 2. 네이버 커머스API 센터에 고정 IP 등록

1. [네이버 커머스 솔루션 API 센터](https://apicenter.commerce.naver.com/) 로그인
2. **내 애플리케이션** → 해당 앱 → **호출 가능 IP 관리**
3. 위에서 메모한 Railway 고정 IP를 추가하고 저장

> 확인: 프록시 URL의 `/health` 엔드포인트를 브라우저에서 열면 `{ "ok": true, "outbound_ip": "35.x.x.x" }` 가 나옵니다. 그 IP가 네이버에 등록한 IP와 일치해야 합니다.

## 3. Lovable에 프록시 정보 등록

Lovable Cloud의 시크릿에 두 값을 추가:

| 시크릿 이름 | 값 |
|---|---|
| `NAVER_PROXY_URL` | Railway에서 발급받은 도메인 (예: `https://naver-proxy-production.up.railway.app`) |
| `NAVER_PROXY_TOKEN` | 위에서 설정한 `PROXY_TOKEN`과 동일한 값 |

두 시크릿이 설정되면 Pricepulse의 모든 네이버 API 호출(토큰 발급 + 상품 조회)이 자동으로 이 프록시를 경유합니다. 시크릿이 없으면 기존처럼 Lovable에서 직접 호출하므로(주의: IP 차단됨), 둘 다 반드시 설정해야 합니다.

## 다중 사용자 동작

사용자별 Client ID / Client Secret은 그대로 Lovable DB(`naver_commerce_accounts`)에 저장됩니다. 프록시는 단순히 HTTP를 전달만 할 뿐, 사용자 자격증명을 저장하거나 알지 못합니다. 따라서 한 대의 프록시 서버가 **모든 사용자**의 요청을 같은 고정 IP에서 내보냅니다. 네이버 입장에서는 모두 같은 IP에서 들어오는 호출로 보이지만, 각 요청에는 사용자별 OAuth 토큰이 실려 있어 사용자별 데이터가 올바르게 처리됩니다.

## 다른 호스팅 옵션

| 옵션 | 설정 난이도 | 비고 |
|---|---|---|
| **Railway** ⭐ 추천 | ★ | Static Outbound IP 토글 한 번, GitHub 푸시 |
| Render | ★★ | 유료 플랜(Starter $7/월 이상) 필요, Outbound IP는 Dashboard에 표시 |
| Cafe24 가상서버 | ★★★ | 한국 IP라 네이버 호환성 가장 좋음. Node 18 설치 후 `pm2 start server.js` |
| AWS EC2 + Elastic IP | ★★★★ | t4g.nano + EIP, 보안그룹/SSH 키 등 설정 항목 多 |

## 로컬 테스트

```bash
cd proxy-server
npm install
PROXY_TOKEN=test-secret node server.js
# 다른 터미널
curl http://localhost:8080/health
```
