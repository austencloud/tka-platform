# Full Project Description (500-word max)

The Kinetic Alphabet is a notation system for flow arts. Flow arts is spinning staves, fans, and clubs in coordinated full-body patterns, often on fire. Earlier attempts at flow-arts notation couldn't capture the sequences I wanted to write, so I built one that could. Twenty-four letter forms, each with its own pictograph, map hand positions and movements through space. A browser-based app I built animates notated sequences with 3D avatar performers, built for flow artists to design choreography, share files, and build shared vocabulary. Reference books are published, and a card game is in development.

Inside that app, the avatars are the gap. They execute notated sequences by placing their hands at idealized grid targets and letting inverse kinematics fill in the rest. The result is stiff CG figures that clip through their own arms, because the notation's math doesn't know anatomy. Flow artists don't spin on perfect circles. They navigate their own bodies, above the shoulder, behind the elbow, inside the armpit, using a vocabulary of biomechanical routes that has never been written down.

Over two years, I will use motion capture rented from a university lab and AI-assisted analysis to formalize the finite set of routing descriptors performers use to pass props around their anatomy. Self-narrated capture sessions, where I name each routing choice aloud as I spin, produce auto-labeled training data that Claude then helps segment into a structured vocabulary. The output is a public dataset, an open-source library, and upgraded avatars that spin with the body-intelligence of working performers.

The research is both culturally and compositionally relevant. Culturally, flow arts has no academic footing. Dance and music have centuries of notation infrastructure behind them. Flow arts has YouTube and oral tradition. The Kinetic Alphabet gives the form a systematic foundation. Compositionally, the routing vocabulary lets performers who've never met build acts together. Two spinners in separate cities can notate a duet in the app, share the file, and rehearse against avatars that move the way their bodies actually will.

Three public artifacts demonstrate the work. The notation app is live and publicly available. The Kinetic Archive is a narrative 3D museum currently in prototyping. Its design stages a fabricated 40,000-year history of movement notation as institutional fact, and its wax-figure avatars will be among the first subjects the new biomechanical data animates. The dataset, routing-vocabulary specification, and codebase will be released openly so other performers, researchers, and technologists can build on them.

The work aligns naturally with an AI-partnered lab. Recognizing a finite vocabulary of body knowledge underneath enormous surface variation is a pattern problem language and vision models have only recently become good enough to handle. I already use Claude daily in this project's development. Working inside a lab that partners with Anthropic would sharpen that loop. By the end of the grant, flow arts will have something it has never had: a legible, shareable, computationally faithful account of what the body does when a performer spins.

---

**Word count:** 496 words
**Revisions from v1:**
- Rewrote "there was no way to write flow arts down" → "Earlier attempts at flow-arts notation couldn't capture the sequences I wanted to write, so I built one that could"
- Added pictograph, reference books, and card game context in P1
- Introduced "3D avatar performers" in P1 so P2's "the avatars are the gap" lands
- Plural avatars throughout (was mixing singular/plural)
- Cut "The notation works on paper. The rendering app works in a browser. What doesn't yet work is the bridge between them" → "Inside that app, the avatars are the gap"
- Cut "This project closes that gap" — P3 now starts directly on the work
- "The research has a cultural purpose and a compositional one" → "The research is both culturally and compositionally relevant"
- Broke the semicolon-triple: "Dance has Labanotation and conservatories; music has centuries of notation theory; flow arts has YouTube and oral tradition" → "Dance and music have centuries of notation infrastructure behind them. Flow arts has YouTube and oral tradition"
- Museum corrected: removed Unreal Engine claim, framed honestly as "currently in prototyping"
- Cut "isn't a framing; it's a tool the project actually uses" → "I already use Claude daily in this project's development"
- Semicolons in P5 and P6 converted to periods
