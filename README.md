# TerraTrack

Your carbon bank account. Log what you did by voice or text, see what it cost in CO₂,
and watch your net daily footprint fall when you do eco-friendly things.

Approximate factors; a habit tool, not a certified carbon report.

## Run it

You need Node.js 22 or newer (the LTS version from nodejs.org is fine) and Chrome or Edge.

```
npm install
npm run dev
```

Then open http://localhost:5173 in Chrome.

Run the tests with `npm test`.

## Login and online database (Supabase)

Without Supabase the app runs on one device, with a Student / College switch for demos.
With it, everyone signs in and their data is saved online.

1. Create a project at https://supabase.com (region Mumbai).
2. Authentication > Sign In / Providers > Email: on, and turn **Confirm email** off.
3. SQL Editor > New query: paste all of `supabase.sql` and press **Run** (once).
4. Project Settings > API: copy the Project URL and the anon key into `.env`
   as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart `npm run dev`.
5. Create a **college** account first. Its dashboard shows a 6-letter code.
   Students create a **student** account and enter that code.

Who sees what (enforced by the database rules in `supabase.sql`): your entries are only yours;
your college sees daily totals for the leaderboard and the tree photos you send; only the
college account can post updates, run challenges, give rewards and approve photos.

## On your phone (for the GPS trip tracker)

GPS in a browser only works over https. With the phone and laptop on the same Wi-Fi:

```
npm run dev:phone
```

Open the `https://192.168.x.x:5173` address it prints (the "Network" line) in Chrome on your phone.
Chrome warns that the certificate is not private: tap **Advanced → Proceed**. That's expected for a home-made certificate.

## The AI key

Copy `.env.example` to `.env`, then replace `paste-your-key-here` with your free key from
https://aistudio.google.com/apikey and restart `npm run dev`.
Never share `.env` or upload it to GitHub (it is already in `.gitignore`).

The app works without a key too: typing and chips use the built-in keyword parser,
and the Coach writes its plan from a template.

## What's in it

| Screen | What it does |
| --- | --- |
| Today | Net footprint ring against the 6 kg budget, today's entries with Pro / Neutral / Con, quest, year forecast |
| Log | 9 tabs, mic (English or Hindi), type a sentence, or tap a chip. A confirm card shows kg before saving |
| Insights | 7-day chart, categories, saved vs usual, Carbon Coach with a summary for every category, What-if sliders |
| Wallet | Trees whose credit grows with age, direct credits, the 30% cap |
| Settings | Usual commute and meal, budget, voice language, Maths check, AI test set, demo data |

How the AI is used: Gemma 4 (open weights) only turns words into known items and writes the
Coach text. Every kg number comes from `src/data/emission_factors.json` and `src/lib/calc.js`.
If Gemma takes more than 45 seconds or fails, the app tries the Gemini backups, then the
keyword parser.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| `Cannot find native binding` on `npm run dev` | `rm -rf node_modules package-lock.json`, then `npm install` again |
| Status dot says the AI key is wrong | Check `.env` has `GEMINI_API_KEY=...` with no quotes or spaces, then restart `npm run dev` |
| Mic button does nothing | Use Chrome or Edge, allow the microphone, and check you're online |
| Old data looks odd | Settings, Delete all data, then Load demo data |

For the demo day, see [DEMO.md](DEMO.md).
