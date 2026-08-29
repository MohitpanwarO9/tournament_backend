# Tournament Backend

Node.js + Express + Firebase Realtime Database backend for the tournament frontend.

## 1. Install

```bash
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env`.

Set:

- `JWT_SECRET` to a long random secret.
- `CLIENT_ORIGIN` to the URL where your frontend runs.
- `ADMIN_PASSWORD_HASHES` to the SHA-256 hash currently used by your frontend.
- Firebase Admin SDK credentials.

For Firebase credentials, download a service-account JSON from Firebase/Google Cloud and either:

- put its JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`, or
- set `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json`.

Do NOT put a Firebase service-account JSON into your frontend.

## 3. Start

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## 4. API

### Public

```text
GET /api/health
GET /api/tournament
GET /api/tournament/state
GET /api/tournament/standings/A
GET /api/tournament/standings/B
GET /api/tournament/wildcards
GET /api/tournament/quarter-finals
GET /api/tournament/knockout
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "password": "YOUR_PASSWORD"
}
```

Response:

```json
{
  "token": "...",
  "role": "admin"
}
```

Use:

```http
Authorization: Bearer YOUR_TOKEN
```

for admin endpoints.

### Save a pool match

```http
POST /api/tournament/matches/A/m0
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "s1": 21,
  "s2": 15
}
```

Use `B`, `QA`, or `QB` for other pool stages.

### Edit a completed pool match

```http
PATCH /api/tournament/matches/A/m0
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "s1": 21,
  "s2": 17
}
```

### Save knockout match

```http
POST /api/tournament/knockout/q1
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "s1": 21,
  "s2": 18
}
```

Valid IDs: `q1`, `elim`, `q2`, `final`.

### Edit knockout match

```http
PATCH /api/tournament/knockout/q1
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "s1": 21,
  "s2": 19
}
```

### Reset

```http
POST /api/tournament/reset
Authorization: Bearer YOUR_TOKEN
```

## Notes

The backend preserves the tournament rules currently implemented by the uploaded script:

- Pool A and Pool B players
- Round-robin scheduling
- 2 points per win
- NRR/PR/PF tie-breaking order
- wildcard ranking
- QF seed arrangement
- semifinal / qualifier / eliminator progression
- grand final and champion calculation

The frontend should no longer contain admin authorization logic or write directly to Firebase.
