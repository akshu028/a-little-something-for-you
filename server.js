import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import pg from "pg";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

dotenv.config();
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "A Little Something <onboarding@resend.dev>";


const { Pool } =
  pg;

const app =
  express();

const PORT =
  Number(
    process.env.PORT || 3000
  );


/* =========================================================
   ENV
   ========================================================= */

if (!process.env.DATABASE_URL) {

  console.error(
    "DATABASE_URL is missing from .env."
  );

  process.exit(1);

}


if (!process.env.SESSION_SECRET) {

  console.error(
    "SESSION_SECRET is missing from .env."
  );

  process.exit(1);

}


/* =========================================================
   DATABASE
   ========================================================= */

const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL
  });


pool.on(
  "error",
  (error) => {

    console.error(
      "PostgreSQL pool error:",
      error
    );

  }
);


/* =========================================================
   RATE LIMITING
   ========================================================= */

const emailLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    max:
      5,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      error:
        "Too many letters sent. Please try again later."
    }

  });


const authLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    max:
      20,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      error:
        "Too many attempts. Please try again later."
    }

  });


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
  express.json({
    limit:
      "100kb"
  })
);


app.use(
  express.urlencoded({
    extended:
      false
  })
);


app.use(
  session({

    secret:
      process.env.SESSION_SECRET,

    resave:
      false,

    saveUninitialized:
      false,

    cookie: {

      httpOnly:
        true,

      sameSite:
        "lax",

      secure:
        false,

      maxAge:
        1000 *
        60 *
        60 *
        24 *
        30

    }

  })
);


app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/* =========================================================
   DATABASE SETUP
   ========================================================= */

async function initDatabase() {

  await pool.query(`

    CREATE TABLE IF NOT EXISTS users (

      id SERIAL PRIMARY KEY,

      email VARCHAR(320)
        UNIQUE
        NOT NULL,

      password_hash TEXT
        NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP

    );


    CREATE TABLE IF NOT EXISTS journal_entries (

      id SERIAL PRIMARY KEY,

      user_id INTEGER
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      entry_date DATE
        NOT NULL,

      content TEXT
        NOT NULL
        CHECK (
          char_length(content)
          BETWEEN 1 AND 5000
        ),

      mood VARCHAR(50)
        NOT NULL
        DEFAULT 'unnamed',

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(
        user_id,
        entry_date
      )

    );


    CREATE INDEX IF NOT EXISTS
      journal_entries_user_id_idx
    ON journal_entries(user_id);


    CREATE INDEX IF NOT EXISTS
      journal_entries_date_idx
    ON journal_entries(entry_date);

  `);


  console.log(
    "✓ PostgreSQL database is ready."
  );

}


/* =========================================================
   EMAIL
   ========================================================= */

const smtpConfigured =
  Boolean(
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM
  );


/* =========================================================
   MOOD EMAIL THEMES
   ========================================================= */

