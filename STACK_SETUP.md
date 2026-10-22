# 신규 프로젝트 환경 세팅 가이드

모여봄(MoyeoBom)에서 쓴 기술 스택을 그대로 새 프로젝트에 올리기 위한 문서다.
모여봄은 처음에 `views/*.ejs` 서버 렌더링으로 시작해 나중에 `frontend/`(React + Vite)로
마이그레이션했는데, **이 문서는 마이그레이션 이후 구성만 다룬다.** 즉 EJS·뷰 엔진은 쓰지 않고
백엔드는 JSON API만 내려주는 구조로 처음부터 시작한다.

```
새 프로젝트/
├── (루트)      Express + MongoDB  →  JSON API 서버        :3000
└── frontend/   React + Vite       →  화면 전부 (SPA)       :5173
```

---

## 1. 기술 스택

### 백엔드 (루트)

| 분류 | 패키지 | 버전 |
|------|--------|------|
| 런타임 | Node.js | 22.x (개발 시 v22.21.1) |
| 서버 | express | ^4.19.2 |
| DB | mongoose (MongoDB) | ^8.3.3 |
| 인증 | passport, passport-local, passport-google-oauth20, passport-naver-v2 | ^0.7.0 / ^1.0.0 / ^2.0.0 / ^2.0.8 |
| 비밀번호 | bcrypt | ^5.1.1 |
| 세션 | express-session | ^1.18.0 |
| CORS | cors | ^2.8.6 |
| 실시간 | socket.io | ^4.8.3 |
| 파일 업로드 | multer | ^1.4.5-lts.1 |
| 검증 | express-validator | ^7.0.1 |
| 스케줄러 | node-cron | ^4.2.1 |
| 외부 API 호출 | axios | ^1.16.0 |
| 환경변수 | dotenv | ^16.4.5 |
| 개발 | nodemon | ^3.1.0 |

> 모듈 방식은 **CommonJS**(`require`). `package.json`에 `"type": "commonjs"`를 적거나 생략한다.
> 프론트엔드와 반대이므로 헷갈리지 않게 주의.

### 프론트엔드 (`frontend/`)

| 분류 | 패키지 | 버전 |
|------|--------|------|
| 라이브러리 | react, react-dom | ^19.1.0 |
| 빌드 도구 | vite | ^6.3.5 |
| React 플러그인 | @vitejs/plugin-react | ^4.4.1 |
| 라우팅 | react-router-dom | ^7.0.2 |
| 실시간 | socket.io-client | ^4.8.3 |
| 린트 | eslint ^9.25.0, @eslint/js, eslint-plugin-react-hooks ^5.2.0, eslint-plugin-react-refresh ^0.4.19, globals ^16.0.0 | |
| CSS 프레임워크 | Bootstrap 5.3.3 (**npm 설치 안 함 / CDN**) | |
| 한글 폰트 | Pretendard v1.3.9 (CDN, 동적 서브셋) | |
| 지도 | 카카오 지도 JS SDK (런타임에 script 주입) | |

> 모듈 방식은 **ESM**(`import`). `frontend/package.json`에 `"type": "module"`이 필요하다.
> 상태관리 라이브러리(Redux, Zustand 등)와 데이터 패칭 라이브러리(React Query 등)는 쓰지 않았다.
> 인증 상태는 Context API, 서버 호출은 `fetch` 래퍼(`src/api.js`)로 처리한다.

---

## 2. 사전 준비물

1. **Node.js 22.x** (`node -v`로 확인)
2. **MongoDB** — 로컬 설치 또는 MongoDB Atlas 클러스터 (연결 문자열 필요)
3. **API 키** (쓸 기능만 준비하면 된다)
   - 카카오 개발자센터: JavaScript 키(지도), REST API 키(로컬 검색)
   - 서울 열린데이터광장: 실시간 도시데이터 / 문화행사 인증키
   - Google Cloud Console: OAuth 2.0 클라이언트 ID / Secret
   - 네이버 개발자센터: 애플리케이션 Client ID / Secret

> 소셜 로그인 콘솔에 등록할 **Redirect URI**는 백엔드 주소다. 프론트(5173)가 아니라
> `http://localhost:3000/api/auth/google/callback`, `http://localhost:3000/api/auth/naver/callback`.

---

## 3. 최종 디렉터리 구조

