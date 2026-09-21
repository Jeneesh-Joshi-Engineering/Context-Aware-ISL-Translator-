# Your next 48 hours of data collection

The priority is reliable counter conversations. Add a small set of useful signs and strengthen the words already collected before expanding further.

## What is in your folder

The current word-only run is `words_v4`. Alphabet experiments are archived and excluded from training by default. These are usable unique counts after filtering; cumulative exports are not independent examples.

| Label | Unique recordings |
| --- | ---: |
| Train | 46 |
| Police | 24 |
| Counter, Exit, Receipt | 30 each |
| Help | 28 |
| Where (case variants combined) | 27 |
| When | 12 |
| Ticket | 26 |
| Entrance | 23 |
| Money | 18 |
| No_Gesture | 20 |
| Security | 17 |
| Hello | 7 |

The completed training report is authoritative for usable counts: blank-hand sequences and conflicting labels are excluded. A file containing 30 older examples plus one new example adds only one new recording. Do not count exports or augmentation as new human examples.

The current model uses **331 unique recordings**, split into 233 training, 49 validation and 49 test clips. Hello's seven examples are excluded. Test accuracy is **39/49 (79.59%)**; this is a development holdout, not an unseen-signer benchmark. Recollect **When, Security, Help and idle** first; their test recall is respectively 0/2, 1/3, 2/4 and 1/3. See [full results](word-model-results.md). Interpolation does not recover motion that the camera never captured.

## Collect these first

These are priorities for this counter demo, not a claim that every gesture is easy for the current feature representation.

| Priority | Label to collect | What it adds to the demonstration |
| --- | --- | --- |
| 1 | Platform | Essential railway enquiry alongside Train and Where |
| 1 | Toilet | A practical accessibility and public-facility request |
| 1 | Water | A common basic assistance request |
| 1 | Yes | Lets the signer confirm an official's response |
| 1 | No | Lets the signer reject or correct a response; separate from No_Gesture |
| 1 | Repeat | Lets the signer request clarification |
| 2 | Cancel | Extends ticket support beyond asking for information |
| 2 | Refund | Completes a useful ticket/payment assistance scenario |

Target **60 independent takes per new word**: ideally five consenting signers × twelve takes, spread across three short recording sessions. Prioritize the first six words (360 takes); Cancel and Refund are stretch goals (120 more). These are practical collection targets, not a guarantee of accuracy. If recruiting five signers is impossible, collect from at least three, document that limitation and reserve fresh sessions for evaluation.

Before adding these words, top up Help, Security, Money, Entrance, Ticket, Where and When to at least 50–60 usable takes each. The first expanded-model evaluation exposed particular weaknesses in Help, When and idle recognition, so recollection of these takes takes priority over adding extra labels. Increase Hello from seven to at least 50 if you want greeting recognition. Page text saying Hello / नमस्ते / नमस्कार does not require model training.

Collect **100–150 No_Gesture / transition takes**: visible hands resting, ordinary non-sign hand movement, and pauses between signs. Keep the label spelling exactly `No_Gesture`. At least 15 frames must contain tracked hands for the present trainer; completely empty frames are rejected and the live UI handles absent hands directly. Many classes with very little idle data increase false recognitions.

Defer Price, Delay, Hospital, Luggage, Thank_You, numbers and alphabets until these core tasks pass. Alphabet recognition is no longer active. Continuous fingerspelling and sentence-level grammar require separate work.

## How to record useful examples

1. Verify each intended sign and meaning with a fluent ISL signer; use the official [ISLRTC dictionary](https://islrtc.nic.in/isl-dictionary/) as a reference. Do not invent an English-word gesture or silently substitute ASL. The [ISLRTC FAQ](https://islrtc.nic.in/faq/) explains that the dictionary includes sign videos with English/Hindi equivalents and distinguishes meanings of ambiguous words.
2. Keep a simple record of `participant_id`, `session_id`, label and capture date, using anonymous identifiers such as P01/S01. Preserve that mapping with each export. Reserve at least one participant for the final test; do not use their recordings or augmented versions in training or model selection.
3. Capture one complete sign per 30-frame sequence. Include the meaningful motion, not only the final handshape or the return to rest. Confirm overlays are tracking the fingers before saving.
4. Keep both hands visible. Capture a few natural changes of distance, angle, speed and lighting; avoid extreme conditions that obscure the sign. Spread takes over separate sessions so they are not near-identical bursts.
5. Review every class for wrong labels, dropped hands, truncated motion and duplicate exports. Keep a consistent canonical label (`Where`, not separate `where` and `WHERE` classes).
6. Keep original recordings unchanged. Deduplicate first, reserve validation/test data, then augment only training data. See [scikit-learn's evaluation guidance](https://scikit-learn.org/stable/modules/cross_validation.html) for why held-out evaluation matters.

## Where to save the new data

Save exports under `C:\BE Project demonstration\isl-translator\model-training\dataset\raw\<Label>\`. Examples: `Platform`, `Water`, `No_Gesture`. The JSON sequence's `label` is authoritative; renaming a folder does not change a mislabeled recording. Every `frames` array must contain 30 arrays of 126 finite numbers. Do not rename a video file to `.json`.

Keep anonymous participant/session identifiers and exact filenames in a separate collection log. The present trainer uses chronological splits and does not yet consume participant metadata. Keep the reserved participant's recordings outside `dataset/raw` (for example `dataset/heldout-new-signers`) until participant-aware evaluation is implemented; otherwise they may enter training. Do not assume writing an ID alone makes the current split participant-independent.

Adding files does not immediately add recognition support. Run a fresh training version, inspect class metrics, export it, prepare assets and restart the server. New glosses also need offline English/Hindi phrase mappings and integration tests. The six proposed words are collection targets and are not recognized by the current deployed model.

Important model limit: the current 126 features are hand landmarks normalized relative to each wrist. They do not include facial expression, body position, or the absolute movement of the wrists. Signs differing only by where the hands sit relative to the face/body can become indistinguishable. Compare confusing pairs before spending hours collecting them. Supporting those distinctions needs pose/position features and a new input pipeline, not just more examples of the same representation.

## A practical schedule

| Time | Work |
| --- | --- |
| Hours 0–4 | Confirm the eight signs, label names, consent and participant/session IDs; pilot five takes per sign and inspect tracking. |
| Hours 4–16 | Collect the first sessions and top up weak existing words. Review exports after each short batch. |
| Hours 16–24 | Collect remaining participants and varied sessions; collect idle/transition negatives. |
| Hours 24–32 | Audit duplicates, labels and framing. Re-record weak or confusing classes. Freeze a participant-held-out test set. |
| Hours 32–40 | Train using training/validation only; inspect per-class confusion and confidence. Keep the final test untouched until the model is selected. |
| Hours 40–48 | Run the final held-out test, live browser recognition and bilingual conversation checks. Rehearse and record honest limitations. |

After collecting, training and integrating the new words, demonstrate three short workflows: finding a platform; asking for water/toilet assistance; and a ticket/refund conversation with Yes/No/Repeat. For today's build, use the existing Counter, Entrance, Exit, Ticket, Train, Money and Receipt words, rehearsed with the actual signer first. Present the workflows as turn-by-turn assistance.