const moodEmailThemes = {

  happy: {
    emoji:
      "☀️",
    bg:
      "#fbf2df",
    soft:
      "#fffaf0",
    accent:
      "#b97720",
    ink:
      "#4e3a24",
    line:
      "#e7d3a5"
  },


  hopeful: {
    emoji:
      "🌱",
    bg:
      "#edf3e7",
    soft:
      "#fbfff8",
    accent:
      "#5d7950",
    ink:
      "#33442e",
    line:
      "#cbd9bf"
  },


  excited: {
    emoji:
      "✨",
    bg:
      "#f2e8f7",
    soft:
      "#fffaff",
    accent:
      "#8b5aa8",
    ink:
      "#44344e",
    line:
      "#dbc5e9"
  },


  peaceful: {
    emoji:
      "😌",
    bg:
      "#eaf1ed",
    soft:
      "#fbfffd",
    accent:
      "#648176",
    ink:
      "#35433e",
    line:
      "#c8dad2"
  },


  comforted: {
    emoji:
      "🫂",
    bg:
      "#f4e8e4",
    soft:
      "#fffafa",
    accent:
      "#976760",
    ink:
      "#493735",
    line:
      "#ddcbc5"
  },


  confused: {
    emoji:
      "💭",
    bg:
      "#e8e5f4",
    soft:
      "#fcfbff",
    accent:
      "#7165a0",
    ink:
      "#403a54",
    line:
      "#c9c3df"
  },


  heavy: {
    emoji:
      "🌧️",
    bg:
      "#dce7ed",
    soft:
      "#fafdff",
    accent:
      "#4e6c7c",
    ink:
      "#38454c",
    line:
      "#bcced8"
  },


  sad: {
    emoji:
      "😔",
    bg:
      "#e6e9f3",
    soft:
      "#fcfdff",
    accent:
      "#667ca8",
    ink:
      "#3f4654",
    line:
      "#c2cadf"
  },


  numb: {
    emoji:
      "🫧",
    bg:
      "#efefeb",
    soft:
      "#fdfdfb",
    accent:
      "#6d6e6a",
    ink:
      "#454641",
    line:
      "#d6d6d0"
  },


  angry: {
    emoji:
      "😤",
    bg:
      "#f4dfdb",
    soft:
      "#fffafa",
    accent:
      "#a4473d",
    ink:
      "#512f2b",
    line:
      "#dfbcb6"
  },


  overwhelmed: {
    emoji:
      "😵‍💫",
    bg:
      "#f3e3d6",
    soft:
      "#fffaf6",
    accent:
      "#9b603b",
    ink:
      "#503a2e",
    line:
      "#ddc4b2"
  },


  emotional: {
    emoji:
      "🥹",
    bg:
      "#f3e3ec",
    soft:
      "#fffaff",
    accent:
      "#925a79",
    ink:
      "#4f3544",
    line:
      "#dac1cf"
  }

};


function getMoodTheme(mood) {

  return (
    moodEmailThemes[mood] ||
    {

      emoji:
        "♡",

      bg:
        "#f5eee7",

      soft:
        "#fffdf9",

      accent:
        "#8a6f59",

      ink:
        "#3d3028",

      line:
        "#dfd2c2"

    }
  );

}


/*
 * IMPORTANT:
 *
 * Only known moods can be stored.
 *
 * This prevents values like:
 * undefined
 * undefined sad
 * random strings
 *
 * from appearing as a mood.
 */

function safeMood(value) {

  const mood =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  return Object.prototype.hasOwnProperty.call(
    moodEmailThemes,
    mood
  )
    ? mood
    : "unnamed";

}


function cleanEmail(value) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase();

}


function validEmail(value) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(value);

}


