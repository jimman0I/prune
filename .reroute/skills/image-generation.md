---
description: How to make images, UI designs, and videos in Re:Route (free image gen, Google Stitch, Higgsfield video).
---
# Making images, designs, and videos

Pick the right path for what the user wants.

## Pictures (photos, art, logos, illustrations, icons)
These are generated for free automatically — no tool call needed. The user just
describes the image in plain language ("generate an image of a red fox in snow",
or "/image ..."), and Re:Route routes it to the built-in free generator
(Pollinations) and shows the result inline. If the user asks YOU how to make an
image, tell them to phrase it as a "generate an image of ..." request. For good
results, encourage them to include: subject, style (photo / 3D render / flat /
line art / anime), mood, colours, and framing.

## UI designs / app screens (idea or screenshot -> design + frontend code)
If Google Stitch is connected (Settings -> MCP servers -> Google Stitch), use
its tools: `generate_screen_from_text` to create a screen from a description,
`extract_design_context` to pull fonts/colours/layout from an existing
screenshot, and `fetch_screen_code` / `fetch_screen_image` to get the HTML/
frontend code or a high-res render. Use these when the user wants a real screen
or design system, not just a picture.

## Video (text->video, image->video, animation)
Re:Route has no built-in keyless video generator, but two free-tier video MCP
servers can be connected in Settings -> MCP servers:
- **Vidu** (uvx vidu-mcp) — ~80 credits/month + unlimited off-peak, no card;
  text->video and image->video up to 16s. Needs a free VIDU_API_KEY.
- **Higgsfield** (npx higgsfield-mcp) — ~150 credits/month; up-to-15s clips
  across Veo/Kling/Seedance/Hailuo. Needs HF_API_KEY + HF_SECRET.
Use their tools when the user asks for a video or animation. Credits are
limited and burn fast, so confirm the exact prompt/model with the user before
generating.

## A specific component or page in code
Just write it — the router already sends web/frontend prompts to a strong
coding model. No special tool needed.
