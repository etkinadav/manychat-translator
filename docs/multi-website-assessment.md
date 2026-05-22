# הערכת היתכנות: תמיכה במספר אתרים (Manychat, WhatsApp ועוד)

מסמך זה בוחן את הבקשה להרחיב את התוסף כך שיעבוד על מספר פלטפורמות, עם הגדרות DOM לכל אתר ב-MongoDB וקישור אתרים לארגון. **זה אפשרי לחלוטין** — זה דפוס מוכר (Site Profile / Adapter). המורכבות העיקרית היא לא ב-DB אלא ב-**איסוף סלקטורים יציבים** לכל אתר וב-**הרשאות Chrome** לטעינת הסקריפט רק על דומיינים מורשים.

---

## 1. האם זה אפשרי?

| רכיב | אפשרי? | הערות |
|------|--------|--------|
| קולקשן `websites` עם סלקטורים | כן | מקור אמת אחד לכל אתר |
| ארגון ← רשימת `websiteIds` | כן | `ObjectId[]` או `ref` ב-Mongoose |
| בחירת אתרים בפרונט (יצירה/עריכת ארגון) | כן | multi-select + API |
| תוסף נטען רק על אתרים של הארגון | כן | עם מגבלות Manifest (ראו §4) |
| קוד גנרי בתוסף | כן | שכבת `SiteProfile` + מודולים לפי פיצ'ר |
| WhatsApp Web כאתר שני | כן, בנפרד | DOM שונה לגמרי; פרופיל נפרד + עבודת מיפוי |

**מסקנה:** הבקשה **ברת-ביצוע**. מומלץ לפרוס ב-3 שלבים (Manychat כ-seed → refactor תוסף → אתר שני כפיילוט).

---

## 2. מה קשה היום בקוד (Manychat-specific)

בתוסף כמעט כל הלוגיקה קשורה לסלקטורים קבועים:

| אזור | דוגמאות נוכחיות |
|------|------------------|
| הודעות נכנסות | `[data-chat-message="block"]`, `[class*="_text_"]`, skip meta/system |
| Composer | `textarea[name="whatsappMessageInput"]` |
| Toolbar | `data-mc-outgoing-toolbar`, הזרקה אחרי textarea |
| שיחה ישנה (24h) | `[class*="_toolbarContainer_"]`, טקסט "24 hours" |
| מגדר מנוי | `span[class*="_subscriberTitle_"]` |
| סיכום | `[class*="_wrapper_"]`, שכפול בלוק הודעה |

חלק מהסלקטורים של Manychat משתמשים ב-**CSS modules עם hash** (`_wrapper_10kfu_1`) — הם **שבירים** בעדכון deploy של Manychat. לכן ב-DB כדאי לתעדף:

1. `data-*` יציבים (כמו `data-chat-message="block"`)
2. `class*=` חלקי רק כ-fallback
3. שדה `version` / `notes` בפרופיל האתר

---

## 3. מבנה מוצע: קולקשן `websites`

### 3.1 שדות ברמת האתר (מסמך)

```ts
interface Website {
  _id: ObjectId;
  slug: string;              // "manychat" | "whatsapp-web" — יציב בקוד
  name: string;              // "Manychat"
  enabled: boolean;          // האם פעיל במערכת
  urlPatterns: string[];     // ["https://app.manychat.com/*"]
  domProfile: DomProfile;    // כל הסלקטורים וההתנהגות
  createdAt / updatedAt;
}
```

### 3.2 `domProfile` — מבנה מומלץ (מקובץ לפי פיצ'ר)

לא "כפתור מין" כשורה נפרדת בלי הקשר, אלא **קבוצות לוגיות** שמתאימות למודולים בקוד:

```ts
interface DomProfile {
  // --- הודעות נכנסות (content.ts) ---
  incoming: {
    messageBlock: string;           // קונטיינר הודעה
    textWithinBlock: string[];      // חיפוש טקסט מקורי (לפי סדר עדיפות)
    skipBlocks: string;             // meta / system (selector מורכב אחד)
    translationInsert: "afterText"; // איפה לשים .mc-ai-translation
    speaker?: {
      agentPatterns: string[];      // regex strings לזיהוי Agent vs Customer
      customerPatterns: string[];
    };
  };

  // --- Composer + toolbar (outgoing.ts) ---
  composer: {
    textarea: string;
    toolbar: {
      mode: "afterTextarea" | "insideContainer";
      container?: string;           // לשיחה ישנה: _toolbarContainer_
    };
    expiredWindow?: {
      enabled: boolean;
      containerSelector: string;
      wrapperSelector: string;
      detectTextPatterns: string[]; // /24 hours/i, /תבניות/
    };
  };

  // --- מגדר מנוי (subscriber-gender.ts) ---
  subscriber?: {
    titleSelector: string;
    enabled: boolean;
  };

  // --- סיכום שיחה (chat-transcript.ts) ---
  summary?: {
    messageWrapper: string;
    messageBlock: string;
    insertMode: "cloneWrapper" | "afterLastBlock";
  };

  // --- אילו פיצ'רים פעילים באתר זה ---
  features: {
    incomingAutoTranslate: boolean;
    outgoingTranslate: boolean;
    incomingGeminiButton: boolean;
    conversationSummary: boolean;
    subscriberGender: boolean;
    autoTranslateToggle: boolean;
  };
}
```

