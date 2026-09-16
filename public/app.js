const get = (id) => document.getElementById(id);


/* =========================================================
   MOODS
   ========================================================= */

const moods = [
  ["☀️", "happy"],
  ["🌱", "hopeful"],
  ["✨", "excited"],
  ["😌", "peaceful"],
  ["🫂", "comforted"],
  ["💭", "confused"],
  ["🌧️", "heavy"],
  ["😔", "sad"],
  ["🫧", "numb"],
  ["😤", "angry"],
  ["😵‍💫", "overwhelmed"],
  ["🥹", "emotional"]
];

const moodEmoji = Object.fromEntries(moods);

const moodPrompt = {
  happy: "leave the bright bits here.",
  hopeful: "write down what you're still holding onto.",
  excited: "let the spark spill onto the page.",
  peaceful: "take your time. there is nowhere else to be.",
  comforted: "keep the soft feeling here for a moment.",
  confused: "you don't need to figure it out before writing.",
  heavy: "put a little of the weight down here.",
  sad: "you can be tender here.",
  numb: "even nothing is something worth writing.",
  angry: "you are allowed to say the messy version.",
  overwhelmed: "one thought at a time. that's enough.",
  emotional: "you don't have to tidy any of it up."
};


/* =========================================================
   MOOD ATMOSPHERE
   ========================================================= */

const moodAtmosphere = {

  happy:
    ["☀️", "✦", "·", "☀️", "✧", "·", "✦"],

  hopeful:
    ["🌱", "⌁", "·", "🌿", "✦", "·", "🌱"],

  excited:
    ["✦", "✨", "✧", "★", "✨", "·", "✦"],

  peaceful:
    ["☁", "·", "◌", "😌", "⌁", "·", "☁"],

  comforted:
    ["♡", "🫂", "·", "⌁", "♡", "·", "🫶"],

  confused:
    ["💭", "?", "·", "◌", "?", "💭", "·"],

  heavy:
    ["🌧️", "·", "⌁", "☂", "·", "🌧️", "⌁"],

  sad:
    ["💧", "·", "☁", "😔", "·", "💧", "⌁"],

  numb:
    ["🫧", "·", "◌", "🫧", "·", "○", "⌁"],

  angry:
    ["!", "⚡", "·", "✦", "!", "·", "⚡"],

  overwhelmed:
    ["〰", "😵‍💫", "·", "✦", "〰", "·", "💫"],

  emotional:
    ["🥹", "♡", "·", "✧", "♡", "·", "🥹"]
};


/* =========================================================
   STATE
   ========================================================= */

let user = null;
let entries = [];
let currentDraft = "";
let currentMood = "";
let viewDate = new Date();
let authMode = "login";


/* =========================================================
   HELPERS
   ========================================================= */

function todayISO() {

  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}


function normalizeDate(value) {

  if (!value) return "";

  return String(value).slice(0, 10);
}


function formatDate(value) {

  const normalized = normalizeDate(value);

  if (!normalized) return "";

  return new Date(
    `${normalized}T12:00:00`
  ).toLocaleDateString(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );
}


function openModal(id) {

  const el = get(id);

  if (!el) return;

  el.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");
}


function closeModal(id) {

  const el = get(id);

  if (!el) return;

  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
}


function toast(message) {

  const el = get("toast");

  if (!el) return;

  el.textContent = message;

  el.classList.remove("hidden");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.classList.add("hidden");
  }, 2400);
}


function setStatus(id, message, good = false) {

  const el = get(id);

  if (!el) return;

  el.textContent = message;

  el.classList.toggle("good", good);
}


function restartAnimation(element, className) {

  if (!element) return;

  element.classList.remove(className);

  void element.offsetWidth;

  element.classList.add(className);
}


/* =========================================================
   MOOD BUTTONS
   ========================================================= */

function renderMoodButtons() {

  const moodContainer = get("moods");

  if (!moodContainer) return;

  moodContainer.innerHTML = moods
    .map(
      ([emoji, name]) => `

        <button
          class="mood-option"
          type="button"
          data-mood="${name}"
          aria-label="${name}"
          aria-pressed="false"
        >

          <span class="mood-option-emoji">
            ${emoji}
          </span>

          <small>
            ${name}
          </small>

        </button>

      `
    )
    .join("");
}


