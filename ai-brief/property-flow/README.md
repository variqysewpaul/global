# "Protected property" scroll flow — Gemini prompt pack

**The idea.** One house, seen through the whole page. The hero is the house going from dusk to night with its security lights
and camera coming alive. Then, as each service is described, the scene cuts to the part of the house it protects: the gate
motor, the beam posts and sensor, the CCTV camera, the alarm keypad, the response arriving.

**Do I need several videos?** Yes: one short clip per service. The trick to keep it looking like *one house* is to make a master image of the
house first and base every clip on it. Never prompt each clip from scratch.

## Rules for every prompt

- 16:9, highest resolution offered, 6–8 s clips. Make 3–4 takes of each and pick the best.
- **No text, no logos, no signage, no number plates, no people** in any prompt. Generators garble these, and leaving them out is what keeps the footage reliable.
- Ask for a **locked-off, tripod** camera unless the camera movement is the point (CCTV pan).
- Upload the master house image as the reference for every still and clip.

## Step 1 — master images (the house)

**1A. Dusk, lights off** (hero start frame)
> Photorealistic photograph, 16:9, of a modern single-storey family home in Newcastle, KwaZulu-Natal, South Africa, at dusk (blue hour,
> the sky still faintly lit), shot from across the street at eye level on a 28 mm lens. Plastered cream walls, dark grey tiled roof, a low
> plastered boundary wall with black steel palisade fencing above it, a black sliding steel gate across a paved driveway with a small
> gate-motor housing at the gate post, a white CCTV bullet camera mounted high on the corner of the house under the eave, a small white
> motion sensor on the wall by the front door, two slim beam-sensor posts either side of the driveway, a neat lawn and a few shrubs.
> All lights are off. No people, no vehicles, no text, no signage, no number plates, no logos. Natural, slightly desaturated,
> cinematic photography.

**1B. Night, protected** (hero end frame). Use 1A as the input image and ask for an edit:
> Same house, same camera position and framing, same architecture and materials. Now at night: deep blue sky, warm light in two
> windows, bright white security floodlights on above the front door and on the corner of the house, driveway lights on, a small red
> indicator light glowing on the CCTV camera, a soft amber light on the gate motor. Keep everything else identical. No people, no text.

## Step 2 — hero clip (image-to-video, start = 1A, end = 1B if your Gemini version accepts an end frame)

> Locked-off tripod shot, no camera movement. Dusk deepens into night: the sky darkens, then the security lights come on in sequence —
> the front-door floodlight, the corner floodlight, the driveway lights — and the CCTV camera's red indicator starts to glow. The
> windows warm up. Smooth, natural exposure change, no flicker artefacts, nothing else moves. No people, no vehicles, no text.

## Step 3 — close-up stills, one per service

For each, upload the master image (1B) and use this prefix, then the scene line:

> Using the attached house as the reference for its architecture, materials, colours and night lighting, create a photorealistic 16:9 night photograph, close-up:

| Clip | Scene line for the still |
|---|---|
| **Gate motor** | …of the black sliding steel gate and the gate-motor housing at the gate post, with a toothed rack along the base of the gate and a small amber indicator light on the motor. |
| **Beams & sensors** | …a low-angle view along the boundary wall with two slim beam-sensor posts about three metres apart, a faint pink-red beam visible between them, and the small white motion sensor with a tiny red LED on the wall behind. |
| **CCTV** | …a white bullet CCTV camera mounted under the eave at the corner of the house, red status light on, with the floodlight above it and the gate and driveway softly out of focus behind. |
| **Alarm keypad** | …a wall-mounted alarm keypad in the hallway just inside the front door, backlit keys (no readable text), green status light, a warm glow from the porch visible through the door glass. |
| **Armed response** | …the house gate seen from across the street, wet pavement, no vehicle visible, the scene empty and quiet. |

## Step 4 — animate each still (image-to-video)

Start every prompt with: *"Locked-off tripod camera, no camera shake, photorealistic, no text, no people."* Then:

- **Gate motor.** The black sliding gate rolls smoothly closed across the driveway, driven by the motor; the toothed rack moves past the motor and the pinion gear inside the housing turns slowly; the amber light blinks. Calm, mechanical, realistic.
  *(Optional 1b, macro: extreme close-up of a steel pinion gear turning against a toothed rack, a sheen of oil, shallow depth of field.)*
- **Beams & sensors.** The faint pink-red beam shimmers between the two posts and pulses once; the sensor's small red LED blinks; a few insects drift through the light. Nothing else moves.
- **CCTV.** The camera pans slowly and smoothly about 30 degrees from the gate toward the front door with a soft motorised movement; the red light stays on; the lens catches a faint reflection. The background stays still. *(Here the camera is allowed to move: only the CCTV camera itself, not the shot.)*
- **Alarm keypad.** The status lights change from green to red; the backlight pulses once; no hands, no readable text.
- **Armed response.** Bright white headlights sweep across the gate and wall from the left as an unseen vehicle arrives and stops just out of frame; light flares across the wet pavement. No vehicle visible, no text.
- **Optional: control room.** Slow push-in over an operator's shoulder toward a wall of CCTV monitors in a dim room with a cool blue glow; no readable text, no faces. This one is better *filmed* in the real control room if the client allows it.

## QA checklist (reject a take if it fails)

- [ ] It is clearly the same house as the master image: roof, windows, wall colour, gate style
- [ ] No text, logos, plates or people appear
- [ ] Mechanical parts behave: the gate moves in one direction, gears turn without melting or changing size
- [ ] The camera is locked off (except the CCTV pan)
- [ ] Lighting matches the hero's night look, with no sudden exposure jumps or flicker

## How it becomes the site

1. Send me the clips (or put them in `ai-brief/property-flow/`). I convert each to frames (`scripts/make-frames.mjs`).
2. **Hero:** the dusk-to-night clip, scrubbed by scroll, replaces the van.
3. **Services tour:** a sticky stage where each service's text takes its turn on the left and its clip plays on the right, scrubbed by scroll, with a crossfade between clips. The text stays in normal HTML so it's readable and accessible.
4. **Weight:** hero loads first; each service clip loads as you approach it. Around 96 frames per clip (12 fps) with frame blending keeps it to roughly 6 MB per clip on desktop and half that on phones.
5. **Reduced motion / low data:** one still frame per service, with the text in plain cards, as now.
