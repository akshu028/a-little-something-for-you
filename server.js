import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import pg from "pg";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Pool } = pg;

const app = express();
const PORT = Number(process.env.PORT || 3000);

// --------------------------------------------------
// CONFIG
// --------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const MAIL_FROM =
  process.env.MAIL_FROM ||
  "A Little Something <onboarding@resend.dev>";

// --------------------------------------------------
// REQUIRED ENVIRONMENT VARIABLES
// --------------------------------------------------

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is missing. Configure it in your environment variables."
  );
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error(
    "SESSION_SECRET is missing. Configure it in your environment variables."
  );
  process.exit(1);
}

// --------------------------------------------------
// DATABASE
// --------------------------------------------------

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// --------------------------------------------------
// RATE LIMITERS
// --------------------------------------------------

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many letters sent. Please try again later."
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please try again later."
  }
});

// --------------------------------------------------
// EXPRESS
// --------------------------------------------------

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));

// Render runs behind a proxy.
// This lets secure cookies work correctly in production.
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// DATABASE INITIALIZATION
// --------------------------------------------------

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(320) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      content TEXT NOT NULL
        CHECK (char_length(content) BETWEEN 1 AND 5000),
      mood VARCHAR(50) NOT NULL DEFAULT 'unnamed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, entry_date)
    );

    CREATE INDEX IF NOT EXISTS journal_entries_user_id_idx
      ON journal_entries(user_id);

    CREATE INDEX IF NOT EXISTS journal_entries_date_idx
      ON journal_entries(entry_date);
  `);

  console.log("✓ PostgreSQL database is ready.");
}

// --------------------------------------------------
// MOOD EMAIL THEMES
// --------------------------------------------------

const moodEmailThemes = {
  happy: {
    emoji: "☀️",
    soft: "#fbefca",
    accent: "#b97720",
    ink: "#4e3a24",
    line: "#e7d3a5",
    note: "a little brighter"
  },

  hopeful: {
    emoji: "🌱",
    soft: "#e7efdf",
    accent: "#5d7950",
    ink: "#33442e",
    line: "#cbd9bf",
    note: "still growing"
  },

  excited: {
    emoji: "✨",
    soft: "#f0e3f8",
    accent: "#8b5aa8",
    ink: "#44344e",
    line: "#dbc5e9",
    note: "sparkly around the edges"
  },

  peaceful: {
    emoji: "😌",
    soft: "#e5eee9",
    accent: "#648176",
    ink: "#35433e",
    line: "#c8dad2",
    note: "quiet and soft"
  },

  comforted: {
    emoji: "🫂",
    soft: "#f1e3df",
    accent: "#976760",
    ink: "#493735",
    line: "#ddcbc5",
    note: "held a little closer"
  },

  confused: {
    emoji: "💭",
    soft: "#e7eaf3",
    accent: "#697398",
    ink: "#3e4456",
    line: "#ced3e1",
    note: "figuring it out"
  },

  heavy: {
    emoji: "🌧️",
    soft: "#e0e7eb",
    accent: "#5c7280",
    ink: "#38454c",
    line: "#c6d2d8",
    note: "carrying something today"
  },

  sad: {
    emoji: "😔",
    soft: "#e4e8f1",
    accent: "#667493",
    ink: "#3f4654",
    line: "#cbd2e0",
    note: "a little tender"
  },

  numb: {
    emoji: "🫧",
    soft: "#ecece9",
    accent: "#6d6e6a",
    ink: "#454641",
    line: "#d6d6d0",
    note: "feeling very little"
  },

  angry: {
    emoji: "😤",
    soft: "#f5deda",
    accent: "#a4473d",
    ink: "#512f2b",
    line: "#e7c4bf",
    note: "allowed to be mad"
  },

  overwhelmed: {
    emoji: "😵‍💫",
    soft: "#f3e2d6",
    accent: "#9b603b",
    ink: "#503a2e",
    line: "#e3cbbb",
    note: "one thing at a time"
  },

  emotional: {
    emoji: "🥹",
    soft: "#f1dfe9",
    accent: "#925a79",
    ink: "#4f3544",
    line: "#dfc7d4",
    note: "feeling everything"
  }
};

function getMoodTheme(mood) {
  return (
    moodEmailThemes[mood] || {
      emoji: "♡",
      soft: "#f1e9e0",
      accent: "#8a6f59",
      ink: "#3d3028",
      line: "#dfd2c2",
      note: "a little something"
    }
  );
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function cleanEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: "Please sign in first."
    });
  }

  next();
}

function todayISO() {
  const now = new Date();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      database: true,
      resendConfigured: Boolean(RESEND_API_KEY)
    });
  } catch (error) {
    console.error("HEALTH CHECK ERROR:", error);

    res.status(500).json({
      ok: false,
      database: false,
      resendConfigured: Boolean(RESEND_API_KEY),
      error: error.message
    });
  }
});

// --------------------------------------------------
// AUTH — SIGN UP
// --------------------------------------------------

app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!validEmail(email)) {
      return res.status(400).json({
        error: "Please enter a valid email."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email
      `,
      [email, passwordHash]
    );

    req.session.userId = result.rows[0].id;

    res.json({
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "An account with that email already exists."
      });
    }

    console.error("SIGNUP ERROR:", error);

    res.status(500).json({
      error: "Couldn't create your account."
    });
  }
});

