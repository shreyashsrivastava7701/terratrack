# Demo day guide

## Before you start (5 minutes)

1. Connect to a phone hotspot, not the venue Wi-Fi.
2. Run `npm run dev` and open http://localhost:5173 in Chrome.
3. Settings: tap **Load demo data**. Check the Maths check card says 7.33 kg.
4. Settings: tap **Run test set**. It should score 9 or 10 out of 10, and the status dot turns green.
5. Log: tap the mic once and allow the microphone, so the browser doesn't ask during the demo.
6. Insights: tap **Write my plan** once, so the plan is ready (and cached) before judges arrive.
7. Go back to Today. Zoom the browser to 110% so the back of the room can read it.

## The 3-minute script

| # | Time | Screen | Do | Say |
| --- | --- | --- | --- | --- |
| 1 | 20 s | Today | Point at the ring | "A mutton thali costs seven times the CO₂ of dal-rice. Most of us never see that number." |
| 2 | 40 s | Log, Transport tab | Tap the mic, say **"aaj 8 km auto se gaya"**, then Save | "It understood Hinglish. The card shows 0.8 kg and a Neutral badge before anything is saved." |
| 3 | 40 s | Today | Scroll the entries | "AC and the chicken meal are Cons. Each one shows the better swap and how much it saves." |
| 4 | 40 s | Log, Eco tab, then Wallet | Log compost and "planted a tree", then open Wallet | "A new tree absorbs almost nothing in year one. Trees can cover at most 30% of a day. Reduce first, offset second." |
| 5 | 20 s | Insights | Move the What-if sliders to metro and a veg meal | "Same week, one change, and the net drops." |
| 6 | 20 s | Insights, then Settings | Show the Coach plan and the category list, then the status dot and test score | "Gemma 4, an open-weights model, reads the words and writes the plan. Code computes every number." |

If the AI is slow: type the sentence or tap the chips. They need no model.
If the internet is down: the demo data is already loaded, so show Today, Wallet and Insights, then play the backup video.

## Recording the 90-second backup video

- Use a phone hotspot and record the browser window only (on Mac: Cmd + Shift + 5, "Record Selected Portion").
- Load the demo data first and zoom Chrome to 110%.
- Follow the script above but faster: about 15 seconds per step.
- Say the voice sentence clearly, close to the laptop mic.
- Record twice and keep the better take. Save it on the laptop and on a USB stick, not only online.
- Check the sound plays from the laptop speakers before the round.

## Honest answers judges like

- The emission factors are approximate; it's a habit tool, not a certified carbon report.
- Credits are self-reported, so they can be gamed. The 30% cap and small credit values limit that.
- Browser speech sends audio to Google's or Microsoft's speech service.
- The parser was tested on 10 sentences (Gemma scored 9/10). That's a small sample.

## New Q&A answers (things we added after the guide was written)

**What if Gemma is slow or down?** The app waits up to 45 seconds for Gemma 4, then tries two
Gemini models for 15 seconds each, then uses our own keyword parser. The status dot shows which
one answered. Gemma stays the main model, and the test score is Gemma only.

**What if someone says an item you don't have?** Gemma picks the closest known item, and the confirm
card marks it as a closest match so the user can change it.
We added 23 common items like e-rickshaw, pizza and social media.

**Does the Coach make up numbers?** No. Code works out the top category, its share and the
savings. Gemma only writes the sentences, and any number it adds that we didn't give it gets
the answer rejected. Below the plan, the app shows every category with its share and the single
best swap there, all from code.