/* =========================================================
   ATMOSPHERE
   ========================================================= */

function updateAtmosphere() {

  const ambient = get("ambient");

  if (!ambient) return;

  const symbols =
    moodAtmosphere[currentMood] || [
      "♡",
      "·",
      "✦",
      "◌",
      "·",
      "♡",
      "✧"
    ];

  ambient.innerHTML = symbols
    .map(
      (symbol, index) => `

        <span
          class="
            mood-particle
            particle-${index + 1}
          "
        >
          ${symbol}
        </span>

      `
    )
    .join("");
}


/* =========================================================
   SELECT MOOD
   ========================================================= */

function selectMood(mood, animate = true) {

  currentMood = mood || "";

  document.body.dataset.mood = currentMood;

  updateAtmosphere();


  /* Update selected mood button */

  document
    .querySelectorAll(".mood-option")
    .forEach((button) => {

      const selected =
        button.dataset.mood === currentMood;

      button.classList.toggle(
        "is-selected",
        selected
      );

      button.setAttribute(
        "aria-pressed",
        selected ? "true" : "false"
      );

    });


  const hasMood = Boolean(currentMood);


  /* Main mood pill */

  get("selectedMoodBadge").textContent =
    hasMood
      ? currentMood
      : "choose a feeling first";


  /* Top feeling button */

  get("triggerEmoji").textContent =
    hasMood
      ? moodEmoji[currentMood]
      : "♡";


  get("triggerText").textContent =
    hasMood
      ? `I'm feeling ${currentMood}`
      : "tap to tell me";


  /* Text underneath */

  get("quietLine").textContent =
    hasMood
      ? "you can change the feeling whenever you want"
      : "no right answer · no judgement · just you";


  /* Card */

  get("cardSymbol").textContent =
    hasMood
      ? moodEmoji[currentMood]
      : "♡";


  get("writePrompt").textContent =
    hasMood
      ? moodPrompt[currentMood]
      : "pick a feeling first, then start anywhere...";


  get("writeHeading").textContent =
    hasMood
      ? "What's on your mind?"
      : "What would you like to leave here?";


  /* Enable writing */

  get("text").disabled = !hasMood;


  get("keep").disabled =
    !hasMood ||
    !get("text").value.trim();


  /* Modal mood */

  get("sendMoodEmoji").textContent =
    hasMood
      ? moodEmoji[currentMood]
      : "♡";


  get("emailMoodEmoji").textContent =
    hasMood
      ? moodEmoji[currentMood]
      : "♡";


  get("savedHeart").textContent =
    hasMood
      ? moodEmoji[currentMood]
      : "♡";


  get("emailMoodPreview").textContent =
    hasMood
      ? `${currentMood} · the mood travels with the note`
      : "your chosen mood travels with the note";


  /* Animation */

  if (animate && hasMood) {

    get("transitionEmoji").textContent =
      moodEmoji[currentMood];

    restartAnimation(
      get("transitionLayer"),
      "show"
    );

    restartAnimation(
      get("journalCard"),
      "mood-change"
    );

    restartAnimation(
      get("triggerEmoji"),
      "trigger-pop"
    );

    setTimeout(() => {
      get("text").focus();
    }, 300);
  }
}


/* =========================================================
   INITIALIZE
   ========================================================= */

renderMoodButtons();

updateAtmosphere();

selectMood("", false);


get("todayLabel").textContent =
  new Date().toLocaleDateString(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );


/* =========================================================
   MOOD PICKER
   ========================================================= */

get("feelingTrigger").addEventListener(
  "click",
  () => {
    openModal("moodModal");
  }
);


get("moods").addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-mood]"
      );

    if (!button) return;

    selectMood(
      button.dataset.mood,
      true
    );

    closeModal("moodModal");
  }
);


/* =========================================================
   TEXT
   ========================================================= */