```text
새 프로젝트/
├── app.js                  # Express 진입점, Socket.IO 바인딩, 라우터 등록
├── .env                    # 비밀값 (git 제외)
├── .env_sample             # 키 이름만 적은 템플릿 (git 포함)
├── package.json
├── config/
│   ├── database.js         # mongoose 연결
│   ├── passport.js         # local / google / naver 전략
│   └── upload.js           # multer 설정 (프로필·게시글)
├── controllers/            # 라우트별 요청·응답 처리
├── middlewares/
│   ├── authMiddleware.js   # 로그인 확인
│   ├── apiErrorMiddleware.js  # /api/* 전용 JSON 에러 응답
│   ├── errorMiddleware.js  # 404 / 500
│   └── validationMiddleware.js # express-validator 결과 처리
├── models/                 # mongoose 스키마
├── routes/
│   └── api/                # React가 호출하는 JSON 라우터만 둔다
├── services/              # 외부 API 통신, DB 쿼리 로직
├── schedulers/            # node-cron 주기 작업
├── scripts/               # 수동 실행 시드 스크립트
├── public/                # 업로드 이미지 등 정적 파일
│   └── images/{profile,upload}/
└── frontend/
    ├── .env                # VITE_* 변수 (git 제외)
    ├── .env_example
    ├── index.html          # Bootstrap·Pretendard CDN, #root
    ├── vite.config.js
    ├── eslint.config.js
    ├── package.json
    ├── public/
    └── src/
        ├── main.jsx        # createRoot + BrowserRouter + AuthProvider
        ├── App.jsx         # 전체 라우팅
        ├── api.js          # fetch 래퍼 (apiGet/apiPost/apiPatch/apiDelete/apiPostForm)
        ├── index.css
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx, Navbar.jsx, Footer.jsx, ScrollToTop.jsx, ErrorMessage.jsx
        │   ├── common/     # 여러 도메인이 같이 쓰는 조각
        │   └── <도메인>/    # 도메인별 카드·폼·행
        ├── pages/
        │   └── <도메인>/
        │       ├── routes.jsx   # 해당 도메인 하위 라우트 묶음
        │       └── List.jsx, Detail.jsx, ...
        ├── data/           # API 호출 함수 + 목업 데이터
        ├── utils/          # 날짜 포맷, 외부 SDK 로더 등
        └── styles/         # 추가 CSS
```

---

## 4. 백엔드 세팅

### 4-1. 프로젝트 생성 및 패키지 설치

```bash
mkdir my-project && cd my-project
npm init -y

npm i express mongoose dotenv cors express-session express-validator \
      passport passport-local passport-google-oauth20 passport-naver-v2 \
      bcrypt multer socket.io node-cron axios
npm i -D nodemon
```

### 4-2. `package.json` 스크립트

```json
{
  "main": "app.js",
  "type": "commonjs",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  }
}
```

시드 스크립트가 생기면 `"seed:places": "node scripts/seedPlaces.js"` 처럼 추가한다.

### 4-3. 폴더 뼈대

```bash
mkdir -p config controllers middlewares models routes/api services schedulers scripts public/images/profile public/images/upload
```

> `public/images/profile`, `public/images/upload`는 **미리 만들어 둬야 한다.** multer의
> `diskStorage`는 폴더를 자동 생성하지 않아서, 없으면 첫 업로드에서 ENOENT로 실패한다.

### 4-4. `.env` / `.env_sample`

`.env_sample`(git에 커밋, 값은 비움):

```env
MONGODB_URI=
SESSION_SECRET=
KAKAO_MAP_API=
KAKAO_REST_API=
SEOUL_RTD_API=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
FRONTEND_URL=http://localhost:5173
```

`.env`는 같은 키에 실제 값을 넣고 **절대 커밋하지 않는다**(`.gitignore`에 `.env`).

`FRONTEND_URL`은 CORS 허용 origin, Socket.IO CORS, 소셜 로그인 후 리다이렉트 대상 세 곳에서
같이 쓰이므로 반드시 채운다.

### 4-5. `config/database.js`

```js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined in .env file');
    await mongoose.connect(uri);
    console.log('MongoDB 연결 성공');
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### 4-6. `config/upload.js` (multer)

```js
const multer = require('multer');
const path = require('path');

const makeFileName = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  cb(null, Date.now() + ext);          // 업로드 시각 + 확장자
};

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('이미지 파일만 업로드 가능합니다'));
};

const uploadProfile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images/profile'),
    filename: makeFileName,
  }),
  limits: { fileSize: 5 * 1024 * 1024 },     // 프로필 5MB
  fileFilter: imageFilter,
});

