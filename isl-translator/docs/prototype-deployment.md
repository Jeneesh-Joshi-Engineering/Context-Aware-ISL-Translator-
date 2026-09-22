# words_v5 deployment and handover

## Changes and evaluation

The prototype-in-deployment branch retains the speech and Android HTTPS work from Suggestions-by-Mentors and adds words_v5. All 23 active words have English/Hindi offline phrase translations. Medical_Help and What_Time are normalized consistently. The confidence gate remains 60%.

Training: 582 unique usable recordings; 408 train, 87 validation, 87 test. Test top-1 accuracy 68/87 (78.16%). This is not signer-independent. Selected training clips pass model → gloss → backend → both-client integration; this does not establish live accuracy. See word-model-results.md and saved_model/words_v5/training-report.json.

## Permanent HTTPS hosting

The root Dockerfile builds browser dependencies, runs Java tests, and serves frontend, API and WebSockets from one Java process. render.yaml defines a free Render web service on this branch. PORT comes from the host. No local .env, raw training dataset, or archived model is copied into the image. The server runs as a non-root user.

Render configuration: Web Service; this repository; branch prototype-in-deployment; Docker runtime; repository root context; Dockerfile ./Dockerfile; Free instance; health check /api/health. Set GEMINI_API_KEY as a secret, GEMINI_MODEL=gemini-3.6-flash, COUNTER_STORE=/app/data/counters.json, and DEPLOYMENT_ACCESS_CODE to a random secret of at least 24 characters. The Blueprint can generate the access code. Never commit these values or paste them into chat.

The access code is a shared invitation for faculty testing, not per-staff authentication. It issues an eight-hour HttpOnly, SameSite cookie (Secure over HTTPS); APIs and WebSocket handshakes require it. Each phone must enter the code before opening its counter. REST and WebSockets use same-origin policies. A production transit installation still needs staff authorization, monitoring, durable storage, independent validation and operational approval.

Open /official.html on the hosted domain. Enter the invitation code, create a counter and display its QR. On Android Chrome, scan the QR, enter the code, tap Start / retry camera and grant access. The official selects English/Hindi, starts and stops recording, reviews the transcript, then sends. General translation and Gemini transcription need a working server key and available quota. Browser dictation support varies; typed text remains available. The local key is not automatically copied to Render.

Free Render instances sleep after inactivity; initial loading can be slow. Their filesystem is ephemeral: saved counter IDs and conversation state can disappear on restart/redeploy. Recreate the counter and QR after a reset. This is an invited demonstration, not an always-on installation. Paid hosting and durable storage require a separate spending decision. Sources: https://render.com/docs/free and https://render.com/docs/disks.

## Verification scope

Local Java package: 21 tests passed. JavaScript/model tests: 11 passed. Recorded integration: all 23 words, bilingual messages to both clients, counter busy state, session end/restart and manual sessions passed. Python/browser probability parity: all 87 held-out sequences passed. Access-gate tests cover correct/incorrect codes, forged cookies, secure cookie flags, QR return paths, WebSockets and local mode.

Earlier Android Chrome testing was confirmed by the user for the previous model. New-model unseen-person/live-camera testing and Hindi microphone accuracy remain unmeasured. Earlier real Gemini tests passed sampled bilingual text and synthetic English audio but also encountered provider 429/503 errors; uninterrupted availability is not claimed.

## Next 48 hours of dataset work

Strengthen existing labels before adding many more. Record 20–30 additional independent clips per priority word, across several people and two sessions, varying lighting and distance. Record signer/session IDs separately to hold out an untouched participant.

1. Flight, Pay, When: zero recall on small test subsets (2, 4, 2 clips). Check labels and sign distinctiveness first.
2. No_Gesture, Security, Help, What_Time: collect neutral transitions and confusing signs; validate Time / What_Time / When with a competent signer.
3. Problem has only 10 usable clips and Hello only 7; both were excluded below the minimum 12. Aim for 25–30 usable clips each, not merely two/five more.
4. Lost has 12 usable clips and Flight 15. Large cumulative exports do not equal independent clips; duplicates are removed.
5. After that, useful transit additions are Platform, Gate, Toilet, Water, Yes, No, Thank_You. Confirm signs and labels first, and include only words for which 25–30 independent clips can be collected.

Suggested allocation: 4 hours review labels/tracking; 24 hours collect priority classes; 8 hours capture separate participants; 12 hours audit, train, evaluate and rehearse. This is a proposed schedule, not completed work. Keep at least 15 tracked frames per clip and all relevant hands visible. Duplicates and augmentation are not new recordings.
