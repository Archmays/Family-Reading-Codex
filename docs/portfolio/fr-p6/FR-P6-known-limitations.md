# FR-P6 known limitations

## Status

FR-P6 completed with four documented environment limitations and zero quality compromises. Each limitation records an unavailable external capability and the bounded evidence used instead. Emulation or indirect checks are not represented as the unavailable capability.

## NATIVE_BROWSER_ZOOM_AUTOMATION_UNAVAILABLE

The installed browser automation path did not expose controllable native browser zoom. FR-P6 therefore does not claim a native-zoom pass.

Eight CSS viewport-equivalent samples from 80 through 200 percent passed as bounded responsive-layout evidence. They are recorded separately from native zoom.

## PHYSICAL_IOS_ANDROID_UNAVAILABLE

No physical iOS or Android device was connected to the acceptance environment. FR-P6 therefore does not claim physical-device coverage.

The bounded substitute covered CSS widths from 320 through 1,440 pixels, DPR 1 through 2, the 1,088/1,089 breakpoint, short-landscape layouts, 15 responsive-image cases, touch-size checks, and 545 geometry samples.

## EXTERNAL_SCREEN_READER_AUTOMATION_UNAVAILABLE

No inspectable external screen-reader session or speech-output capture was connected. The presence of a Windows Narrator binary is not treated as evidence that a screen-reader session ran.

Keyboard navigation, focus placement, accessible names, route announcements, current-location state, answer disclosure state, reduced motion, forced colors, text spacing, and reflow passed as bounded browser evidence. These checks are not represented as external screen-reader output.

## MULTI_POP_CDN_OBSERVATION_UNAVAILABLE

The final Pages handoff can observe only the CDN point of presence reached by the acceptance environment. FR-P6 does not claim global CDN point-of-presence coverage.

The handoff records the observed point of presence, exact deployed SHA, representative live bytes, ETag behavior, cache headers, missing-file response, and all 12 audio byte-range responses. Platform-controlled mutable-cache directives and MP3 MIME spelling are observations within this limitation, not a fifth product defect.

## Accepted boundaries that are not additional limitations

- The mobile Lighthouse performance score of 82 meets the frozen threshold; accessibility, best practices, and SEO scored 100, and all four desktop categories scored 100.
- The current Carmela recordings are whole-book audio without reliable scene-marker evidence. Marker behavior is `NOT_APPLICABLE_NO_RELIABLE_MARKERS`; no marker timing is fabricated.
- The tracked final main SHA, Pages result, and workspace result use `RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF` because a commit cannot truthfully contain its own future SHA or deployment result.
- Local exact-byte HTTP results are precursors to, not replacements for, post-commit Pages checks.
- Rights remain `PASS_BY_USER_AUTHORIZATION`; Source immutability, privacy, and public-repository safeguards passed independently.