const uploadBoard = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images/upload'),
    filename: makeFileName,
  }),
  limits: { fileSize: 20 * 1024 * 1024 },    // 게시글 20MB
  fileFilter: imageFilter,
});

module.exports = { uploadProfile, uploadBoard };
```

### 4-7. `middlewares/apiErrorMiddleware.js`

React만 쓰는 구조라도 **에러 응답은 JSON이어야** 프론트의 `api.js`가 메시지를 꺼내 쓸 수 있다.

```js
const apiErrorHandler = (err, req, res, next) => {
  console.error(`[API ${req.method} ${req.originalUrl}]`);
  console.error(err.stack);

  let statusCode = err.status || 500;
  // 서비스 계층에서 "찾을 수 없습니다"로 던진 에러는 404로 매핑
  if (!err.status && typeof err.message === 'string' && err.message.includes('찾을 수 없습니다')) {
    statusCode = 404;
  }

  res.status(statusCode).json({ success: false, message: err.message || '서버 오류가 발생했습니다' });
};

module.exports = { apiErrorHandler };
```

### 4-8. `middlewares/authMiddleware.js`

EJS 때는 로그인 미인증 시 `confirm()` 스크립트를 내려보냈지만, SPA에서는 **401 JSON만** 내려주고
화면 이동은 프론트가 결정한다.

```js
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ success: false, authRequired: true, message: '로그인이 필요합니다.' });
};

module.exports = { isLoggedIn };
```

### 4-9. `app.js`

```js
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const connectDB = require('./config/database');
const passport = require('./config/passport');
const { apiErrorHandler } = require('./middlewares/apiErrorMiddleware');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Socket.IO — Vite 개발 서버에서 붙을 수 있도록 Express와 같은 origin 허용
const io = new Server(server, { cors: { origin: FRONTEND_URL, credentials: true } });
app.set('io', io);   // 컨트롤러에서 req.app.get('io')로 꺼내 쓴다

connectDB();

// 미들웨어
app.use(cors({ origin: FRONTEND_URL, credentials: true }));   // credentials 필수 (세션 쿠키)
app.use(express.static(path.join(__dirname, 'public')));      // 업로드 이미지 서빙
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 세션
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_key',
  resave: false,
  saveUninitialized: false,
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// 라우터 — 전부 /api/* 아래
app.use('/api/auth', require('./routes/api/authApiRouter'));
// app.use('/api/member', require('./routes/api/memberApiRouter'));
// ...

// Socket.IO 연결 — 룸 기반 알림
io.on('connection', (socket) => {
  socket.on('joinDistrict', (district) => district && socket.join(district));
  socket.on('joinUser', (userId) => userId && socket.join(`user:${userId}`));
});

