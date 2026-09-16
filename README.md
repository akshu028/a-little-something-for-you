# A Little Something For You

A cozy private journal with mood tracking, PostgreSQL login, a monthly "My Little Days" archive, and optional anonymous email delivery.

## 1. Requirements

- Node.js 18+
- PostgreSQL installed and running
- A separate Gmail account for A Little Something with 2-Step Verification enabled
- A Gmail App Password for SMTP

## 2. Create the PostgreSQL database

Create an empty database named `little_something` in PostgreSQL.

For example in psql:

```sql
CREATE DATABASE little_something;
```

The server creates the tables automatically on startup. `database.sql` is also included if you want to create them manually.

## 3. Configure environment variables

Copy `.env.example` to `.env`.

Set:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/little_something
SESSION_SECRET=use_a_long_random_secret
SMTP_USER=alittlesomethingletters@gmail.com
SMTP_PASS=your16characterapppassword
MAIL_FROM="A Little Something <alittlesomethingletters@gmail.com>"
```

For Gmail, **SMTP_PASS must be a Google App Password, not your normal Gmail password**.

Google Account → Security → 2-Step Verification → App passwords → create one → paste the 16-character password into `.env` without spaces.

Never commit `.env`.

## 4. Install and run

```bash
npm install
npm start
```

Open:

`http://localhost:3000`

## 5. Test email before using the UI

When the server starts, you want to see:

```text
✓ PostgreSQL database is ready.
✓ Gmail SMTP connection is ready.
✓ A Little Something is running at http://localhost:3000
```

If SMTP authentication fails, the server will tell you. `EAUTH` / `535` normally means the Gmail App Password is wrong or missing.

## Important privacy note

The recipient should never receive the writer's email address. The app sends letters from a separate, neutral Gmail account dedicated to A Little Something. The writer's email is not used as `From` or `Reply-To`, and the frontend does not send the writer's email to the mail endpoint.

**Important:** create a separate neutral Gmail account for `SMTP_USER` (for example, `alittlesomethingletters@gmail.com`). Do not put your personal Gmail address there. The recipient will see the neutral app sender, not the writer.

This protects the writer from the recipient. It is not a promise that the server/operator or email provider cannot associate a send with the account or infrastructure behind it.