### 3.3 דוגמה: seed ל-Manychat

```json
{
  "slug": "manychat",
  "name": "Manychat",
  "enabled": true,
  "urlPatterns": ["https://app.manychat.com/*"],
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
        "agentPatterns": ["outgoing", "_typeout", "_botmessage", "message-out"],
        "customerPatterns": ["incoming", "_typein", "subscriber", "message-in"]
      }
    },
    "composer": {
      "textarea": "textarea[name=\"whatsappMessageInput\"][data-mc-editor=\"true\"]",
      "toolbar": { "mode": "afterTextarea" },
      "expiredWindow": {
        "enabled": true,
        "containerSelector": "[class*=\"_toolbarContainer_\"]",
        "wrapperSelector": "[class*=\"_wrapper_\"]",
        "detectTextPatterns": ["24\\s*hours?", "24\\s*שעות", "message templates", "תבניות"]
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

### 3.4 WhatsApp Web (טיוטה — ימולא אחרי מיפוי DOM)

```json
{
  "slug": "whatsapp-web",
  "name": "WhatsApp Web",
  "urlPatterns": ["https://web.whatsapp.com/*"],
  "domProfile": {
    "incoming": {
      "messageBlock": "…",
      "textWithinBlock": ["…"],
      "skipBlocks": "…"
    },
    "composer": {
      "textarea": "div[contenteditable=\"true\"][data-tab=\"10\"]",
      "toolbar": { "mode": "insideContainer", "container": "…" }
    },
    "features": { "…": true }
  }
}
```

> WhatsApp לרוב משתמש ב-`contenteditable` ולא ב-`textarea` — יידרש adapter נפרד ל-`setComposerValue` (כבר קיים לוגיקה דומה ל-React ב-outgoing).

---

## 4. ארגון ← אתרים

### 4.1 שינוי ב-`organizations`

```ts
// אופציה מומלצת
websites: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: "Website",
}]
```

- ברירת מחדל: `[]` (או seed עם Manychat בלבד לארגונים קיימים במיגרציה).
- ב-API של profile/session: להחזיר לא רק `organization` אלא גם `websites: [{ id, slug, name, urlPatterns, domProfile }]` (או רק `slug` + `urlPatterns` לתוסף, ו-`domProfile` נטען בנפרד לפי slug).

### 4.2 פרונט

- בעמוד יצירה/עריכת ארגון: **multi-select** של אתרים פעילים (`enabled: true`).
- שמירה: מערך `_id`.
- אופציונלי (שלב 2): מסך ניהול `websites` למנהל מערכת — עריכת סלקטורים בלי deploy תוסף.

---

## 5. תוסף Chrome — איך ליישם בצורה אופטימלית

### 5.1 זרימה מומלצת

```
[Login] → API מחזיר organization + websites[]
       → שמירה ב-chrome.storage (session + siteProfiles)
       → registerContentScripts(urlPatterns מאוחדים)  // או manifest סטטי + בדיקה בזמן ריצה
[content.js נטען] → התאמת location.href ל-website slug
                  → אם slug לא ברשימת הארגון → exit (לא עושים כלום)
                  → טעינת DomProfile → אתחול מודולים לפי features.*
```

### 5.2 Manifest MV3 — נקודה קריטית

- `content_scripts.matches` ב-manifest **סטטי** — לא ניתן לעדכן מ-DB בלי עדכון תוסף.
- **פתרונות:**
  1. **`chrome.scripting.registerContentScripts`** אחרי login — רישום דינמי לפי `urlPatterns` מהשרת (מומלץ).
  2. **manifest רחב** (`https://*/*`) + **gate בזמן ריצה** לפי רשימת הארגון (פשוט יותר, פחות "נקי" מבחינת הרשאות).
  3. **רשימת דומיינים ידועה ב-manifest** + עדכון תוסף כשמוסיפים אתר (לא גמיש).

**המלצה:** (1) + cache של profiles ב-storage; רענון בכל `getSession(forceRefresh)`.