// 에러 핸들링 — 라우터 등록 뒤에 와야 한다
app.use('/api', apiErrorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`오류: ${PORT}번 포트가 이미 사용 중입니다.`);
  else console.error('서버 시작 중 오류 발생:', err);
});
```

**EJS 구성과 달라진 점** — 다음 줄들은 넣지 않는다.

```js
app.set('view engine', 'ejs');                 // ✕ 뷰 엔진 없음
app.set('views', path.join(__dirname, 'views'));  // ✕
app.use(errorHandler);                         // ✕ error/404.ejs 렌더링용이었음
// res.locals.user / res.locals.formatMeetingDate 같은 전역 변수 미들웨어도 ✕
// → 로그인 사용자 정보는 GET /api/auth/me 로, 날짜 포맷은 프론트 utils/ 로 옮긴다
```

### 4-10. API 라우터 작성 규칙

모여봄에서 `routes/api/*`를 짜며 정착한 규칙들이다.

- **응답 형태를 통일한다.** 성공 `{ success: true, ...data }`, 실패 `{ success: false, message }`.
- **"로그인 안 됨"은 에러가 아니다.** `GET /api/auth/me`는 미로그인 시에도 200으로
  `{ success: true, user: null }`을 준다. 프론트가 최초 세션 확인에 쓰기 때문이다.
- **사용자 객체는 화이트리스트로 직렬화한다.** `toPublicUser(user)` 같은 함수를 만들어
  내려줄 필드만 고른다. mongoose 도큐먼트를 그대로 넘기면 `password`가 새어 나간다.
- **필드별 검증 오류는 `fieldErrors`로** 내려준다: `{ success: false, fieldErrors: { nickname: '중복입니다' } }`.
  프론트 폼이 입력칸 아래에 바로 붙일 수 있다.
- **소셜 로그인 전략은 API용으로 따로 등록한다.** passport 전략은 콜백 URL을 하나만 가질 수 있어서,
  `google`/`naver` 외에 콜백이 `/api/auth/google/callback`인 `google-api`/`naver-api` 전략을
  별도로 `passport.use()` 한다. 검증 로직은 공용 함수(`googleVerify`)로 재사용한다.
- **소셜 로그인은 fetch가 아니라 브라우저 이동이다.** 전체 페이지 리다이렉트 플로우이므로
  프론트에서 `<a href={`${API_BASE_URL}/api/auth/google`}>`로 걸고, 콜백이 끝나면 백엔드가
  `res.redirect(FRONTEND_URL)`로 SPA에 돌려보낸다.
- **신규 소셜 사용자**는 DB에 바로 넣지 않고 `req.session.socialData`에 담아두고
  `FRONTEND_URL/member/social-join`으로 보낸다. 추가 정보 입력 후 가입이 완료된다.

---

## 5. 프론트엔드 세팅

### 5-1. 생성 및 패키지 설치

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm i react-router-dom socket.io-client
```

`--template react`(JavaScript + Babel)를 쓴다. TypeScript도, `react-swc`도 아니다.

### 5-2. `vite.config.js`

기본 생성된 그대로 둔다. **프록시를 설정하지 않는다** — API 주소는
`VITE_API_BASE_URL` 환경변수로 절대 URL을 쓰고, 쿠키는 `credentials: 'include'`로 보낸다.

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### 5-3. `frontend/.env` / `.env_example`

```env
# 백엔드 API 주소
VITE_API_BASE_URL=http://localhost:3000

# 카카오 지도 JS SDK 키
VITE_KAKAO_MAP_API=
```

Vite는 **`VITE_` 접두사가 붙은 변수만** 클라이언트에 노출한다. 반대로 말하면 여기 넣는 값은
전부 브라우저에서 보인다. DB 접속 정보나 OAuth Secret은 절대 넣지 말고 루트 `.env`에만 둔다.

### 5-4. `index.html`

Bootstrap과 한글 폰트를 CDN으로 싣는다(npm 설치 안 함).

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>프로젝트명</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
    <!-- 한글 본문용 Pretendard. 동적 서브셋이라 필요한 글자만 받는다 -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
    />
  </head>
  <body>
    <div id="root"></div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

> `index.css`에서 `font-family`로 폰트 이름만 지정하고 CDN 링크를 빼먹으면 시스템 폰트로
> 조용히 떨어진다. 모여봄에서 한참 뒤에 발견한 실수라 따로 적어둔다.

> Bootstrap JS 번들은 드롭다운·모달·오프캔버스를 쓸 때 필요하다. React에서 모달을
> 직접 제어할 거면 `bootstrap` npm 패키지를 설치해 `import`하는 쪽이 깔끔하다.

### 5-5. `src/api.js` — fetch 래퍼

모든 서버 호출의 입구다. 메서드별로 `apiGet`, `apiPost`, `apiPatch`, `apiDelete`,
`apiPostForm`(FormData/파일 업로드)을 둔다. 공통 사항 세 가지:

1. `credentials: 'include'` — 세션 쿠키를 실어야 로그인이 유지된다.
2. 네트워크 자체 실패(백엔드 꺼짐)와 HTTP 에러 응답을 구분해 각각 한국어 메시지로 던진다.
3. 에러 객체에 `status`, `fieldErrors`를 붙여 호출하는 쪽이 분기할 수 있게 한다.

```js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export async function apiGet(path, { params } = {}) {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    })
  }

  let res
  try {
    res = await fetch(url, { credentials: 'include' })
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.')
  }

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const error = new Error(body?.message || `요청에 실패했습니다 (${res.status})`)
    error.status = res.status
    throw error
  }
  return body
}

// apiPost / apiPatch / apiDelete — method, headers, JSON.stringify(body)만 다르고 나머지 동일
// apiPostForm — headers를 지정하지 않는다 (브라우저가 multipart boundary를 직접 붙인다)
```

> `apiPostForm`에서 `Content-Type`을 직접 넣으면 boundary가 빠져 서버가 파싱에 실패한다.
> FormData를 보낼 때는 헤더를 건드리지 않는다.

### 5-6. `src/context/AuthContext.jsx` — 인증 상태

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)   // 최초 세션 확인 중인지

  useEffect(() => {
    let cancelled = false
    apiGet('/api/auth/me')
      .then((data) => { if (!cancelled) setUser(data.user) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setAuthLoading(false) })
    return () => { cancelled = true }
  }, [])

  const login = async (email, password) => {
    const data = await apiPost('/api/auth/login', { email, password })
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    await apiPost('/api/auth/logout')
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const data = await apiGet('/api/auth/me')
      setUser(data.user)
    } catch { setUser(null) }
  }

  return (
    <AuthContext.Provider value={{ user, authLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  return context
}
```

`authLoading`이 핵심이다. 이게 없으면 세션 확인이 끝나기 전에 `user === null`로 한 프레임
그려져서, 로그인한 사용자에게 로그인 화면이 깜빡이거나 보호된 화면에서 튕겨 나간다.

### 5-7. `src/main.jsx` — 프로바이더 순서

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

CSS를 여러 개 import할 때는 **나중에 쓴 파일이 앞 파일을 덮는다.** 덮어쓰는 쪽을 뒤에 둔다.

### 5-8. `src/App.jsx` — 라우팅

도메인별 하위 라우트를 `pages/<도메인>/routes.jsx`로 쪼개고 `App.jsx`에서 조립한다.
화면이 늘어도 `App.jsx`가 길어지지 않는다.

```jsx
// pages/event/routes.jsx
import { Route } from 'react-router-dom'
import List from './List'
import Detail from './Detail'

const eventRoutes = (
  <>
    <Route index element={<List />} />
    <Route path=":id" element={<Detail />} />
  </>
)
export default eventRoutes
```

```jsx
// App.jsx
function App() {
  const { authLoading } = useAuth()

  // 최초 세션 확인이 끝나기 전엔 대기 화면
  if (authLoading) return <div className="text-center text-muted py-5">불러오는 중...</div>

  return (
    <>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="event" element={<Outlet />}>{eventRoutes}</Route>
          <Route path="member" element={<Outlet />}>{memberRoutes}</Route>
          <Route path="*" element={<ErrorMessage />} />
        </Routes>
      </Layout>
    </>
  )
}
```

`ScrollToTop`은 라우트 전환 시 스크롤을 맨 위로 올리는 컴포넌트다. SPA는 기본적으로
스크롤 위치를 유지해서, 목록 중간에서 상세로 들어가면 상세 페이지도 중간부터 보인다.

### 5-9. `src/data/` — 데이터 레이어 + 목업 스위치

백엔드 API가 아직 없을 때 화면을 먼저 만들 수 있게, 목업/실 API를 한 곳에서 전환한다.

```js
// data/config.js
export const USE_MOCK = true      // 백엔드가 붙으면 false 한 줄만 바꾼다
export const MOCK_DELAY_MS = 260  // 목업도 살짝 늦춰서 로딩 상태를 실제로 보게 한다

export function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

```js
// data/events.js
import { USE_MOCK, delay } from './config'
import { apiGet } from '../api'
import mockEvents from './mock/events'

export async function fetchEvents(params) {
  if (USE_MOCK) {
    await delay()
    return mockEvents
  }
  const { events } = await apiGet('/api/event/list', { params })
  return events
}
```

이게 돌아가게 하는 전제는 **목업 객체의 필드 이름을 mongoose 스키마와 똑같이 맞추는 것**이다.
어긋나면 `USE_MOCK = false`로 바꾼 순간 화면 코드를 전부 고쳐야 한다.

### 5-10. `src/utils/` — 외부 SDK 로더

카카오 지도처럼 런타임에 script를 주입하는 SDK는 **Promise를 모듈 레벨에 캐싱**해서
중복 로드를 막는다. StrictMode에서 effect가 두 번 실행되기 때문에 이게 없으면 스크립트가
두 번 붙는다.

```js
// utils/loadKakaoMaps.js
let loadPromise = null

export function loadKakaoMaps() {
  if (window.kakao?.maps) return Promise.resolve(window.kakao)
  if (loadPromise) return loadPromise

  const appKey = import.meta.env.VITE_KAKAO_MAP_API

  loadPromise = new Promise((resolve, reject) => {
    if (!appKey) {
      reject(new Error('카카오 지도 API 키(VITE_KAKAO_MAP_API)가 설정되지 않았습니다.'))
      return
    }
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = () => reject(new Error('카카오 지도 스크립트를 불러오지 못했습니다.'))
    document.head.appendChild(script)
  })

  return loadPromise
}
```

`autoload=false` + `kakao.maps.load()` 조합이 필요하다. 이걸 빼면 `kakao.maps`가
준비되기 전에 접근해서 터진다.

### 5-11. Socket.IO 클라이언트

```jsx
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../api'
import { useAuth } from '../context/AuthContext'

function Notifications() {
  const { user } = useAuth()

  useEffect(() => {
    const socket = io(API_BASE_URL, { withCredentials: true })
    if (user) socket.emit('joinUser', user.id)
    socket.on('newFeedAlert', (payload) => { /* 토스트 띄우기 등 */ })

    return () => socket.disconnect()   // 정리 필수 — 안 하면 연결이 쌓인다
  }, [user])
}
```

### 5-12. `eslint.config.js`

Vite 템플릿 기본값에서 `no-unused-vars` 규칙만 조정했다.

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
```

