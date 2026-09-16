# ♡ A Little Something For You

> A tiny corner of the internet for the things you don't know how to say.

**A Little Something For You** is a cozy digital journal where you can choose how you're feeling, write whatever is on your mind, and keep a little record of your days.

Sometimes you don't need advice.
Sometimes you just need somewhere to put the feeling.

And sometimes, you want to send someone a little something without making it about yourself.

---

## ✦ What is it?

A Little Something For You is a mood-based journaling web app designed around one simple idea:

**Feel it → Write it → Keep it → Maybe send it.**

Before writing, you choose a mood. The journal then changes its atmosphere to match how you're feeling, with different colors, prompts, emojis, and little animations.

Your entries are saved by date, so you can come back and look through your own little collection of days.

You can also optionally send your entry as a little letter to someone.

---

## ✿ Features

- ♡ Mood-based journaling
- ☀️ 12 different moods to choose from
- ✨ Mood-specific colors, prompts, animations and UI
- 📖 Daily journal entries
- 🗓️ "My Little Days" journal history
- 🔐 User authentication
- 💾 PostgreSQL database for persistent storage
- 💌 Optional letter sending through email
- 🕊️ Anonymous-style letter delivery
- 📱 Responsive interface
- 🎀 Cozy, playful and minimal UI
- 🛡️ Rate limiting for authentication and email endpoints

---

## ☁️ The moods

You can choose from:

☀️ Happy  
🌱 Hopeful  
✨ Excited  
😌 Peaceful  
🫂 Comforted  
💭 Confused  
🌧️ Heavy  
😔 Sad  
🫧 Numb  
😤 Angry  
😵‍💫 Overwhelmed  
🥹 Emotional

The interface reacts differently depending on the mood you choose.

---

## 🛠️ Tech Stack

### Frontend
- HTML
- CSS
- Vanilla JavaScript

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL
- `pg`

### Authentication & Security
- `bcryptjs`
- `express-session`
- `express-rate-limit`

### Email
- Nodemailer
- SMTP