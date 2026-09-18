# Transit-Hub ISL Vocabulary

## MVP: train now

- `Help`
- `Train`
- `Ticket`
- `No_Gesture`

`No_Gesture` means no intended command/sign, not a missing-hand recording. Record it
with hands visible in natural idle positions and ordinary non-command motion.

## Later expansion: separate dataset/model version

- `Lost`, `Where`, `When`, `Problem`, `Police`, `Security`, `Medical_Help`, `Money_Pay`
- `Luggage_Bag`, `Bus`, `Flight`, `Platform`, `Counter`, `Washroom`, `Exit`, `Entrance`
- `Seat`, `Reservation`, `Receipt`, `Change_Exchange`, `Information`, `Late_Delay`
- `Now`, `Next`, `Left`, `Right`, `Straight`, `Cancel`, `Schedule`, `Yes`, `No`, `Please`
- `Thank_You`, `Deaf`, `Understand`, `Not_Understand`, `Wait`

Use these exact machine labels when the expansion begins. Do not add a label to the
MVP `labels.json` until it has enough real recordings to be included in every split.

## Collection standard

Collect at least 50 unique recordings per MVP label before the first training run;
100+ per label across several signers is preferred. Export one completed session once,
give the file a signer/session name (for example `jeneesh_session01.json`), and do not
re-export accumulating copies of the same sequences.