### 5.3 Refactor קוד התוסף

| שלב | פעולה |
|-----|--------|
| A | `extension/src/site-profile/types.ts` — ממשק `DomProfile` תואם DB |
| B | `site-profile/resolver.ts` — `resolveSiteForUrl(href, profiles)` |
| C | `site-profile/defaults/manychat.ts` — fallback אם API נכשל |
| D | החלפת קבועים ב-`content.ts`, `outgoing.ts`, `chat-transcript.ts`, `subscriber-gender.ts` ב-`profile.incoming.*` וכו' |
| E | `background.ts` — טעינת profiles, `registerContentScripts`, gate לפני translate |

מבנה קבצים אפשרי:

```
extension/src/
  site-profile/
    types.ts
    resolver.ts
    context.ts          // getCurrentProfile()
  adapters/
    incoming-messages.ts
    composer-toolbar.ts
    conversation-summary.ts
    subscriber-gender.ts
  content.ts            // bootstrap: resolve + init adapters
```

### 5.4 API Backend

| Endpoint | תפקיד |
|----------|--------|
| `GET /api/websites` | רשימת אתרים (admin / בחירה בטופס ארגון) |
| `GET /api/profile` (קיים) | להוסיף `organization.websites[]` עם profiles מלא או מצומצם |
| `PUT /api/organizations/:id` | עדכון `websites[]` |
| אופציונלי `GET /api/websites/:slug/profile` | תוסף יכול למשוך profile עדכני |

**אבטחה:** רק אתרים שמקושרים לארגון של המשתמש יוחזרו ב-session — לא לחשוף את כל ה-`domProfile` לכל משתמש אם לא נדרש (אפשר להחזיר רק לפי slug מאושר).

---

## 6. סיכונים ומגבלות

| סיכון | הקלה |
|--------|------|
| Manychat משנה class hashes | עדיפות ל-`data-*`; שדה `domProfileVersion`; בדיקות ידניות |
| WhatsApp DOM משתנה / shadow DOM | פרופיל נפרד; בדיקות E2E; feature flags |
| תוסף רץ על דומיין לא מורשה | gate ב-runtime + registerContentScripts ממוקד |
| פרופיל שגוי ב-DB שובר אתר | validation ב-backend (סלקטור חובה לכל feature מופעל); fallback ל-default של slug |
| גודל session | לא לשלוח כל ה-domProfile בכל request — cache לפי slug |

---

## 7. תוכנית יישום מומלצת (שלבים)

### שלב 1 — תשתית (ללא WhatsApp)
- מודל `Website` + seed Manychat
- `organizations.websites[]`
- API + פרונט multi-select
- Session מחזיר `websites` עם `urlPatterns` + `domProfile`

### שלב 2 — Refactor תוסף
- `SiteProfile` + resolver
- Manychat נטען מ-API (עם fallback מקומי)
- `registerContentScripts` לפי ארגון
- בדיקות רגרסיה על Manychat

### שלב 3 — אתר שני (WhatsApp Web)
- מיפוי DOM + פרופיל `whatsapp-web`
- adapter ל-composer (contenteditable)
- בדיקות ידניות; אולי feature מושבת חלקית בהתחלה

### שלב 4 (אופציונלי) — ניהול
- UI מנהל לעריכת `domProfile` בלי deploy תוסף

---

## 8. תשובה ישירה לשאלותיך

**האם אפשר?** — **כן.**

**מבנה `website` ב-DB?** — מסמך `websites` עם `slug`, `name`, `urlPatterns`, ו-`domProfile` מקובץ לפי פיצ'רים (`incoming`, `composer`, `subscriber`, `summary`, `features`), לא רשימה שטוחה של "כפתור מין" בלי הקשר.

**אופטימלי?** — DB = מקור אמת; תוסף = מנוע גנרי + profiles; Manychat = seed ראשון; רישום סקריפטים דינמי לפי `urlPatterns` של הארגון; gate ב-runtime; refactor הדרגתי של 4 מודולים קיימים.

---

## 9. החלטות שכדאי לאשר לפני פיתוח

1. האם `domProfile` נערך רק ע"י מפתחים (seed + migrations) או גם UI למנהל?
2. האם WhatsApp Web הוא יעד שלב 3 או רק Manychat בשלב ראשון?
3. האם שם התוסף/manifest ישתנה מ-"Manychat Translator" לשם גנרי?
4. האם ארגון ללא `websites[]` = "כל האתרים" או "אף אתר"?

---

*מסמך הערכה — לא מימוש קוד. לאחר אישור ההחלטות ב-§9 ניתן לפתוח משימות פיתוח לפי השלבים ב-§7.*
