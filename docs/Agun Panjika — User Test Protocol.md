# Agun Panjika: user test protocol (PRD success metric)

The PRD sets two targets for this test:

- A first-time user answers "is this fire season normal?" in **under 10 seconds**.
- The page loads in **under 3 seconds** on mobile 4G.

Run the test with 5 people who have not seen the app, on the deployed site, each on their own phone.

## Timing test

1. Give the phone with the browser closed. Read aloud, in the participant's language: "Open this link and tell me whether this year's fire season in Bandarban is normal."
2. Start the stopwatch when the link opens. Stop it when the participant says the answer: below normal, normal, above normal, or extreme.
3. Write down:
   - the time
   - whether the answer was correct
   - whether they used Bangla or English
   - anything they tapped first
4. Ask: "What does the percentile mean to you?" Note the answer word for word.

**Pass:** the median time is under 10 seconds, and at least 4 of 5 answers are correct.

| Participant | Language | Time (s) | Correct? | First tap | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## Load test (Lighthouse)

1. In Chrome on a laptop, open DevTools, then Lighthouse.
2. Select the Mobile preset with simulated "Slow 4G" throttling, then run it on the deployed URL.
3. Record:
   - First Contentful Paint
   - Largest Contentful Paint
   - Total Blocking Time
   - the Performance score

**Pass:** Largest Contentful Paint under 3.0 s.

## Bangla wording check (native speaker and CHT reviewer)

Go through every screen in Bangla and mark each string as OK, unclear, or wrong. Pay attention to:

- the alert levels
- the outlook sentences
- the jhum-related wording (no blame)
- the district and upazila names

Union names are English only for now; list any that need Bangla.