get("text").addEventListener(
  "input",
  () => {

    get("count").textContent =
      get("text").value.length;

    get("keep").disabled =
      !currentMood ||
      !get("text").value.trim();

  }
);


/* =========================================================
   SAVE
   ========================================================= */

get("keep").addEventListener(
  "click",
  async () => {

    currentDraft =
      get("text").value.trim();


    if (!currentMood) {

      openModal("moodModal");

      return;
    }


    if (!currentDraft) {

      get("text").animate(
        [
          {
            transform:
              "translateX(-5px)"
          },
          {
            transform:
              "translateX(5px)"
          },
          {
            transform:
              "translateX(0)"
          }
        ],
        {
          duration: 250
        }
      );

      get("text").focus();

      return;
    }


    await saveNote();

  }
);


/* =========================================================
   SAVE NOTE
   ========================================================= */

async function saveNote() {

  if (user) {

    try {

      const response =
        await fetch(
          "/api/entries",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                content:
                  currentDraft,

                mood:
                  currentMood
              })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Couldn't save."
        );

      }


      await loadEntries();


    } catch (error) {

      toast(error.message);

      return;
    }


  } else {

    const guest =
      JSON.parse(
        localStorage.getItem(
          "guestEntries"
        ) || "[]"
      );


    const today =
      todayISO();


    const updated =
      guest.filter(
        (entry) =>
          normalizeDate(
            entry.entry_date ||
            entry.date
          ) !== today
      );


    updated.push({

      date:
        today,

      content:
        currentDraft,

      mood:
        currentMood

    });


    localStorage.setItem(
      "guestEntries",
      JSON.stringify(updated)
    );


    entries =
      updated;

  }


  openModal("sendModal");

}


/* =========================================================
   SEND FLOW
   ========================================================= */

get("private").addEventListener(
  "click",
  () => {

    closeModal("sendModal");

    openModal("savedModal");

  }
);


get("sendOpen").addEventListener(
  "click",
  () => {

    closeModal("sendModal");

    openModal("emailModal");

    get("recipient").focus();

  }
);


get("send").addEventListener(
  "click",
  async () => {

    const recipient =
      get("recipient")
        .value
        .trim();


    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(recipient)
    ) {

      setStatus(
        "sendStatus",
        "Please enter a valid email."
      );

      return;
    }


    get("send").disabled =
      true;


    setStatus(
      "sendStatus",
      "sending a tiny something..."
    );


    try {

      const response =
        await fetch(
          "/api/send-letter",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                recipient,
                content:
                  currentDraft,
                mood:
                  currentMood
              })
          }
        );


      const result =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (!response.ok) {

        throw new Error(
          result.error ||
          "The email couldn't be sent."
        );

      }


      setStatus(
        "sendStatus",
        "It's on its way. ♡",
        true
      );


      setTimeout(
        () => {

          closeModal(
            "emailModal"
          );

          openModal(
            "savedModal"
          );

        },
        900
      );


    } catch (error) {

      setStatus(
        "sendStatus",
        error.message
      );


    } finally {

      get("send").disabled =
        false;

    }

  }
);


/* =========================================================
   AUTH
   ========================================================= */

async function checkAuth() {

  try {

    const response =
      await fetch(
        "/api/auth/me"
      );


    const result =
      await response.json();


    user =
      result.loggedIn
        ? result.user
        : null;


    updateAuthUI();


    if (user) {

      await loadEntries();

    } else {

      loadGuestEntries();

    }


  } catch {

    user =
      null;

    updateAuthUI();

    loadGuestEntries();

  }

}


function loadGuestEntries() {

  entries =
    JSON.parse(
      localStorage.getItem(
        "guestEntries"
      ) || "[]"
    );

}


async function loadEntries() {

  if (!user) {

    loadGuestEntries();

    return;
  }


  try {

    const response =
      await fetch(
        "/api/entries"
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Couldn't load entries."
      );

    }


    entries =
      Array.isArray(
        result.entries
      )
        ? result.entries
        : [];


  } catch (error) {

    console.error(
      error
    );

    entries =
      [];

  }

}


