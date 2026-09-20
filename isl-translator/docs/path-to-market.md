# Path to market

ISL Bridge demonstrates a connected counter workflow. These are the remaining production gaps verified in this codebase:

1. **Identity and access:** counters have no owner authentication; role labels and short codes are not access controls. Add staff sign-in, counter ownership, per-session authorization, rate limits, and restricted HTTP/WebSocket origins. The current wildcard origins are suitable only for a controlled demo.
2. **Durability and scale:** counter metadata already persists to a local JSON file, but conversations and participant state remain in one server's memory. Move them to a database with explicit retention/deletion policies, replace the in-process STOMP broker for multiple instances, and load-test concurrent counters, reconnects and provider delays.
3. **Recognition coverage:** only Help, Ticket, Train and idle are trained. Collect consented, diverse signer data, broaden vocabulary, and evaluate on signers excluded from training, including lighting, handedness and motion differences. The recorded demo fixtures do not establish population-level accuracy.
4. **Reliable speech and translation:** browser speech depends on browser/service/network support; Gemini needs a valid key, quota and connectivity. Add operational monitoring, retries/circuit breakers and an evaluated speech fallback. Professionally review Hindi accuracy, preserve names/numbers, and evaluate additional regional languages before promising them.
5. **Deployment and accessibility:** provide trusted HTTPS for real two-device camera/microphone access, manage server secrets, document consent and vendor data handling, and complete keyboard/screen-reader/mobile and WCAG audits with Deaf and Hard-of-Hearing users. Existing labels, language tags and contrast improvements are not a formal accessibility certification.

Faculty summary: “The counter workflow and bilingual exchange are implemented. Production work remains in staff authentication, durable shared storage, broader sign-model validation, dependable speech and translation services, and deployment/accessibility testing with users.”
