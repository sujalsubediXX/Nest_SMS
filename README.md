# Mini SMS Gateway

A REST API that accepts SMS requests, charges wallet credits, sends the messages through mock providers, and switches to another provider when one fails. If a message fails on every provider, the credits are refunded.

## Features

- Register and log in with JWT. Each user has a wallet with a credit balance.
- Three mock providers (`ROUTE_A`, `ROUTE_B`, `ROUTE_C`) with a priority, a balance, and a failure rate.
- `POST /sms/send` validates numbers, counts SMS parts, charges credits, and sends with failover.
- `GET /sms/logs` returns paginated message history with filters.
- `GET /routes/health` shows each route's balance, success rate, and health.
- Automatic refunds for messages that fail on every route.
- Bonus: per-user rate limiting and unit tests.

## Requirements

- Node.js 20 or newer
- A MongoDB database that supports transactions (MongoDB Atlas works, or any replica set)

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sms_gateway
JWT_SECRET=replace-with-a-long-random-secret
PORT=3000
```

3. If you use MongoDB Atlas, allow your IP address under Network Access.

4. Start the server:

```powershell
npm run start
```

The API runs at `http://localhost:3000`. On startup, the three providers are created automatically if none exist.

### Default providers

| Route | Priority | Starting balance | Failure rate |
|---|---|---|---|
| ROUTE_A | 1 | 1000 | 30% |
| ROUTE_B | 2 | 1000 | 10% |
| ROUTE_C | 3 | 1000 | 5% |

ROUTE_A is tried first and fails often on purpose, so failover is easy to see.

## Running the tests

```powershell
npm test
```

The tests cover the SMS part counter, phone number normalisation, and provider failover and refund logic (with mocked providers). Jest runs in ES module mode, so a Node "ExperimentalWarning" is normal.

## API

All routes except `/register` and `/login` need this header:

```http
Authorization: Bearer <token>
```

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

Creates the user and a wallet with 100 credits, and returns a JWT.

### Login

```http
POST /login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Returns a JWT.

### Send SMS

```http
POST /sms/send
Content-Type: application/json

