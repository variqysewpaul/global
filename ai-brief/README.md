# AI generation brief — Global Security Solutions arrival shot

Goal: one photoreal 16:9 clip (8–10 s) of the response van driving at the camera on a wet night road, braking, swinging
off with the wheels turned, and bouncing on its suspension — plus a matching hero still. The site scrubs it by scroll.

## What's in this pack

| Path | Use it for |
|---|---|
| `reference/ref-1…4` | **Appearance truth.** Your four real photos: livery, canopy, wheels, proportions. |
| `previs/K0-hero-parked.png` | Composition guide: hero still (van parked, 3/4 front). |
| `previs/K1-arrival-start.png` | Composition guide: **start frame** (van ~80 m away, headlights on). |
| `previs/K2-approach-mid.png` | Optional mid-point guide. |
| `previs/K3-final-stop.png` | Composition guide: **end frame** (van stopped at a 3/4 angle, front wheels turned right). |
| `previs/guide-arrival-1280x720-24fps.mp4` | Timing/motion guide: 8 s drive-in, hard brake at 8.0 s, bounce until 10.5 s. |

The `previs` frames come from the site's own 3D scene. They fix **camera, position, pose and timing only**. The 3D van is a
stylised stand-in, so don't let the AI copy its look. Also ignore the pink wedge (a CCTV field-of-view effect) and the glowing
stripe on the gate: describe the surroundings in text instead. The guide video has a small camera jolt at the stop; ask for a locked-off camera.

## The van — paste into every prompt

> A white Chevrolet Utility single-cab bakkie (right-hand drive) with a white fibreglass canopy, black front grille with bowtie,
> silver five-spoke alloy wheels. Livery in magenta-pink (#E4348A) and black: a pink wireframe globe with a black running figure
> beside the word **GLOBAL** (heavy black capitals), a pink band beneath reading **SECURITY SOLUTIONS** in white, and a smaller
> line **24 Hour Monitoring And Response**. On the door, the canopy side window (grey panel with the logo and **034 315 4237**,
> next to a pink panel reading **24HR MONITORING & ARMED RESPONSE**), the rear quarter (phone number **034 315 4237**), the hood,
> and the tailgate (pink and black diagonal chevrons on the bumper corners). **Number plate blank / unreadable.** No other text anywhere.

The real plate is visible in photos 2 and 4. Keep it out of the generated frames (a blank or blurred plate is standard for marketing).

## Step 1 — keyframes (image model that accepts several reference images)

Give it the previs frame **and** all four reference photos. Generate each at 16:9, as high resolution as the tool allows, 4–6 variants.

**Scene text (same for all keyframes):**
> Night, a light shower has just stopped. Wet asphalt reflects cool-white LED streetlamps; a faint magenta glow on the horizon.
> Two-lane suburban road in Newcastle, KwaZulu-Natal. Low brick boundary wall and a steel sliding gate on the left. Photoreal
> cinematic photograph, 24 mm lens at 1.3 m height, subtle haze, natural film grain, no people, no other vehicles.

**K3 – end frame (most important: it's where the viewer stops scrolling):**
> Photorealistic night photograph. Image A is a composition guide: copy its camera angle, the van's position and angle, and the
> front wheels turned to the right. Images B–E are real photos of the vehicle: reproduce its body, canopy, wheels and every graphic
> exactly as shown. Headlights on, brake lights glowing, sitting slightly nose-down. [scene text] [van description]

**K1 – start frame:** same prompt using `K1-arrival-start.png`, "the van is far down the road about 80 m away, headlights glaring, small in frame".

**K0 – hero still:** same prompt using `K0-hero-parked.png`, "parked, engine idling, dusk, wet forecourt paving".

## Step 2 — video (image-to-video tool that accepts a start frame and an end frame)

Use the chosen **K1** as the start frame and **K3** as the end frame. 16:9, highest resolution, 8–10 s. If the tool caps at 5 s,
make two clips (arrive, then brake-and-bounce) and use clip 1's last frame as clip 2's first frame. If the tool accepts a video
reference, also give it `guide-arrival-1280x720-24fps.mp4`. Generate 4–6 takes and pick by the checklist below.

**Prompt:**
> Locked-off camera at 1.3 m height, no camera movement. The white pickup van drives straight toward the camera down a wet night
> road with its headlights on, then brakes hard and swings to its right, front wheels turned right, stopping at a slight angle that
> shows its front and left side. Under braking the body dips forward, then rebounds and bounces two to three times on soft
> suspension before settling. The wheels rotate at a consistent speed and stop with the van. Reflections on the wet road move
> correctly. The text and graphics on the van stay sharp and unchanged.

**Avoid / negative:** warped or changing logo text, extra letters, extra logos, morphing wheels, changing number of wheels or
spokes, camera shake, camera zoom, people, other cars, sudden lighting flicker, the van changing length or shape.

## Step 3 — QA checklist (reject a take if it fails any)

- [ ] GLOBAL, SECURITY SOLUTIONS and 034 315 4237 are spelled and numbered correctly on the door, canopy and rear quarter
- [ ] Exactly four wheels, five-spoke alloys, rotation matches speed, and they stop when the van stops
- [ ] Front wheels visibly turned at the end
- [ ] At least two visible bounces after the stop; body doesn't wobble while moving
- [ ] Van keeps one consistent shape from start to end (canopy length, door lines)
- [ ] No plate, people or extra vehicles; no flicker
- [ ] Last frame matches K3 closely, because the page holds on it

If the text keeps warping: fix the **end keyframe** by retouching the real vector logo onto K3 (Figma/Photoshop), regenerate
the video with that as the end frame, or cover the door logo in post.

## Step 4 — put it on the site

```bash
node scripts/make-frames.mjs path/to/final-clip.mp4 --name van --fps 30 --width 1920
```
Reload. The story crossfades from the radar view into the footage (T 57–64) and scrubs it until T 92. Shorter clips
scrub faster per scroll; longer clips scrub slower. Keep to 6–10 s (about 200–300 frames).

## Before you publish

Check the AI tool's terms allow commercial use, and get the client's sign-off on an AI-generated depiction of their vehicle.

## Take log

**Take 1 — `source/arrival-take1-gemini.mp4`** (10 s, 1280×720, 24 fps, installed in `public/frames/van`)
- Good: real forecourt and real van; door logo, hood graphic and `034 315 4237` read correctly; four wheels, consistent rotation; front wheels locked over at the stop; tyre smoke.
- Needs a decision: the real number plate is legible in the last second; the neighbours' signs behind are garbled; the small pink canopy panel text is garbled (tiny on screen).
- Weak: no clear suspension rebound after the stop (a dip, but not the bounce).
- It's daylight, while the 3D hero and radar are night.