function updateAuthUI() {

  get("authBtn").textContent =
    user
      ? "sign out"
      : "sign in";


  get("daysBtn")
    .classList
    .toggle(
      "hidden",
      !user
    );

}


/* =========================================================
   AUTH BUTTON
   ========================================================= */

get("authBtn").addEventListener(
  "click",
  async () => {

    if (user) {

      await fetch(
        "/api/auth/logout",
        {
          method:
            "POST"
        }
      );


      user =
        null;


      loadGuestEntries();

      updateAuthUI();

      goHome();

      toast(
        "signed out ♡"
      );

      return;
    }


    setAuthMode("login");

    openModal("authModal");

    get("authEmail").focus();

  }
);


/* =========================================================
   AUTH MODE
   ========================================================= */

get("switchAuth").addEventListener(
  "click",
  () => {

    setAuthMode(
      authMode === "login"
        ? "signup"
        : "login"
    );

  }
);


function setAuthMode(mode) {

  authMode =
    mode;


  get("authTitle").textContent =
    mode === "login"
      ? "Welcome back."
      : "Make a little home here.";


  get("authSubtitle").textContent =
    mode === "login"
      ? "Your little days are waiting for you."
      : "Create an account and keep your little days in one place.";


  get("authSubmit").textContent =
    mode === "login"
      ? "open my little days →"
      : "make my little archive →";


  get("switchAuth").textContent =
    mode === "login"
      ? "new here? make an account"
      : "already have an account? sign in";


  setStatus(
    "authStatus",
    ""
  );

}


/* =========================================================
   AUTH SUBMIT
   ========================================================= */