{
  "to": ["9841234567", "+9779801122334"],
  "message": "Your verification code is 123456"
}
```

Example response:

```json
{
  "encoding": "GSM-7",
  "partsPerMessage": 1,
  "totalCost": 2,
  "results": [
    { "to": "9841234567", "status": "sent", "provider": "ROUTE_B" },
    { "to": "9801122334", "status": "sent", "provider": "ROUTE_A" }
  ]
}
```

Possible errors:

| Status | Reason |
|---|---|
| 400 | `to` is empty or not an array, `message` is missing, or a number is invalid (the invalid numbers are listed in the response) |
| 401 | Missing or invalid token |
| 402 | Not enough credits |
| 429 | Too many requests (see rate limiting) |

**Phone numbers.** A valid number has 10 digits and starts with 97 or 98. A `+977` or `977` prefix is removed.

| Input | Result |
|---|---|
| `9841234567` | `9841234567` |
| `+9779801122334` | `9801122334` |
| `9779761234567` | `9761234567` |
| `9612345678` | invalid (does not start with 97 or 98) |
| `984123456` | invalid (only 9 digits) |

**SMS parts.**

| Encoding | Used when | One SMS | Longer messages |
|---|---|---|---|
| GSM-7 | Only standard characters | 160 characters | parts of 153 |
| Unicode | Any other character (Nepali, emoji) | 70 characters | parts of 67 |

One emoji makes the whole message Unicode. Cost is `parts × number of recipients` (1 credit per part).

### Message logs

```http
GET /sms/logs?page=1&limit=10&status=sent&number=9841234567&date=2026-10-27
```

| Query | Meaning |
|---|---|
| `page`, `limit` | Pagination (default page 1, limit 10, maximum limit 100) |
| `status` | `pending`, `sent`, or `failed` |
| `number` | Phone number (a `+977` prefix is accepted) |
| `date` | A single day, `YYYY-MM-DD` (UTC) |
| `from`, `to` | A date range |

Users only see their own messages. Results are newest first and include `total` and `totalPages`.

### Route health

```http
GET /routes/health
```

Example response:

```json
{
  "windowHours": 24,
  "routes": [
    {
      "route": "ROUTE_A",
      "priority": 1,
      "balance": 962,
      "attemptsLast24h": 54,
      "successRate": 70,
      "health": 76,
      "noData": false
    }
  ]
}
```

## How sending works

1. Validate the body and normalise the phone numbers.
2. Count the parts and calculate the total cost.
3. In one database transaction, deduct the credits and create the messages as `pending`.
4. For each message, try the providers in priority order. Skip a provider that does not have enough balance. If a provider fails, try the next one.
5. On success, mark the message `sent` and record the provider. Every attempt (success or failure) is saved on the message.
6. If every provider fails, mark the message `failed` and refund its credits.

## Route health formula

```text
successRate  = successful attempts / total attempts in the last 24 hours
balanceScore = min(balance / 100, 1)
health       = (successRate × 0.8) + (balanceScore × 0.2)
```

Health is shown as a percentage from 0 to 100.

- Reliability counts for 80% because it matters most for delivery.
- Balance counts for 20% because a route that is almost out of stock is a risk. A balance of 100 or more gives the full score.
- If a route has no attempts in the last 24 hours, `successRate` is `null` and the route is treated as 100% reliable in the formula.
- If the balance is 0, health is 0.

## Decisions I made

- **1 credit per SMS part.** Cost is parts × recipients.
- **Credits are deducted before sending and refunded on failure.** This way parallel requests can never overspend.
- **Insufficient credits returns HTTP 402.** Nothing is stored and no provider is called.
- **Provider balance is only deducted when a send succeeds.** A failed attempt costs the provider nothing.
- **Every attempt is saved.** Route health uses these records, including failed attempts on routes that were retried elsewhere.
- **Route health is global.** It counts attempts from all users because it describes the providers, not one customer.
- **Dates in `/sms/logs` use UTC.**
- **New users start with 100 credits** so the API can be tried straight away.
- **A refund can only happen once.** The message must change from `pending` to `failed` in the same transaction as the refund, so it cannot be refunded twice.

## Protecting credits

- The wallet is charged with a single conditional update (`credits >= cost`), so two parallel requests cannot both spend the same credits.
- The deduction and the creation of the pending messages happen in one transaction, so a crash cannot take credits without creating messages.
- Provider balance is deducted with a conditional update too, so a provider balance cannot go below zero.
- A refund and the status change to `failed` happen in one transaction.

### Checking the main requirement

Give a wallet exactly 10 credits, set every provider's `failureRate` to 0, and fire 20 parallel `POST /sms/send` requests (1 recipient, 1 part each). Exactly 10 return 200, 10 return 402, and the wallet ends at 0.

A script is included:

```powershell
$env:TOKEN="your_jwt_here"; node parallelTest.js
```

To force a refund for a demo, set every provider's `failureRate` to 1, send a message, and check that it is `failed` and the credits are back in the wallet.

## Rate limiting

`POST /sms/send` allows 60 requests per minute per user. Extra requests get HTTP 429 with this body:

```json
{ "error": "Too many requests. Try again in a minute." }
```

## Project structure

```text
controllers/   request handlers (sms, routes health, auth)
models/        Mongoose models (User, Wallet, Message, Provider)
providers/     mock provider class and provider lookup
services/      deliver (failover) and refund logic
utils/         phone number normalisation and SMS part counting
middleware/    auth and rate limiter
tests/         unit tests
```

## What I would improve

- **Use a queue.** Sending is synchronous. A queue such as BullMQ would let the API respond immediately and send in the background.
- **Recover stuck messages.** If the server crashes after credits are deducted but before sending finishes, the message stays `pending`. A background job should retry or refund old pending messages.
- **Reconcile provider balances.** Provider balance deduction and the message status update are separate operations, so a crash between them could leave them out of step.
- **Share rate limit counters.** They are stored in memory, so they reset on restart and are not shared between servers. Redis would fix this.
- **Add delivery reports.** A webhook endpoint could update a message's status after sending.
- **Add Docker Compose.** One command to run the API and database.
- **Add integration tests** for the parallel spending scenario.