function todayISO() {

  const now =
    new Date();


  const y =
    now.getFullYear();


  const m =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const d =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${y}-${m}-${d}`;

}


function requireAuth(
  req,
  res,
  next
) {

  if (
    !req.session.userId
  ) {

    return res
      .status(401)
      .json({

        error:
          "Please sign in first."

      });

  }


  next();

}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/api/health",
  async (_req, res) => {

    try {

      await pool.query(
        "SELECT 1"
      );


      res.json({

        ok:
          true,

        database:
          true,

        smtpConfigured

      });


    } catch (error) {

      res
        .status(500)
        .json({

          ok:
            false,

          database:
            false,

          error:
            error.message

        });

    }

  }
);


/* =========================================================
   SIGNUP
   ========================================================= */

app.post(
  "/api/auth/signup",
  authLimiter,
  async (req, res) => {

    try {

      const email =
        cleanEmail(
          req.body.email
        );


      const password =
        String(
          req.body.password ||
          ""
        );


      if (!validEmail(email)) {

        return res
          .status(400)
          .json({

            error:
              "Please enter a valid email."

          });

      }


      if (
        password.length < 8
      ) {

        return res
          .status(400)
          .json({

            error:
              "Password must be at least 8 characters."

          });

      }


      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );


      const result =
        await pool.query(

          `
          INSERT INTO users
          (
            email,
            password_hash
          )

          VALUES
          ($1,$2)

          RETURNING
            id,
            email
          `,

          [
            email,
            passwordHash
          ]

        );


      req.session.userId =
        result.rows[0].id;


      res.json({

        user:
          result.rows[0]

      });


    } catch (error) {

      if (
        error.code ===
        "23505"
      ) {

        return res
          .status(409)
          .json({

            error:
              "An account with that email already exists."

          });

      }


      console.error(
        "SIGNUP ERROR:",
        error
      );


      res
        .status(500)
        .json({

          error:
            "Couldn't create your account."

        });

    }

  }
);


/* =========================================================
   LOGIN
   ========================================================= */

app.post(
  "/api/auth/login",
  authLimiter,
  async (req, res) => {

    try {

      const email =
        cleanEmail(
          req.body.email
        );


      const password =
        String(
          req.body.password ||
          ""
        );


      const result =
        await pool.query(

          `
          SELECT
            id,
            email,
            password_hash

          FROM users

          WHERE email = $1
          `,

          [
            email
          ]

        );


      const account =
        result.rows[0];


      if (
        !account ||
        !(
          await bcrypt.compare(
            password,
            account.password_hash
          )
        )
      ) {

        return res
          .status(401)
          .json({

            error:
              "Email or password is incorrect."

          });

      }


      req.session.userId =
        account.id;


      res.json({

        user: {

          id:
            account.id,

          email:
            account.email

        }

      });


    } catch (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );


      res
        .status(500)
        .json({

          error:
            "Couldn't sign you in."

        });

    }

  }
);


/* =========================================================
   LOGOUT
   ========================================================= */

app.post(
  "/api/auth/logout",
  (req, res) => {

    req.session.destroy(
      (error) => {

        if (error) {

          return res
            .status(500)
            .json({

              error:
                "Couldn't sign you out."

            });

        }


        res.clearCookie(
          "connect.sid"
        );


        res.json({

          success:
            true

        });

      }
    );

  }
);


/* =========================================================
   CURRENT USER
   ========================================================= */

app.get(
  "/api/auth/me",
  async (req, res) => {

    if (
      !req.session.userId
    ) {

      return res.json({

        loggedIn:
          false,

        user:
          null

      });

    }


    try {

      const result =
        await pool.query(

          `
          SELECT
            id,
            email

          FROM users

          WHERE id = $1
          `,

          [
            req.session.userId
          ]

        );


      if (
        !result.rows[0]
      ) {

        req.session.destroy(
          () => {}
        );


        return res.json({

          loggedIn:
            false,

          user:
            null

        });

      }


      res.json({

        loggedIn:
          true,

        user:
          result.rows[0]

      });


    } catch (error) {

      res
        .status(500)
        .json({

          error:
            "Couldn't check your session."

        });

    }

  }
);


/* =========================================================
   GET ENTRIES
   ========================================================= */

app.get(
  "/api/entries",
  requireAuth,
  async (req, res) => {

    try {

      const result =
        await pool.query(

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

          ORDER BY
            entry_date DESC
          `,

          [
            req.session.userId
          ]

        );


      res.json({

        entries:
          result.rows

      });


    } catch (error) {

      console.error(
        "LOAD ENTRIES ERROR:",
        error
      );


      res
        .status(500)
        .json({

          error:
            "Couldn't load your little days."

        });

    }

  }
);


/* =========================================================
   SAVE ENTRY
   ========================================================= */

