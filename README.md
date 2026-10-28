# Mini SMS Gateway

REST API for registering users, charging wallet credits, sending SMS through priority-based mock providers, failing over between providers, and reporting delivery history.

## Requirements

- Node.js 20 or newer
- MongoDB Atlas or another MongoDB deployment that supports transactions
- A MongoDB replica set is required for transaction support

## Setup

```powershell
npm install
```

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sms_gateway
JWT_SECRET=replace-with-a-long-random-secret
PORT=3000
```

Make sure the machine IP is allowed in MongoDB Atlas Network Access, then run:

```powershell
npm run start
```

The API starts at `http://localhost:3000`.

## Authentication

### Register

```http
POST /register
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123"
}
```

Registration creates a wallet with 100 credits and returns a JWT.

### Login

```http
POST /login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Use the returned token on protected routes:

```http
Authorization: Bearer <token>
```

## SMS API

### Send SMS

```http
POST /sms/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": ["9841234567", "+9779801122334"],
  "message": "Your verification code is 123456"
}
```

Numbers are normalized to ten-digit Nepali mobile numbers beginning with 97 or 98. The optional `+977` or `977` prefix is removed. GSM-7 messages use 160 characters for one part and 153 characters per part thereafter. Unicode messages use 70 characters for one part and 67 characters per part thereafter.

Each part costs one credit per recipient. Credits are deducted atomically in a transaction only when the wallet has enough balance. Messages are sent through providers in priority order. A failed provider is skipped and the next provider is tried.

### Message logs

```http
GET /sms/logs?page=1&limit=10&status=sent&number=9841234567
Authorization: Bearer <token>
```

Supported filters are `status`, `date`, `number`, `from`, and `to`.

### Route health

```http
GET /routes/health
Authorization: Bearer <token>
```

The response includes each provider's balance, priority, attempts in the last 24 hours, success rate, and health percentage.

## Providers and failover

Startup seeds `ROUTE_A`, `ROUTE_B`, and `ROUTE_C` when no providers exist. Each provider has a priority, balance, and configurable failure rate. Provider balance deduction uses a conditional atomic update, so concurrent sends cannot debit more balance than the provider owns.

If every provider fails or has insufficient balance, the message is changed from `pending` to `failed` and its cost is refunded in one transaction. The guarded status transition prevents a message from being refunded twice.

## Route health formula

For a route with attempts in the last 24 hours:

```text
balanceScore = min(balance / 100, 1)
health = (successRate * 0.8) + (balanceScore * 0.2)
```

Health is returned as a percentage from 0 to 100. A route with no attempts is reported with a null success rate and a health of 100 when it has a positive balance. A route with zero or negative balance has health 0.

## Known limitations

- Sending is synchronous; a queue such as BullMQ would be better for production.
- Providers are simulated and do not deliver real SMS messages.