---

## 6. 실행

터미널 **두 개**가 필요하다.

```bash
# 터미널 1 — 백엔드
npm run dev          # nodemon → http://localhost:3000

# 터미널 2 — 프론트엔드
cd frontend
npm run dev          # vite → http://localhost:5173
```

브라우저로는 **5173**에 접속한다. 3000은 JSON API만 내려준다.

빌드:

```bash
cd frontend && npm run build   # → frontend/dist
```

---

## 7. 자주 막히는 지점

| 증상 | 원인 / 해결 |
|------|-------------|
| 로그인은 성공하는데 새로고침하면 풀린다 | 쿠키가 안 실린다. 프론트 모든 요청에 `credentials: 'include'`, 백엔드 cors에 `credentials: true` + 정확한 `origin`(`*` 불가). |
| CORS 에러 | `FRONTEND_URL`이 브라우저 주소와 정확히 일치해야 한다. `localhost`와 `127.0.0.1`은 다른 origin이다. |
| 소셜 로그인 후 백엔드 주소에 머문다 | 콜백 라우트 끝에 `res.redirect(FRONTEND_URL)`이 있는지, OAuth 콘솔의 Redirect URI가 `:3000/api/auth/.../callback`인지 확인. |
| 새로고침하면 404 | SPA 라우팅 문제. 개발 중엔 Vite가 처리해 주지만, 배포 시엔 서버에서 모든 경로를 `index.html`로 폴백시켜야 한다. |
| 파일 업로드가 ENOENT로 실패 | `public/images/profile`, `public/images/upload` 폴더가 없다. multer는 폴더를 만들어주지 않는다. |
| `import.meta.env.XXX`가 undefined | `VITE_` 접두사가 없거나, `.env` 수정 후 Vite 개발 서버를 재시작하지 않았다. |
| 서버 재시작하면 전원 로그아웃 | `express-session`이 기본 MemoryStore를 쓴다. 운영에선 `connect-mongo`로 세션을 MongoDB에 저장한다. |
| effect가 두 번 실행된다 | StrictMode의 정상 동작이다. 정리 함수(cleanup)를 반드시 쓰고, SDK 로더는 Promise를 캐싱한다. |
| EJS 때 쓰던 `res.locals.user`가 없다 | SPA에선 서버가 화면을 안 만든다. 로그인 정보는 `GET /api/auth/me`, 날짜 포맷은 프론트 `utils/`로 옮긴다. |

---

## 8. 처음부터 다시 한다면 (모여봄 회고)

- **세션 스토어를 처음부터 `connect-mongo`로** 깔아두기. nodemon이 재시작할 때마다
  로그인이 풀려서 개발 내내 불편했다.
- **라우터를 EJS용/API용으로 이중 운영하지 않기.** 마이그레이션 중엔 어쩔 수 없었지만,
  새로 시작하면 `routes/api/*` 하나로 끝낸다. 같은 로직을 두 벌 유지하는 비용이 크다.
- **목업 필드 이름을 스키마와 맞추는 규칙을 처음에 못 박기.** 지키면 `USE_MOCK` 한 줄로
  전환되고, 안 지키면 화면을 다시 쓴다.
- **공통 컴포넌트 추출을 미루지 않기.** 카드·빈 상태·섹션 헤더처럼 반복되는 조각은
  바로 `components/common/`으로 올린다.
- **TypeScript를 고민해 보기.** 모여봄은 JS로 갔지만, API 응답 형태가 늘어나면서
  필드 이름 오타로 디버깅한 시간이 적지 않았다.