get("authForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const email =
      get("authEmail")
        .value
        .trim();


    const password =
      get("authPassword")
        .value;


    get("authSubmit")
      .disabled =
        true;


    setStatus(
      "authStatus",
      authMode === "login"
        ? "opening your archive..."
        : "making your little archive..."
    );


    try {

      const response =
        await fetch(
          `/api/auth/${authMode}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                email,
                password
              })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Something went wrong."
        );

      }


      user =
        result.user;


      updateAuthUI();

      await loadEntries();


      /*
       * Move guest notes into account.
       */

      const guest =
        JSON.parse(
          localStorage.getItem(
            "guestEntries"
          ) || "[]"
        );


      for (
        const guestEntry
        of guest
      ) {

        try {

          await fetch(
            "/api/entries",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({

                  content:
                    guestEntry.content,

                  mood:
                    guestEntry.mood ||
                    "unnamed",

                  entryDate:
                    normalizeDate(
                      guestEntry.entry_date ||
                      guestEntry.date
                    )

                })
            }
          );

        } catch {}

      }


      if (guest.length) {

        localStorage.removeItem(
          "guestEntries"
        );

        await loadEntries();

      }


      closeModal(
        "authModal"
      );


      toast(
        authMode === "login"
          ? "welcome back ♡"
          : "your little archive is ready ♡"
      );


    } catch (error) {

      setStatus(
        "authStatus",
        error.message
      );


    } finally {

      get("authSubmit")
        .disabled =
          false;

    }

  }
);


/* =========================================================
   CALENDAR
   ========================================================= */

get("daysBtn").addEventListener(
  "click",
  async () => {

    if (!user)
      return;


    await loadEntries();


    get("homeView")
      .classList
      .add("hidden");


    get("daysView")
      .classList
      .remove("hidden");


    viewDate =
      new Date();


    renderCalendar();

  }
);


function goHome() {

  get("daysView")
    .classList
    .add("hidden");


  get("homeView")
    .classList
    .remove("hidden");

}


get("backHome")
  .addEventListener(
    "click",
    goHome
  );


get("homeBtn")
  .addEventListener(
    "click",
    goHome
  );


get("prevMonth")
  .addEventListener(
    "click",
    () => {

      viewDate =
        new Date(
          viewDate.getFullYear(),
          viewDate.getMonth() - 1,
          1
        );

      renderCalendar();

    }
  );


get("nextMonth")
  .addEventListener(
    "click",
    () => {

      viewDate =
        new Date(
          viewDate.getFullYear(),
          viewDate.getMonth() + 1,
          1
        );

      renderCalendar();

    }
  );


function renderCalendar() {

  const year =
    viewDate.getFullYear();


  const month =
    viewDate.getMonth();


  const first =
    new Date(
      year,
      month,
      1
    ).getDay();


  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  get("monthTitle")
    .textContent =
      new Date(
        year,
        month,
        1
      ).toLocaleDateString(
        undefined,
        {
          month:
            "long",

          year:
            "numeric"
        }
      );


  const map =
    new Map();


  entries.forEach(
    (entry) => {

      const date =
        normalizeDate(
          entry.entry_date ||
          entry.date
        );


      if (date) {

        map.set(
          date,
          entry
        );

      }

    }
  );


  const weekdays = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ];


  let html =
    weekdays
      .map(
        (day) =>
          `<div class="weekday">${day}</div>`
      )
      .join("");


  for (
    let i = 0;
    i < first;
    i++
  ) {

    html +=
      `<div class="day empty"></div>`;

  }


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const date =
      `${year}-${String(
        month + 1
      ).padStart(
        2,
        "0"
      )}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`;


    const entry =
      map.get(date);


    const isToday =
      date === todayISO();


    if (entry) {

      const emoji =
        moodEmoji[
          entry.mood
        ] || "♡";


      html += `

        <div
          class="
            day
            has-entry
            ${isToday ? "today" : ""}
          "
        >

          <button
            class="day-button"
            type="button"
            data-entry-date="${date}"
            aria-label="Open note from ${formatDate(date)}"
          >

            <span class="day-number">
              ${day}
            </span>

            <span class="day-mood">
              ${emoji}
            </span>

            <span class="day-open">
              open
            </span>

          </button>

        </div>

      `;

    } else {

      html += `

        <div
          class="
            day
            ${isToday ? "today" : ""}
          "
        >

          <span class="day-number">
            ${day}
          </span>

          ${
            isToday
              ? `
                <span class="today-label">
                  today
                </span>
              `
              : ""
          }

        </div>

      `;

    }

  }


  get("calendar")
    .innerHTML =
      html;

}


/* =========================================================
   CALENDAR ENTRY POPUP
   ========================================================= */

get("calendar").addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-entry-date]"
      );


    if (!button)
      return;


    const date =
      button.dataset.entryDate;


    const entry =
      entries.find(
        (item) =>
          normalizeDate(
            item.entry_date ||
            item.date
          ) === date
      );


    if (!entry)
      return;


    get("entryPopupDate")
      .textContent =
        formatDate(date);


    get("entryPopupMood")
      .textContent =
        moodEmoji[
          entry.mood
        ] || "♡";


    get("entryPopupMoodName")
      .textContent =
        entry.mood ||
        "a little something";


    get("entryPopupContent")
      .textContent =
        entry.content ||
        "";


    document.body.dataset.mood =
      moodEmoji[entry.mood]
        ? entry.mood
        : "";


    currentMood =
      moodEmoji[entry.mood]
        ? entry.mood
        : currentMood;


    updateAtmosphere();


    openModal(
      "entryModal"
    );

  }
);


/* =========================================================
   CLOSE BUTTONS
   ========================================================= */

document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () =>
          closeModal(
            button.dataset.close
          )
      );

    }
  );


/* =========================================================
   CLICK OUTSIDE
   ========================================================= */

document
  .querySelectorAll(
    ".modal"
  )
  .forEach(
    (modal) => {

      modal.addEventListener(
        "click",
        (event) => {

          if (
            event.target ===
            modal
          ) {

            closeModal(
              modal.id
            );

          }

        }
      );

    }
  );


/* =========================================================
   ESC
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Escape"
    ) {

      document
        .querySelectorAll(
          ".modal:not(.hidden)"
        )
        .forEach(
          (modal) =>
            closeModal(
              modal.id
            )
        );

    }

  }
);


/* =========================================================
   START
   ========================================================= */

checkAuth();