// --------------------------------------------------
// AUTH — LOGIN
// --------------------------------------------------

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");

    const result = await pool.query(
      `
      SELECT id, email, password_hash
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    const account = result.rows[0];

    if (
      !account ||
      !(await bcrypt.compare(password, account.password_hash))
    ) {
      return res.status(401).json({
        error: "Email or password is incorrect."
      });
    }

    req.session.userId = account.id;

    res.json({
      user: {
        id: account.id,
        email: account.email
      }
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      error: "Couldn't sign you in."
    });
  }
});

// --------------------------------------------------
// AUTH — LOGOUT
// --------------------------------------------------

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true
    });
  });
});

// --------------------------------------------------
// AUTH — CURRENT USER
// --------------------------------------------------

app.get("/api/auth/me", async (req, res) => {
  if (!req.session.userId) {
    return res.json({
      loggedIn: false,
      user: null
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, email
      FROM users
      WHERE id = $1
      `,
      [req.session.userId]
    );

    if (!result.rows[0]) {
      req.session.destroy(() => {});

      return res.json({
        loggedIn: false,
        user: null
      });
    }

    res.json({
      loggedIn: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("SESSION CHECK ERROR:", error);

    res.status(500).json({
      error: "Couldn't check your session."
    });
  }
});

// --------------------------------------------------
// JOURNAL — GET ENTRIES
// --------------------------------------------------

app.get("/api/entries", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        entry_date,
        content,
        mood,
        created_at,
        updated_at
      FROM journal_entries
      WHERE user_id = $1
      ORDER BY entry_date DESC
      `,
      [req.session.userId]
    );

    res.json({
      entries: result.rows
    });
  } catch (error) {
    console.error("GET ENTRIES ERROR:", error);

    res.status(500).json({
      error: "Couldn't load your little days."
    });
  }
});

// --------------------------------------------------
// JOURNAL — SAVE / UPDATE ENTRY
// --------------------------------------------------

app.post("/api/entries", requireAuth, async (req, res) => {
  try {
    const content = String(req.body.content || "").trim();

    const mood =
      String(req.body.mood || "unnamed")
        .trim()
        .slice(0, 50) || "unnamed";

    const entryDate = String(
      req.body.entryDate || todayISO()
    );

    if (!content) {
      return res.status(400).json({
        error: "Write something first."
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        error:
          "Your note is a little too long. Keep it under 5000 characters."
      });
    }

    const result = await pool.query(
      `
      INSERT INTO journal_entries
        (user_id, entry_date, content, mood)
      VALUES
        ($1, $2, $3, $4)

      ON CONFLICT (user_id, entry_date)
      DO UPDATE SET
        content = EXCLUDED.content,
        mood = EXCLUDED.mood,
        updated_at = CURRENT_TIMESTAMP

      RETURNING
        id,
        entry_date,
        content,
        mood,
        created_at,
        updated_at
      `,
      [
        req.session.userId,
        entryDate,
        content,
        mood
      ]
    );

    res.json({
      entry: result.rows[0]
    });
  } catch (error) {
    console.error("SAVE ENTRY ERROR:", error);

    res.status(500).json({
      error: "Couldn't save your note."
    });
  }
});

// --------------------------------------------------
// JOURNAL — DELETE TODAY
// --------------------------------------------------

app.delete("/api/entries/today", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM journal_entries
      WHERE user_id = $1
      AND entry_date = $2
      `,
      [
        req.session.userId,
        todayISO()
      ]
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error("DELETE ENTRY ERROR:", error);

    res.status(500).json({
      error: "Couldn't delete today's note."
    });
  }
});

// --------------------------------------------------
// SEND LITTLE SOMETHING — RESEND
// --------------------------------------------------

