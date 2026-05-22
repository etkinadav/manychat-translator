# קולקשן `websites` — מבנה המסמך (MongoDB)

מסמך זה מתאר את **אלמנט יחיד** בקולקשן `websites`. כל רשומה = פרופיל DOM והרשאות URL לאתר אחד (Manychat, WhatsApp Web, וכו').

**מקור האמת:** MongoDB. התוסף טוען `domProfile` ו-`urlPatterns` מ-`GET /api/user/profile` → `websites[]`. אין צורך בקובץ TypeScript ב-backend לכל אתר חדש.

**הוספה ידנית ל-DB:** קבצי JSON מוכנים להדבקה ב-Compass / `insertOne`:

- `docs/seeds/whatsapp-web.website.json` — WhatsApp Web (`slug: whatsapp-web`)

אחרי ה-insert: הוסף את `_id` של המסמך ל-`organizations.websites[]`, והתחבר מחדש מהתוסף.

---

## שדות ברמת המסמך

| שדה | סוג | חובה | תיאור |
|-----|-----|------|--------|
| `_id` | `ObjectId` | אוטומטי | מזהה MongoDB |
| `slug` | `string` | כן | מזהה יציב בקוד (`manychat`, `whatsapp-web`). ייחודי, lowercase |
| `name` | `string` | כן | שם תצוגה ("Manychat") |
| `enabled` | `boolean` | כן | האם מוצג בבחירת אתרים בארגון (ברירת מחדל: `true`) |
| `urlPatterns` | `string[]` | כן | תבניות התאמה ל-Chrome / בדיקת URL (למשל `https://app.manychat.com/*`) |
| `domProfile` | `object` | כן | כל הסלקטורים והפיצ'רים — ראה למטה |
| `profileVersion` | `number` | לא | גרסת פרופיל (למיגרציות כשמשתנים סלקטורים) |
| `notes` | `string` | לא | הערות למפתחים |
| `createdAt` | `Date` | אוטומטי | timestamps |
| `updatedAt` | `Date` | אוטומטי | timestamps |

**אינדקסים מומלצים:** `slug` (unique), `enabled`.

---

## אובייקט `domProfile`

מקובץ לפי מודולים בתוסף — לא רשימה שטוחה של כפתורים.

### `domProfile.incoming` — הודעות נכנסות (`content.ts`)

| שדה | סוג | תיאור |
|-----|-----|--------|
| `messageBlock` | `string` | סלקטור CSS לבלוק הודעה אחת |
| `textWithinBlock` | `string[]` | סלקטורים לטקסט המקורי (לפי סדר עדיפות) |
| `skipBlocks` | `string` | סלקטור מורכב להודעות meta/system שלא מתורגמות |
| `translationInsert` | `"afterText"` | איפה להזריק `.mc-ai-translation` |
| `speaker.agentPatterns` | `string[]` | מחרוזות לבדיקת regex — זיהוי הודעת נציג |
| `speaker.customerPatterns` | `string[]` | זיהוי הודעת לקוח |

### `domProfile.composer` — אזור כתיבה ו-toolbar (`outgoing.ts`)

| שדה | סוג | תיאור |
|-----|-----|--------|
| `textarea` | `string` | שדה הקלדת הודעה יוצאת |
| `toolbar.mode` | `"afterTextarea"` \| `"insideContainer"` | איך לשלב את ה-toolbar |
| `toolbar.container` | `string?` | קונטיינר יעד (למשל שיחה ישנה) |
| `expiredWindow.enabled` | `boolean` | האם יש מצב חלון 24 שעות |
| `expiredWindow.containerSelector` | `string` | `_toolbarContainer_` וכו' |
| `expiredWindow.wrapperSelector` | `string` | wrapper לזיהוי טקסט אזהרה |
| `expiredWindow.detectTextPatterns` | `string[]` | דפוסי regex (מחרוזות) לזיהוי שיחה ישנה |

### `domProfile.subscriber` — מגדר מנוי (`subscriber-gender.ts`)

| שדה | סוג | תיאור |
|-----|-----|--------|
| `enabled` | `boolean` | האם להציג כפתור gender ליד שם המנוי |
| `titleSelector` | `string` | אלמנט שם המנוי |

### `domProfile.summary` — סיכום שיחה (`chat-transcript.ts`)

| שדה | סוג | תיאור |
|-----|-----|--------|
| `messageWrapper` | `string` | wrapper להודעה (לשכפול UI) |
| `messageBlock` | `string` | בלוק הודעה בתוך wrapper |
| `insertMode` | `"cloneWrapper"` \| `"afterLastBlock"` | איך להציג את הסיכום |

### `domProfile.features` — דגלים

| שדה | ברירת מחדל | תיאור |
|-----|------------|--------|
| `incomingAutoTranslate` | `true` | תרגום אוטומטי נכנס |
| `outgoingTranslate` | `true` | כפתור תרגום הודעה יוצאת |
| `incomingGeminiButton` | `true` | כפתור AI על הודעה |
| `conversationSummary` | `true` | כפתור summery |
| `subscriberGender` | `true` | Male/Female + gender על שם |
| `autoTranslateToggle` | `true` | כפתור auto/off |

---

## קישור לארגון (`organizations`)

```ts
websites: [{ type: ObjectId, ref: "Website" }]
```

- **רק מערך של `_id`** — אין `domProfile`, `urlPatterns` או שום שדה אחר בתוך מסמך הארגון.
- כל המידע על האתר (סלקטורים, פיצ'רים, URL) נמצא **רק** במסמך בקולקשן `websites`.
- מערך ריק = אין אתרים מורשים (התוסף לא יפעיל תרגום).
- במיגרציה: ארגונים קיימים יקבלו `[manychatId]` אחרי seed.

---

## דוגמת מסמך מלא (Manychat)

```json
{
  "slug": "manychat",
  "name": "Manychat",
  "enabled": true,
  "urlPatterns": ["https://app.manychat.com/*"],
  "profileVersion": 1,
  "notes": "Initial seed from extension selectors",
  "domProfile": {
    "incoming": {
      "messageBlock": "[data-chat-message=\"block\"]",
      "textWithinBlock": [
        "[data-chat-message=\"text\"]",
        "[class*=\"_text_\"]"
      ],
      "skipBlocks": "[class*=\"_meta_\"], [data-chat-message=\"meta\"], [data-chat-message=\"system\"], [class*=\"_system_\"]",
      "translationInsert": "afterText",
      "speaker": {
        "agentPatterns": [
          "outgoing",
          "from-agent",
          "agent-message",
          "_out_",
          "sent-by-user",
          "message-out",
          "_typeout",
          "_botmessage"
        ],
        "customerPatterns": [
          "incoming",
          "from-subscriber",
          "customer",
          "subscriber",
          "message-in",
          "received",
          "_typein"
        ]
      }
    },
    "composer": {
      "textarea": "textarea[name=\"whatsappMessageInput\"][data-mc-editor=\"true\"]",
      "toolbar": { "mode": "afterTextarea" },
      "expiredWindow": {
        "enabled": true,
        "containerSelector": "[class*=\"_toolbarContainer_\"]",
        "wrapperSelector": "[class*=\"_wrapper_\"]",
        "detectTextPatterns": [
          "24\\s*hours?",
          "24\\s*שעות",
          "message templates",
          "תבניות"
        ]
      }
    },
    "subscriber": {
      "enabled": true,
      "titleSelector": "span[class*=\"_subscriberTitle_\"]"
    },
    "summary": {
      "messageWrapper": "[class*=\"_wrapper_\"]",
      "messageBlock": "[data-chat-message=\"block\"]",
      "insertMode": "cloneWrapper"
    },
    "features": {
      "incomingAutoTranslate": true,
      "outgoingTranslate": true,
      "incomingGeminiButton": true,
      "conversationSummary": true,
      "subscriberGender": true,
      "autoTranslateToggle": true
    }
  }
}
```

---

## תגובת API — הפרדה בין ארגון לאתרים

**`organization`** (רק מזהים):

```json
{
  "id": "...",
  "name": "My Org",
  "language": "he",
  "translationContext": "...",
  "terms": [],
  "websiteIds": ["664a...", "664b..."]
}
```

**`GET /api/user/profile`** (ושאר connect) — מערך `websites` **ברמת השורש**, נטען מקולקשן `websites`:

```json
{
  "email": "agent@example.com",
  "language": "he",
  "organization": { "id": "...", "websiteIds": ["664a..."] },
  "websites": [
    {
      "id": "664a...",
      "slug": "manychat",
      "name": "Manychat",
      "urlPatterns": ["https://app.manychat.com/*"],
      "domProfile": { }
    }
  ]
}
```

התוסף משתמש ב-`session.websites` (לא בתוך `organization`) ל-`urlPatterns`, `domProfile` ורישום content scripts.