app.post(
  "/api/entries",
  requireAuth,
  async (req, res) => {

    try {

      const content =
        String(
          req.body.content ||
          ""
        ).trim();


      const mood =
        safeMood(
          req.body.mood
        );


      const entryDate =
        String(
          req.body.entryDate ||
          todayISO()
        );


      if (
        !/^\d{4}-\d{2}-\d{2}$/
          .test(entryDate)
      ) {

        return res
          .status(400)
          .json({

            error:
              "Please use a valid date."

          });

      }


      if (!content) {

        return res
          .status(400)
          .json({

            error:
              "Write something first."

          });

      }


      if (
        content.length > 5000
      ) {

        return res
          .status(400)
          .json({

            error:
              "Your note is a little too long."

          });

      }


      const result =
        await pool.query(

          `
          INSERT INTO journal_entries
          (
            user_id,
            entry_date,
            content,
            mood
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4
          )

          ON CONFLICT
          (
            user_id,
            entry_date
          )

          DO UPDATE SET

            content =
              EXCLUDED.content,

            mood =
              EXCLUDED.mood,

            updated_at =
              CURRENT_TIMESTAMP

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

        entry:
          result.rows[0]

      });


    } catch (error) {

      console.error(
        "SAVE ENTRY ERROR:",
        error
      );


      res
        .status(500)
        .json({

          error:
            "Couldn't save your note."

        });

    }

  }
);


/* =========================================================
   DELETE TODAY
   ========================================================= */

app.delete(
  "/api/entries/today",
  requireAuth,
  async (req, res) => {

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

        success:
          true

      });


    } catch (error) {

      res
        .status(500)
        .json({

          error:
            "Couldn't delete today's note."

        });

    }

  }
);


/* =========================================================
   SEND ANONYMOUS LETTER
   ========================================================= */

app.post(
  "/api/send-letter",
  emailLimiter,
  async (req, res) => {

    try {

      const recipient =
        cleanEmail(
          req.body.recipient ||
          req.body.recipientEmail
        );


      const content =
        String(
          req.body.content ||
          ""
        ).trim();


      const mood =
        safeMood(
          req.body.mood
        );


      if (
        !validEmail(recipient)
      ) {

        return res
          .status(400)
          .json({

            error:
              "Please enter a valid recipient email."

          });

      }


      if (!content) {

        return res
          .status(400)
          .json({

            error:
              "There is no little note to send yet."

          });

      }


      if (
        content.length > 5000
      ) {

        return res
          .status(400)
          .json({

            error:
              "The note is too long to send."

          });

      }


      if (!smtpConfigured) {

        return res
          .status(503)
          .json({

            error:
              "Email is not configured yet. Add SMTP_USER, SMTP_PASS and MAIL_FROM to .env."

          });

      }


      const theme =
        getMoodTheme(
          mood
        );


      const moodLabel =
        mood === "unnamed"
          ? "A LITTLE SOMETHING"
          : mood.toUpperCase();


      const safeContent =
        escapeHtml(
          content
        ).replace(
          /\n/g,
          "<br>"
        );


      /*
       * Email uses a table layout because Gmail
       * is much more likely to preserve these
       * mood colours.
       */

      const html = `

<!doctype html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1.0"
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
  bgcolor="${theme.bg}"
  style="
    margin:0;
    padding:0;
    background-color:${theme.bg};
    color:${theme.ink};
    font-family:Arial,Helvetica,sans-serif;
  "
>


<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  bgcolor="${theme.bg}"
  style="
    width:100%;
    background-color:${theme.bg};
  "
>

<tr>

<td
  align="center"
  style="padding:28px 12px;"
>


<table
  role="presentation"
  width="620"
  cellpadding="0"
  cellspacing="0"
  border="0"
  bgcolor="${theme.soft}"
  style="
    width:100%;
    max-width:620px;
    background-color:${theme.soft};
    border:1px solid ${theme.line};
  "
>


<tr>

<td
  height="8"
  bgcolor="${theme.accent}"
  style="
    height:8px;
    background-color:${theme.accent};
    font-size:0;
    line-height:0;
  "
>
&nbsp;
</td>

</tr>


<tr>

<td
  style="
    padding:34px 30px 32px;
  "
>


<div
  style="
    font:
      700 10px/15px
      Arial,Helvetica,sans-serif;

    letter-spacing:
      3px;

    color:
      ${theme.accent};

    text-transform:
      uppercase;
  "
>
  A LITTLE SOMETHING
</div>


<div
  style="
    font-size:30px;
    line-height:38px;
    margin-top:10px;
  "
>
  ${theme.emoji}
</div>


<div
  style="
    margin-top:2px;

    color:
      ${theme.ink};

    font:
      500 43px/48px
      Georgia,
      'Times New Roman',
      serif;
  "
>

  for you

  <span
    style="
      color:${theme.accent};
    "
  >
    ♡
  </span>

</div>


<table
  role="presentation"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="margin-top:18px;"
>

<tr>

<td
  bgcolor="${theme.bg}"
  style="
    padding:7px 11px;

    background-color:
      ${theme.bg};

    border:
      1px solid
      ${theme.line};

    color:
      ${theme.accent};

    font:
      700 10px/14px
      Arial,Helvetica,sans-serif;

    letter-spacing:
      1px;

    text-transform:
      uppercase;
  "
>

  ${theme.emoji}

  &nbsp;&nbsp;

  MOOD ·

  ${escapeHtml(
    moodLabel
  )}

</td>

</tr>

</table>


<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="margin-top:25px;"
>

<tr>

<td
  height="1"
  bgcolor="${theme.line}"
  style="
    height:1px;
    background-color:${theme.line};
    font-size:0;
    line-height:0;
  "
>
&nbsp;
</td>

</tr>

</table>


<div
  style="
    margin-top:25px;

    color:
      ${theme.ink};

    font:
      20px/1.75
      Georgia,
      'Times New Roman',
      serif;
  "
>

  ${safeContent}

</div>


<div
  style="
    margin-top:30px;

    color:
      ${theme.ink};

    font:
      16px/1.5
      Georgia,
      'Times New Roman',
      serif;
  "
>

  — someone who wanted you to know

</div>


<div
  style="
    margin-top:16px;

    color:
      ${theme.accent};

    font:
      10px/15px
      Arial,
      Helvetica,
      sans-serif;
  "
>

  a little something · no name attached

</div>


</td>

</tr>

</table>


</td>

</tr>

</table>


</body>

</html>
`;


      /*
       * IMPORTANT:
       *
       * The writer's personal email is NEVER used
       * as the sender.
       */

      const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    from: MAIL_FROM,
    to: [recipient],
    subject: "A little something for you ♡",
    text: `${mood ? `Mood: ${mood}\n\n` : ""}${content}\n\n— someone who wanted you to know`,
    html
  })
});

const result = await response.json();

if (!response.ok) {
  console.error("RESEND ERROR:", result);
  return res.status(500).json({
    success: false,
    error: result?.message || "The email couldn't be sent."
  });
}

console.log("✓ Anonymous letter sent:", result.id);

res.json({
  success: true,
  message: "Your little letter is on its way ♡"
});


    } catch (error) {

      console.error(
        "EMAIL SEND ERROR",
        {
          code:
            error.code,

          command:
            error.command,

          response:
            error.response,

          message:
            error.message
        }
      );


      res
        .status(500)
        .json({

          success:
            false,

          error:
            friendlyEmailError(
              error
            )

        });

    }

  }
);


/* =========================================================
   EMAIL HELPERS
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#039;"
      }[char])
  );

}


/* =========================================================
   HOME
   ========================================================= */

app.get(
  "/",
  (_req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);


/* =========================================================
   START
   ========================================================= */

initDatabase()

  .then(
    () => {

      app.listen(PORT, "0.0.0.0", () =>
  console.log(`✓ A Little Something is running on port ${PORT}`)
)

    }
  )

  .catch(
    (error) => {

      console.error(
        "✗ Database startup failed:",
        error.message
      );

      process.exit(1);

    }
  );