app.post(
  "/api/send-letter",
  emailLimiter,
  async (req, res) => {
    try {
      const recipient = cleanEmail(
        req.body.recipient ||
        req.body.recipientEmail
      );

      const content = String(
        req.body.content || ""
      ).trim();

      const mood = String(
        req.body.mood || ""
      )
        .trim()
        .toLowerCase();

      // ------------------------------
      // VALIDATION
      // ------------------------------

      if (!validEmail(recipient)) {
        return res.status(400).json({
          error:
            "Please enter a valid recipient email."
        });
      }

      if (!content) {
        return res.status(400).json({
          error:
            "There is no little note to send yet."
        });
      }

      if (content.length > 5000) {
        return res.status(400).json({
          error:
            "The note is too long to send."
        });
      }

      if (!RESEND_API_KEY) {
        console.error(
          "RESEND_API_KEY is missing."
        );

        return res.status(500).json({
          error:
            "Email is not configured yet. Add RESEND_API_KEY to your environment variables."
        });
      }

      // ------------------------------
      // MOOD THEME
      // ------------------------------

      const theme = getMoodTheme(mood);

      const moodBlock = mood
        ? `
          <div
            style="
              display:inline-block;
              padding:7px 10px;
              border-radius:999px;
              background:${theme.soft};
              color:${theme.accent};
              font:700 11px Arial,sans-serif;
              letter-spacing:.1em;
              text-transform:uppercase;
            "
          >
            ${theme.emoji}
            &nbsp;&nbsp;
            MOOD · ${escapeHtml(mood)}
          </div>
        `
        : "";

      // ------------------------------
      // EMAIL HTML
      // ------------------------------

      const html = `
<!doctype html>

<html>

<head>
  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >

  <meta
    name="color-scheme"
    content="light only"
  >

  <meta
    name="supported-color-schemes"
    content="light"
  >

  <title>
    A little something for you ♡
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:${theme.soft};
    font-family:Arial,Helvetica,sans-serif;
    color:${theme.ink};
  "
>

  <div
    style="
      width:100%;
      padding:28px 14px;
      box-sizing:border-box;
    "
  >

    <div
      style="
        max-width:620px;
        margin:0 auto;
        background:#fffdf9;
        border:1px solid ${theme.line};
        border-radius:28px;
        overflow:hidden;
        box-shadow:0 14px 36px rgba(50,40,30,.08);
      "
    >

      <div
        style="
          height:9px;
          background:${theme.accent};
        "
      ></div>

      <div
        style="
          padding:34px 32px 32px;
        "
      >

        <div
          style="
            font:700 11px Arial,sans-serif;
            letter-spacing:.18em;
            color:${theme.accent};
            text-transform:uppercase;
          "
        >
          A LITTLE SOMETHING
        </div>

        <div
          style="
            font-size:20px;
            margin-top:10px;
            color:${theme.accent};
          "
        >
          ${theme.emoji}
        </div>

        <h1
          style="
            margin:5px 0 20px;
            font:500 42px Georgia,Times New Roman,serif;
            letter-spacing:-.04em;
            color:${theme.ink};
          "
        >
          for you
          <span style="color:${theme.accent}">
            ♡
          </span>
        </h1>

        ${moodBlock}

        <div
          style="
            height:1px;
            background:${theme.line};
            margin:24px 0;
          "
        ></div>

        <div
          style="
            white-space:pre-wrap;
            font:20px/1.75 Georgia,Times New Roman,serif;
            color:${theme.ink};
          "
        >
          ${escapeHtml(content)}
        </div>

        <div
          style="
            margin-top:28px;
            padding:13px 15px;
            border-radius:16px;
            background:${theme.soft};
            color:${theme.accent};
            font:italic 15px Georgia,Times New Roman,serif;
          "
        >
          ${escapeHtml(theme.note)}.
        </div>

        <div
          style="
            margin-top:28px;
            color:#8a7868;
            font:16px Georgia,Times New Roman,serif;
          "
        >
          — someone who wanted you to know
        </div>

      </div>

    </div>

  </div>

</body>

</html>
`;

      // ------------------------------
      // SEND THROUGH RESEND API
      // ------------------------------

      const response = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${RESEND_API_KEY}`,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            from: MAIL_FROM,

            to: [recipient],

            subject:
              "A little something for you ♡",

            text:
              `${mood ? `Mood: ${mood}\n\n` : ""}` +
              `${content}\n\n` +
              `— someone who wanted you to know`,

            html
          })
        }
      );

      const result =
        await response.json().catch(() => ({}));

      // ------------------------------
      // RESEND ERROR
      // ------------------------------

      if (!response.ok) {
        console.error(
          "RESEND ERROR:",
          result
        );

        return res.status(500).json({
          success: false,

          error:
            result?.message ||
            result?.error ||
            "The email couldn't be sent."
        });
      }

      // ------------------------------
      // SUCCESS
      // ------------------------------

      console.log(
        "✓ Anonymous letter sent:",
        result.id
      );

      res.json({
        success: true,

        message:
          "Your little letter is on its way ♡"
      });

    } catch (error) {

      console.error(
        "EMAIL SEND ERROR:",
        {
          name: error?.name,
          message: error?.message,
          stack: error?.stack
        }
      );

      res.status(500).json({
        success: false,

        error:
          error?.message ||
          "The email couldn't be sent."
      });
    }
  }
);

// --------------------------------------------------
// SERVE WEBSITE
// --------------------------------------------------

app.get("/", (_req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

initDatabase()
  .then(() => {
    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `✓ A Little Something is running on port ${PORT}`
        );

        console.log(
          `✓ Resend configured: ${Boolean(RESEND_API_KEY)}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "✗ Database startup failed:",
      error.message
    );

    process.exit(1);
  });