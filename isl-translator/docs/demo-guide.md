# Transit Hub Demo Guide

Set `GEMINI_API_KEY`, then run `mvn spring-boot:run` from `backend`. Serve `frontend` over a local web server (camera access requires a secure context or localhost). Open `index.html?role=deaf_user&sessionId=demo1` and `index.html?role=official&sessionId=demo1` in separate browsers.

Select live translation for the passenger. A Tier 1 trained model can send `Ticket` and `Help`; after the Tier 2 urgent batch is recorded it can also send `Lost`. Gemini returns a polite transit-staff-facing sentence. On the official screen, press **Start staff voice response**; finalized speech is displayed on the passenger screen. Use the QA checklist before presenting.
