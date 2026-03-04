# VibeLive Integration Guide

**Combined reference — MiniChat API Guide v0.63 + Design Guide v2.3**

Last updated: 2026-02-19

---

## Authority Rule

When the API Guide and Design Guide conflict:

- **API Guide (Part 1)** defines system behavior and lifecycle semantics
- **Design Guide (Part 2)** defines visual presentation and interaction rules

For visual conflicts, the Design Guide wins. See [CONFLICTS.md](CONFLICTS.md) for the full list of known conflicts and their resolutions.

---

## Implementation Checklist

Scannable list of every functional requirement across both guides. Use this to verify completeness.

### Entry Flow
- [ ] Name input (max 24 chars, autofocus)
- [ ] "Start a Room" button creates room via `signup()` → `createRoom()` → `enterByRoomCode()`
- [ ] "Join" button joins room via `signup()` → `enterByRoomCode(code)`
- [ ] Dynamic button priority: "Start a Room" is primary when no code entered; "Join" becomes primary when code is entered
- [ ] URL deep linking: auto-fill room code from `?code=` parameter, swap "Join" to primary
- [ ] Shareable invite link: copy-link produces full URL with `?code=<roomCode>`, not just the raw code
- [ ] Name validation hint on disabled button click
- [ ] Button loading states (spinner + "Creating..." for Start; disabled-only for Join)

### Pre-Live Screen
- [ ] Topbar: app name (left) + room code + copy-code button + copy-link button (right)
- [ ] Camera preview tile (~70% of available space)
- [ ] Camera and mic toggle buttons
- [ ] "Go Live" primary CTA + "Back" secondary button
- [ ] No remote participants visible
- [ ] Element-First Rule: both camera and screenshare tiles created and registered here

### Live Screen
- [ ] Same topbar as pre-live
- [ ] Video grid with 16:9 tiles, responsive layout (grid-1 through grid-8 CSS classes)
- [ ] Presentation mode: single `#videoGrid` switches layout when screenshare or spotlight is active
- [ ] Presentation mode creates `.screenshare-area` (featured row) + `.camera-strip` (thumbnail row) dynamically
- [ ] Camera toggle (`toggleVideo()`), mic toggle (`toggleMuteAudio()`), screenshare toggle
- [ ] Leave button with danger styling, visually separated
- [ ] Remote tiles created on demand in `remoteStreamStart`
- [ ] Remote tiles removed only when `displayStatus === 'INACTIVE'`
- [ ] Tile interactions: drag handle (top-left), resize handle (bottom-right), appear on hover
- [ ] Tile actions: spotlight button on camera tiles, fullscreen button on screenshare tiles
- [ ] Reset layout button visible when tiles have been dragged/resized

### Media & Tiles
- [ ] Local camera tile: video/placeholder visibility toggled in `localMediaChange`
- [ ] Local screenshare tile: shown when active, **removed entirely** when inactive (re-created on next toggle)
- [ ] Remote camera tile: video/placeholder toggled in `remoteStreamStart` / `remoteStreamEnd` / `remoteMediaChange`
- [ ] Remote screenshare tile: created in `remoteStreamStart`, removed entirely in `remoteStreamEnd`
- [ ] Media indicators (camera + mic) on camera tiles using inline SVG icons
- [ ] LIVE status badge on active tiles
- [ ] Initials placeholder when camera is off

### Sharing
- [ ] Copy-code button: copies raw room code
- [ ] Copy-link button: copies full URL with `?code=<roomCode>`
- [ ] "Copied!" tooltip below button for 1.5 seconds (not a global toast)

### Theme
- [ ] Dark mode default, light mode option
- [ ] Theme toggle in bottom-right corner (fixed, z-index: 100)
- [ ] Choice persists via localStorage
- [ ] Respect `prefers-color-scheme` on first visit

---

---

# Part 1 — MiniChat API Guide

**Build an anonymous video chat app with MiniChat**

Version 0.63 | February 18, 2026

> **Note:** Code examples in this section have been updated to comply with the Design Guide's visual rules (inline SVG icons instead of emoji, "Your Screen" label for local screenshare, LIVE badge on screenshare tiles). See [CONFLICTS.md](CONFLICTS.md) for details.

---

## Setup

Import and initialize MiniChat:

```html
<script type="module">
    import MiniChat from 'https://proto2.makedo.com/v05/scripts/makedo-vibelive.min.js';

    MiniChat.init({
        contextId: 'YOUR_CONTEXT_ID',
        contextAuthToken: 'YOUR_CONTEXT_TOKEN'
    });

    // Wire up events...
    MiniChat.on('channelSelected', (channel) => { /* ... */ });
    MiniChat.on('remoteStreamStart', (memberId, streamType) => { /* ... */ });
</script>

<!-- onclick handlers just work — no window.xxx workaround needed -->
<button onclick="MiniChat.signup('Alex')">Join</button>
<button onclick="MiniChat.startLive()">Go Live</button>
```

> **🧪 Test Credentials**: Use `contextId: 'Kw6w6w6w6w'` and `contextAuthToken: 'qftRdeQ12ZcrKYixauWpxGiB'` for quick testing.

`MiniChat` is automatically available on `window` — all methods work directly in `onclick` handlers without any extra wiring.

---

## User Flow

Anonymous users have two paths — **create** or **join** a room:

```
signup(name) → createRoom(title) → enterByRoomCode(code) → startLive()
signup(name) → enterByRoomCode(code) → startLive()
```

### Create a Room

```javascript
await MiniChat.signup('Alex');
const room = await MiniChat.createRoom("Alex's Room");
// room.room_code is the shareable code (e.g., "X7kQ3m")
await MiniChat.enterByRoomCode(room.room_code);
// Now in PRE-LIVE — call startLive() when ready
```

### Join a Room

```javascript
await MiniChat.signup('Jordan');
await MiniChat.enterByRoomCode('X7kQ3m');
// Now in PRE-LIVE — call startLive() when ready
```

### Sharing a Room

When sharing the room code with others, **always share a full URL** with `?code=<roomCode>`, not the raw code alone. This enables deep linking — recipients land directly in the join flow with the code pre-filled.

```javascript
// Build a shareable invite link
const inviteUrl = `${window.location.origin}${window.location.pathname}?code=${room.room_code}`;
```

See also: Design Guide §[Shareable Invite Link](#shareable-invite-link) and §[URL Deep Linking](#url-deep-linking-code).

### Change Display Name on Rejoin

Pass an optional `displayName` to update your name when entering a channel:

```javascript
// Exit current room
await MiniChat.exitRoom();

// Re-enter with new display name (no page reload needed)
await MiniChat.enterByRoomCode('X7kQ3m', 'NewName');
// Other members will receive a member_config_update event with your new name
```

### Always `await` Authentication

`signup()` must complete before any other calls. It establishes the session and WebSocket connection.

---

## Member Lifecycle: PRE-LIVE → LIVE → EXIT

```
PRE-LIVE    →    LIVE    →    PRE-LIVE or EXIT
(preparing)      (streaming)   (back or gone)
```

| State | What's happening | How to enter |
|-------|-----------------|--------------|
| **PRE-LIVE** | Channel selected, no WebRTC | `enterByRoomCode()` |
| **LIVE** | WebRTC connected, sending/receiving media | `startLive()` |
| **PRE-LIVE** | WebRTC disconnected, still in channel | `stopLive()` |
| **EXIT** | Fully departed, camera released | `exitRoom()` |

- `startLive()` — Connect WebRTC, go LIVE
- `stopLive()` — Disconnect WebRTC, return to PRE-LIVE (quick rejoin possible)
- `exitRoom()` — Full teardown, release camera/mic, stay logged in (can enter a different room)
- `backToList()` — Like `exitRoom()` but intended for multi-room flows: stops media and clears the channel, returning the user to a room-selection state without logging out
- `logout()` — Full session teardown including authentication

---

## Media Controls

### Toggle vs Mute

Two different concepts — understand the difference:

| Action | What Happens | Camera Light | Others See |
|--------|--------------|--------------|------------|
| `toggleVideo()` | Start/stop capture | On/Off | Video appears/disappears |
| `toggleMuteVideo()` | Hide while capturing | Stays On | Black frame |
| `toggleAudio()` | Start/stop microphone | — | Audio appears/disappears |
| `toggleMuteAudio()` | Silence while capturing | — | Silence |

`toggleScreenshare()` starts/stops screen sharing.

### Recommended UX Pattern

**Camera button:** Use `toggleVideo()`
- Users expect the camera light to turn OFF (privacy)
- Stopping capture releases system resources

**Microphone button:** Use `toggleMuteAudio()` (after initial `toggleAudio()` to start capture)
- Users expect instant unmute (common in meetings)
- Keeps microphone warm — no permission prompt when unmuting

**Example:**
```javascript
// On room entry: start both
await MiniChat.startLive();

// User clicks mic button (during call)
MiniChat.toggleMuteAudio();  // Mute/unmute — instant, no hardware restart

// User clicks camera button (during call)
MiniChat.toggleVideo();      // Stop/start — hardware light on/off
```

Use `toggleMuteVideo()` only for specialized cases (e.g., "hide self while fixing appearance" but keep capturing).

### Screenshare

Screen sharing is typically offered in **LIVE mode only**. In both cases, follow the Element-First Rule: create and register the screenshare tile in `channelSelected` (hidden with `display: none`).

### Reading Local Media State

```javascript
MiniChat.mediaState
// → { audio: true/false, video: true/false, audioMuted: true/false, videoMuted: true/false }

MiniChat.screenState
// → { video: true/false, videoMuted: true/false }
```

### Reading Remote Media State

```javascript
const states = MiniChat.getMediaStates(memberId);
// states.cam_audio_detail: 'ON' | 'MUTED' | 'OFF'
// states.cam_video_detail: 'ON' | 'HIDDEN' | 'OFF'
// states.screen_audio_detail: 'ON' | 'MUTED' | 'OFF'
// states.screen_video_detail: 'ON' | 'HIDDEN' | 'OFF'
```

### Local vs Live Media State

There are two separate "worlds" of media state:

| Source | What it reflects | Use for |
|--------|-----------------|--------|
| `MiniChat.mediaState` | **Hardware state** — is the camera/mic capturing? | Local user's indicators |
| `MiniChat.getMediaStates(id)` | **WebRTC state** — what's being transmitted? | Remote member indicators |

In **PRE-LIVE**, the local camera can be on (for preview) but nothing is transmitted. This is correct — the local indicator reflects what the user cares about: *"Is my camera on?"*

In **LIVE**, the two states naturally align. No special synchronization logic is needed.

**Always use `MiniChat.mediaState` for the local user's indicators** — never `MiniChat.getMediaStates(MiniChat.memberId)`, which reflects WebRTC state and won't be meaningful in PRE-LIVE.

---

## The Element-First Rule

> **For local streams: register video elements before streams arrive, not in response to them.**

When MiniChat creates a media stream, it immediately attaches to whatever `<video>` element you've registered. No element registered = stream silently lost.

| Media Type | When to Register | Why |
|---|---|---|
| **Local camera** | At tile creation time | `toggleVideo()` attaches immediately |
| **Local screenshare** | At tile creation time (hidden) | `toggleScreenshare()` attaches immediately |
| **Remote camera** | Inside `remoteStreamStart` handler | Stream is arriving *right now* |
| **Remote screenshare** | Inside `remoteStreamStart` handler | Stream is arriving *right now* |

> **Note:** The "before streams arrive" requirement applies only to **local** streams. For remote streams, `remoteStreamStart` is both the signal and the correct registration moment — there is nothing to pre-create.

```javascript
// ✅ Register both local elements at tile creation
MiniChat.setLocalCamera(cameraVideoEl);
MiniChat.setLocalScreen(screenVideoEl);

// ❌ DON'T create elements in localMediaChange — too late!
```

**Why this matters for screenshare:** When you call `toggleScreenshare()`, the stream is produced **instantly**. If you wait until `localMediaChange` fires to create the tile and call `setLocalScreen()`, the stream has already been produced with no element to attach to — result: blank screen. The element must exist and be registered **before** the user clicks the screenshare button.

---

## Building Video Tiles

Each video stream gets its own **independent tile** identified by `tile-{memberId}-{streamType}`. This gives maximum layout flexibility — screenshare tiles can span multiple grid columns, expand on click, or move to a featured area.

### createVideoTile() Pattern

```javascript
function createVideoTile(memberId, name, streamType, isLocal) {
    const tileId = `tile-${memberId}-${streamType}`;
    if (document.getElementById(tileId)) return; // Guard duplicates

    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = tileId;
    tile.dataset.memberId = memberId;
    tile.dataset.streamType = streamType;

    // Video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';

    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    if (streamType === 'camera') {
        // Show initials in a circle
        placeholder.innerHTML = `<span>${getInitials(name)}</span>`;
    } else {
        // Show screen icon for screenshare placeholder
        placeholder.innerHTML = `<span class="ph-icon"><!-- screen SVG icon --></span>`;
    }

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;   // Required for iOS
    video.muted = (isLocal || streamType === 'screenshare');  // Prevent echo

    videoContainer.appendChild(placeholder);
    videoContainer.appendChild(video);

    // Info bar
    const memberInfo = document.createElement('div');
    memberInfo.className = 'member-info';
    if (streamType === 'camera') {
        memberInfo.innerHTML = `
            <span class="member-name">${isLocal ? `${name} (You)` : name}</span>
            <div class="member-indicators">
                <span class="status-badge"></span>
                <span class="indicator cam-video" title="Camera"><!-- SVG icon --></span>
                <span class="indicator cam-audio" title="Microphone"><!-- SVG icon --></span>
            </div>
        `;
    } else {
        memberInfo.innerHTML = `
            <span class="member-name">${isLocal ? 'Your' : name + "'s"} Screen</span>
            <div class="member-indicators">
                <span class="status-badge">LIVE</span>
            </div>
        `;
    }

    tile.appendChild(videoContainer);
    tile.appendChild(memberInfo);

    // Drag handle (top-left, hover-reveal)
    const dragHandle = document.createElement('button');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '<!-- drag SVG icon -->';
    tile.appendChild(dragHandle);

    // Resize handle (bottom-right, hover-reveal)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    tile.appendChild(resizeHandle);

    // Tile actions (top-right, hover-reveal)
    const tileActions = document.createElement('div');
    tileActions.className = 'tile-actions';
    if (streamType === 'camera') {
        // Camera tiles get a spotlight button
        const spotlightBtn = document.createElement('button');
        spotlightBtn.className = 'tile-action-btn spotlight-btn';
        spotlightBtn.title = 'Spotlight';
        spotlightBtn.innerHTML = '<!-- expand SVG icon -->';
        spotlightBtn.onclick = () => toggleSpotlight(tile, spotlightBtn);
        tileActions.appendChild(spotlightBtn);
    } else {
        // Screenshare tiles get a fullscreen button
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'tile-action-btn fullscreen-btn';
        fullscreenBtn.title = 'Toggle fullscreen';
        fullscreenBtn.innerHTML = '<!-- fullscreen SVG icon -->';
        fullscreenBtn.onclick = () => toggleTileFullscreen(tile, fullscreenBtn);
        tileActions.appendChild(fullscreenBtn);
    }
    tile.appendChild(tileActions);

    // All tiles go to #videoGrid — layout is handled by updateGridLayout()
    document.getElementById('videoGrid').appendChild(tile);

    // Register local elements immediately (Element-First Rule)
    if (isLocal) {
        if (streamType === 'camera') {
            MiniChat.setLocalCamera(video);
        } else {
            MiniChat.setLocalScreen(video);
        }
    }

    // Update grid layout to accommodate the new tile
    updateGridLayout();
}
```

**Key points:**
- Each tile is independent — camera and screenshare are separate grid items
- `data-member-id` and `data-stream-type` attributes enable CSS targeting
- `playsInline` is required for iOS
- `muted = true` on local video prevents audio feedback
- **All tiles go to `#videoGrid`** — there is no separate `#screenshareGrid`. Presentation mode layout (featured area + camera strip) is handled dynamically by `updateGridLayout()`
- **Tile actions:** Camera tiles get a spotlight button; screenshare tiles get a fullscreen button. Both appear on hover only.
- **Drag + resize handles** are included on every tile for live room interaction
- **Initials placeholder:** Camera tiles show initials (not the full name) in a styled circle
- **Icons:** Use inline SVG icons for all indicators and buttons — no emoji (see §Core Design Philosophy)
- **Screenshare labels:** Local user sees "Your Screen"; remote users see "Name's Screen"
- **`updateGridLayout()`** is called after adding the tile to recompute the grid layout

---

## Moving Video Tiles (Preview Areas, Featured Views)

When implementing preview modes or featured speaker layouts, **always move the existing DOM element** — never remove and recreate.

### ✅ The Safe Way: appendChild()

```javascript
// Move to preview area (PRE-LIVE)
const tile = document.getElementById(`tile-${MiniChat.memberId}-camera`);
document.getElementById('previewArea').appendChild(tile);

// Move back to main grid (LIVE)
document.getElementById('videoGrid').appendChild(tile);
```

**Why this works:** `appendChild()` **moves** the element. The `<video>` element's `srcObject` persists. Element registration remains valid. No re-registration needed.

### ❌ Mistakes That Break Streams

```javascript
// ❌ Remove then recreate — stream lost
oldTile.remove();
createVideoTile(...);

// ❌ Clone the element — new element has no stream
const clone = original.cloneNode(true);

// ❌ Replace innerHTML — destroys the original element
container.innerHTML = tile.outerHTML;
```

---

## Event Handlers

### Registering Events

Use `MiniChat.on(event, callback)`:

```javascript
// Connection state (local)
MiniChat.on('localJoined', () => { });       // You went LIVE
MiniChat.on('localLeft', () => { });         // You returned to PRE-LIVE

// Remote members
MiniChat.on('remoteJoined', (memberId) => { });
MiniChat.on('remoteLeft', (memberId) => { });
MiniChat.on('memberUpdate', (memberId) => { });   // Status changed (includes self!)

// Streams
MiniChat.on('remoteStreamStart', (memberId, streamType) => { });  // 'camera' or 'screenshare'
MiniChat.on('remoteStreamEnd', (memberId, streamType) => { });
MiniChat.on('remoteMediaChange', (memberId, streamType) => { });  // Mute/unmute

// Local media
MiniChat.on('localMediaChange', () => { });

// Channel
MiniChat.on('channelSelected', (channel) => { });

// Errors
MiniChat.on('error', (context, error) => { });
```

Events can be chained:
```javascript
MiniChat.on('localJoined', handleJoined)
        .on('localLeft', handleLeft)
        .on('error', handleError);
```

### Handling Remote Streams

When a remote member starts streaming, create their tile and attach the stream:

```javascript
MiniChat.on('remoteStreamStart', (memberId, streamType) => {
    if (!MiniChat.isLive) return;  // Privacy-aware: only show when you're live

    const m = MiniChat.getMember(memberId);
    const tileId = `tile-${memberId}-${streamType}`;

    // Create tile on demand if needed (streams can arrive before join events!)
    let tile = document.getElementById(tileId);
    if (!tile) {
        createVideoTile(memberId, m?.displayName || 'Unknown', streamType, false);
        tile = document.getElementById(tileId);
    }
    if (!tile) return;

    const placeholder = tile.querySelector('.video-placeholder');
    const video = tile.querySelector('video');

    if (placeholder) placeholder.classList.add('hidden');
    if (video) {
        video.classList.add('visible');
        if (streamType === 'camera') {
            MiniChat.setRemoteCamera(memberId, video);
        } else {
            MiniChat.setRemoteScreen(memberId, video);
        }
    }

    updateMemberIndicators(memberId, streamType);
});

MiniChat.on('remoteStreamEnd', (memberId, streamType) => {
    const tileId = `tile-${memberId}-${streamType}`;
    const tile = document.getElementById(tileId);
    if (!tile) return;

    if (streamType === 'screenshare') {
        // Screenshare: remove tile entirely
        tile.remove();
    } else {
        // Camera: show placeholder (audio may still be active)
        const video = tile.querySelector('video');
        const placeholder = tile.querySelector('.video-placeholder');
        if (video) video.classList.remove('visible');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    updateMemberIndicators(memberId, streamType);
});
```

> **⚠️ Always create tiles on demand in `remoteStreamStart`.**
> When you call `startLive()`, WebRTC begins immediately. If others are already streaming, `remoteStreamStart` can fire **before** `remoteJoined`. If the tile doesn't exist, create it right there. Since `createVideoTile()` guards against duplicates, this is always safe.

### Video Placeholder vs Stream Presence

A stream can exist with only an audio track (video stopped). Use `remoteMediaChange` to check the actual video state:

```javascript
MiniChat.on('remoteMediaChange', (memberId, streamType) => {
    const states = MiniChat.getMediaStates(memberId);
    const tileId = `tile-${memberId}-${streamType}`;
    const tile = document.getElementById(tileId);
    if (!tile) return;

    const video = tile.querySelector('video');
    const placeholder = tile.querySelector('.video-placeholder');

    // Show placeholder when video is not ON (handles 'OFF' and 'HIDDEN')
    let showPlaceholder = false;
    if (streamType === 'camera') {
        showPlaceholder = states.cam_video_detail !== 'ON';
    } else {
        showPlaceholder = states.screen_video_detail !== 'ON';
    }

    if (showPlaceholder) {
        video?.classList.remove('visible');
        placeholder?.classList.remove('hidden');
    } else {
        video?.classList.add('visible');
        placeholder?.classList.add('hidden');
    }

    updateMemberIndicators(memberId, streamType);
});
```

### Handling Local Media Changes

MiniChat attaches streams but **never controls visibility**. Use `localMediaChange` to show/hide your own video:

```javascript
MiniChat.on('localMediaChange', () => {
    const s = MiniChat.mediaState;
    const screen = MiniChat.screenState;

    // Camera tile
    const camTile = document.getElementById(`tile-${MiniChat.memberId}-camera`);
    if (camTile) {
        const placeholder = camTile.querySelector('.video-placeholder');
        const video = camTile.querySelector('video');
        if (s.video) {
            placeholder?.classList.add('hidden');
            video?.classList.add('visible');
        } else {
            placeholder?.classList.remove('hidden');
            video?.classList.remove('visible');
        }
    }

    // Screenshare tile (remove entirely when inactive)
    const screenTile = document.getElementById(`tile-${MiniChat.memberId}-screenshare`);
    if (screenTile) {
        if (screen.video) {
            screenTile.style.display = 'flex';
            screenTile.querySelector('.video-placeholder')?.classList.add('hidden');
            screenTile.querySelector('video')?.classList.add('visible');
        } else {
            screenTile.remove();   // Remove tile entirely, not just hide
        }
    }

    updateMemberIndicators(MiniChat.memberId);
    updateGridLayout();   // Recompute grid after media change
});
```

**Important:** Local video is attached **directly** when you call `toggleVideo()`, not via WebRTC events. `remoteStreamStart` only fires for **remote** members.

### Handling Member Left

Check whether they truly exited or just returned to PRE-LIVE:

```javascript
MiniChat.on('remoteLeft', (memberId) => {
    const m = MiniChat.getMember(memberId);
    if (m?.displayStatus === 'INACTIVE') {
        // Remove tiles — they've left
        document.getElementById(`tile-${memberId}-camera`)?.remove();
        document.getElementById(`tile-${memberId}-screenshare`)?.remove();
    }
    // If PRE-LIVE, keep tiles — they may rejoin
});
```

---

## Privacy-Aware Visibility

Recommended pattern: only show remote member tiles when the local user is LIVE. This gives users a private "green room" in PRE-LIVE for adjusting camera/mic.

```javascript
MiniChat.on('channelSelected', async (channel) => {
    // PRE-LIVE: show only your own tiles
    const members = await MiniChat.getMembers();
    const self = members.find(m => m.id === MiniChat.memberId);
    if (self) {
        createVideoTile(self.id, self.displayName, 'camera', true);
        createVideoTile(self.id, self.displayName, 'screenshare', true);
        // screenshare tile starts hidden (Element-First Rule)
    }
});

MiniChat.on('localJoined', async () => {
    // Going LIVE: reveal remote members
    const members = await MiniChat.getMembers();
    members.forEach(m => {
        if (m.id === MiniChat.memberId) return;
        if (m.displayStatus === 'ACTIVE' || m.displayStatus === 'PRE-LIVE') {
            createVideoTile(m.id, m.displayName, 'camera', false);
        }
    });
});

MiniChat.on('localLeft', () => {
    // Back to PRE-LIVE: remove remote tiles for privacy
    document.querySelectorAll('.video-tile').forEach(tile => {
        if (tile.dataset.memberId !== MiniChat.memberId) {
            tile.remove();
        }
    });
});

MiniChat.on('remoteJoined', (memberId) => {
    if (!MiniChat.isLive) return;  // Don't show if we're not live
    const m = MiniChat.getMember(memberId);
    createVideoTile(memberId, m?.displayName || 'Unknown', 'camera', false);
});
```

> **Design choice: who gets a tile on `localJoined`?**
>
> The example above creates tiles for both `'ACTIVE'` and `'PRE-LIVE'` members when you go LIVE. This is the recommended default — you see everyone already in the channel, including those still preparing.
>
> You can restrict to `'ACTIVE'` only if your app only wants to show members who are actively streaming:
> ```javascript
> // Variation: streamers only
> if (m.displayStatus === 'ACTIVE') {
>     createVideoTile(m.id, m.displayName, 'camera', false);
> }
> ```
> The tradeoff:
> - **`'ACTIVE' || 'PRE-LIVE'`** — everyone present gets a tile immediately; good for small groups and social apps
> - **`'ACTIVE'` only** — tiles appear only when streaming starts; better for larger rooms or broadcast-style apps where PRE-LIVE presence is invisible by design
>
> Note: `remoteJoined` fires when a member goes LIVE (not when they enter PRE-LIVE), so it always represents an `'ACTIVE'` member — no filtering needed there.

```javascript

MiniChat.on('remoteStreamStart', (memberId, streamType) => {
    if (!MiniChat.isLive) return;  // Don't show if we're not live
    // ... attach stream (see Handling Remote Streams above)
});
```

---

## Member Info

```javascript
const member = MiniChat.getMember(memberId);
member.displayName     // "Alex"
member.displayStatus   // 'ACTIVE', 'PRE-LIVE', or 'INACTIVE'
member.hasCamera       // boolean
member.hasScreenshare  // boolean

// Fetch all current channel members from server
const members = await MiniChat.getMembers();
// → [{ id, displayName, displayStatus, ... }]
```

Use `MiniChat.memberId` for your own member ID. Use `MiniChat.roomCode` for the shareable room code.

`memberUpdate` fires for ALL members including yourself — useful for updating status badges.

---

## Complete Minimal Example

A working app in under 50 lines of JavaScript:

```html
<!DOCTYPE html>
<html>
<head>
    <title>MiniChat Demo</title>
    <style>
        #videoGrid { display: grid; gap: 8px; padding: 8px; align-content: center; }
        #videoGrid.grid-1 { grid-template-columns: 1fr; place-items: center; }
        #videoGrid.grid-1 .video-tile { width: min(100%, calc((100vh - 140px) * 16 / 9)); }
        #videoGrid.grid-2 { grid-template-columns: 1fr 1fr; }
        #videoGrid.grid-3 { grid-template-columns: 1fr 1fr 1fr; }
        #videoGrid.grid-4 { grid-template-columns: 1fr 1fr; }
        #videoGrid.presentation { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
        .screenshare-area { display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; height: 100%; }
        .camera-strip { display: flex; justify-content: center; gap: 8px; padding: 8px 0 0; overflow-x: auto; }
        .camera-strip .video-tile { flex: 0 0 180px; width: 180px; }
        .video-tile { position: relative; border-radius: 16px; overflow: hidden; background: #222; }
        .video-tile::before { content: ''; display: block; padding-top: 56.25%; }
        .video-container { position: absolute; inset: 0; }
        .video-tile video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: none; }
        .screenshare-area .video-tile video { object-fit: contain; background: #000; }
        .video-placeholder { position: absolute; inset: 0; display: flex;
            align-items: center; justify-content: center; color: white; font-size: 1.2em; }
        .hidden { display: none; }
        .visible { display: block; }
    </style>
</head>
<body>
    <h2>MiniChat</h2>

    <div id="entry">
        <input id="name" placeholder="Your name">
        <button onclick="doCreate()">Create Room</button>
        <input id="code" placeholder="Room code">
        <button onclick="doJoin()">Join Room</button>
    </div>

    <div id="controls" style="display: none;">
        <span id="roomInfo"></span>
        <button onclick="MiniChat.startLive()">Go Live</button>
        <button onclick="MiniChat.stopLive()">Stop Live</button>
        <button onclick="MiniChat.toggleVideo()">Toggle Camera</button>
        <button onclick="MiniChat.toggleMuteAudio()">Mute/Unmute Mic</button>
    </div>

    <div id="videoGrid"></div>

    <script type="module">
        import MiniChat from 'https://proto2.makedo.com/v05/scripts/makedo-vibelive.min.js';

        MiniChat.init({ contextId: 'Kw6w6w6w6w', contextAuthToken: 'qftRdeQ12ZcrKYixauWpxGiB' });

        // --- Entry functions ---

        window.doCreate = async () => {
            await MiniChat.signup(document.getElementById('name').value || 'Guest');
            const room = await MiniChat.createRoom('My Room');
            await MiniChat.enterByRoomCode(room.room_code);
        };

        window.doJoin = async () => {
            await MiniChat.signup(document.getElementById('name').value || 'Guest');
            await MiniChat.enterByRoomCode(document.getElementById('code').value);
        };

        // --- Events ---

        MiniChat.on('channelSelected', async (channel) => {
            document.getElementById('entry').style.display = 'none';
            document.getElementById('controls').style.display = 'block';
            document.getElementById('roomInfo').textContent = `Room: ${MiniChat.roomCode}`;

            // Create local tile (Element-First Rule)
            const self = (await MiniChat.getMembers()).find(m => m.id === MiniChat.memberId);
            if (self) {
                createVideoTile(self.id, self.displayName, 'camera', true);
                createVideoTile(self.id, self.displayName, 'screenshare', true);
            }

            // Start camera + mic for preview
            await MiniChat.toggleVideo();
            await MiniChat.toggleAudio();
        });

        MiniChat.on('localJoined', async () => {
            const members = await MiniChat.getMembers();
            members.forEach(m => {
                if (m.id !== MiniChat.memberId &&
                    (m.displayStatus === 'ACTIVE' || m.displayStatus === 'PRE-LIVE')) {
                    createVideoTile(m.id, m.displayName, 'camera', false);
                }
            });
        });

        MiniChat.on('remoteJoined', (id) => {
            if (!MiniChat.isLive) return;
            const m = MiniChat.getMember(id);
            createVideoTile(id, m?.displayName || 'Unknown', 'camera', false);
        });

        MiniChat.on('remoteStreamStart', (id, type) => {
            if (!MiniChat.isLive) return;
            const m = MiniChat.getMember(id);
            let tile = document.getElementById(`tile-${id}-${type}`);
            if (!tile) {
                createVideoTile(id, m?.displayName || 'Unknown', type, false);
                tile = document.getElementById(`tile-${id}-${type}`);
            }
            const video = tile?.querySelector('video');
            if (video) {
                video.classList.add('visible');
                tile.querySelector('.video-placeholder')?.classList.add('hidden');
                if (type === 'camera') MiniChat.setRemoteCamera(id, video);
                else MiniChat.setRemoteScreen(id, video);
            }
        });

        MiniChat.on('remoteStreamEnd', (id, type) => {
            const tile = document.getElementById(`tile-${id}-${type}`);
            if (!tile) return;
            if (type === 'screenshare') { tile.remove(); return; }
            tile.querySelector('video')?.classList.remove('visible');
            tile.querySelector('.video-placeholder')?.classList.remove('hidden');
        });

        MiniChat.on('localMediaChange', () => {
            const s = MiniChat.mediaState;
            const camTile = document.getElementById(`tile-${MiniChat.memberId}-camera`);
            if (camTile) {
                const v = camTile.querySelector('video');
                const p = camTile.querySelector('.video-placeholder');
                if (s.video) { p?.classList.add('hidden'); v?.classList.add('visible'); }
                else { p?.classList.remove('hidden'); v?.classList.remove('visible'); }
            }
            const screenTile = document.getElementById(`tile-${MiniChat.memberId}-screenshare`);
            if (screenTile) {
                if (MiniChat.screenState.video) {
                    screenTile.style.display = 'flex';
                    screenTile.querySelector('.video-placeholder')?.classList.add('hidden');
                    screenTile.querySelector('video')?.classList.add('visible');
                } else {
                    screenTile.remove();   // Remove tile entirely
                }
            }
            updateGridLayout();
        });

        MiniChat.on('remoteLeft', (id) => {
            const m = MiniChat.getMember(id);
            if (m?.displayStatus === 'INACTIVE') {
                document.getElementById(`tile-${id}-camera`)?.remove();
                document.getElementById(`tile-${id}-screenshare`)?.remove();
            }
            // If PRE-LIVE, keep tiles — they stopped streaming but haven't left
        });

        MiniChat.on('error', (ctx, err) => console.error(`[${ctx}]`, err.message));

        // --- Tile creation ---

        function createVideoTile(memberId, name, streamType, isLocal) {
            const tileId = `tile-${memberId}-${streamType}`;
            if (document.getElementById(tileId)) return;

            const tile = document.createElement('div');
            tile.className = 'video-tile';
            tile.id = tileId;
            tile.dataset.memberId = memberId;
            tile.dataset.streamType = streamType;
            if (streamType === 'screenshare' && isLocal) tile.style.display = 'none';

            tile.innerHTML = `
                <div class="video-container">
                    <div class="video-placeholder"><span>${streamType === 'camera'
                        ? (isLocal ? `${name} (You)` : name)
                        : (isLocal ? 'Your' : name + "'s") + ' Screen'}</span></div>
                    <video autoplay playsinline ${isLocal || streamType === 'screenshare' ? 'muted' : ''}></video>
                </div>
            `;

            // All tiles go to #videoGrid — layout handled by updateGridLayout()
            document.getElementById('videoGrid').appendChild(tile);

            if (isLocal) {
                const video = tile.querySelector('video');
                if (streamType === 'camera') MiniChat.setLocalCamera(video);
                else MiniChat.setLocalScreen(video);
            }

            updateGridLayout();
        }

        // --- Layout management ---

        function updateGridLayout() {
            const grid = document.getElementById('videoGrid');
            const allTiles = Array.from(grid.querySelectorAll('.video-tile')).filter(
                c => c.style.display !== 'none'
            );
            const hasScreenshare = allTiles.some(c => c.dataset.streamType === 'screenshare');

            grid.className = '';

            if (hasScreenshare) {
                grid.classList.add('presentation');
                let area = grid.querySelector('.screenshare-area');
                if (!area) { area = document.createElement('div'); area.className = 'screenshare-area'; grid.prepend(area); }
                allTiles.filter(c => c.dataset.streamType === 'screenshare').forEach(t => area.appendChild(t));
                let strip = grid.querySelector('.camera-strip');
                if (!strip) { strip = document.createElement('div'); strip.className = 'camera-strip'; grid.appendChild(strip); }
                allTiles.filter(c => c.dataset.streamType === 'camera').forEach(t => strip.appendChild(t));
            } else {
                const area = grid.querySelector('.screenshare-area');
                if (area) { Array.from(area.children).forEach(t => grid.appendChild(t)); area.remove(); }
                const strip = grid.querySelector('.camera-strip');
                if (strip) { Array.from(strip.children).forEach(t => grid.appendChild(t)); strip.remove(); }
                const count = allTiles.filter(c => c.classList.contains('video-tile')).length;
                if (count > 0) grid.classList.add(`grid-${Math.min(count, 4)}`);
            }
        }
    </script>
</body>
</html>
```

---

## API Quick Reference

### Methods

| Method | Description |
|--------|-------------|
| `init({ contextId, contextAuthToken, serverUrl? })` | Initialize MiniChat (required first) |
| `signup(name)` | Create anonymous guest session |
| `login(email, password)` | Login with existing account |
| `logout()` | Logout and cleanup |
| `createRoom(title)` | Create room, returns `{ id, room_code, title }` |
| `enterByRoomCode(code, displayName?)` | Enter room → PRE-LIVE (displayName optional, updates member name) |
| `startLive()` | Connect WebRTC → LIVE |
| `stopLive()` | Disconnect WebRTC → PRE-LIVE |
| `exitRoom()` | Full teardown, release camera/mic — stay logged in |
| `backToList()` | Stop media and clear channel — return to room selection without logout |
| `toggleAudio()` | Start/stop mic hardware |
| `toggleVideo()` | Start/stop camera hardware |
| `toggleScreenshare()` | Start/stop screen share |
| `toggleMuteAudio()` | Mute/unmute mic (keeps capturing) |
| `toggleMuteVideo()` | Hide/show video (keeps capturing) |
| `toggleMuteScreenshare()` | Hide/show screenshare (keeps capturing) |
| `getMember(memberId)` | Get member info |
| `getMemberIds()` | Get all member IDs |
| `getMembers()` | Fetch all channel members from server |
| `getMediaStates(memberId)` | Get `cam_audio_detail`, `cam_video_detail`, etc. |
| `getStream(memberId, streamType)` | Get raw MediaStream |
| `setLocalCamera(videoEl)` | Register local camera element |
| `setLocalScreen(videoEl)` | Register local screenshare element |
| `setRemoteCamera(id, videoEl)` | Register remote camera element |
| `setRemoteScreen(id, videoEl)` | Register remote screenshare element |
| `clearLocalCamera()` | Unregister local camera element |
| `clearLocalScreen()` | Unregister local screenshare element |
| `clearRemoteCamera(id)` | Unregister remote camera element |
| `clearRemoteScreen(id)` | Unregister remote screenshare element |
| `on(event, callback)` | Register event handler (chainable) |

### Getters

| Property | Type | Description |
|----------|------|-------------|
| `isLoggedIn` | boolean | Authenticated? |
| `isLive` | boolean | WebRTC connected (LIVE)? |
| `user` | Object | Current user |
| `memberId` | string | Your member ID |
| `roomCode` | string | Shareable room code |
| `channel` | Object | Current channel: `{ id, room_code, title, description, memberCount }` |
| `mediaState` | Object | `{ audio, video, audioMuted, videoMuted }` |
| `screenState` | Object | `{ video, videoMuted }` |
| `hasMedia` | boolean | Any local media active? |
| `core` | Object | Underlying MiniChatCore (escape hatch) |

### Events

| Event | Callback signature | Description |
|-------|-------------------|-------------|
| `login` | `(user)` | Logged in |
| `loginError` | `(error)` | Login failed |
| `logout` | `()` | Logged out |
| `channelSelected` | `(channel)` | Entered a room (PRE-LIVE). `channel`: `{ id, room_code, title, description, memberCount }` |
| `localJoined` | `()` | You went LIVE |
| `localLeft` | `()` | You returned to PRE-LIVE |
| `remoteJoined` | `(memberId)` | Remote member went LIVE |
| `remoteLeft` | `(memberId)` | Remote member stopped LIVE |
| `memberUpdate` | `(memberId)` | Member status changed (includes self) |
| `remoteStreamStart` | `(memberId, streamType)` | Remote stream arrived |
| `remoteStreamEnd` | `(memberId, streamType)` | Remote stream ended |
| `remoteMediaChange` | `(memberId, streamType)` | Remote mute/unmute |
| `localMediaChange` | `()` | Local media state changed |
| `error` | `(context, error)` | Error occurred |

---

## Common Mistakes

1. **Not calling `init()` first** — Every method throws `"Call MiniChat.init() first"` without it.

2. **Not awaiting `signup()`** — Session and WebSocket won't be ready for subsequent calls.

3. **Forgetting `startLive()`** — `enterByRoomCode()` only puts you in PRE-LIVE. You must call `startLive()` to connect WebRTC and start sending/receiving media.

   PRE-LIVE is intentional, not just a waiting room. In PRE-LIVE, the local camera and mic work normally — you can call `toggleVideo()` and `toggleAudio()` and the user will see their own preview. Nothing is transmitted to others yet. This is the "green room": users adjust their setup privately before going live.

   Common mistakes stemming from misunderstanding PRE-LIVE:
   - Calling `startLive()` immediately inside `channelSelected` — this skips the green room and connects WebRTC before the user is ready.
   - Expecting remote tiles to appear in PRE-LIVE — remote streams don't arrive until you call `startLive()`.
   - Being surprised that `toggleVideo()` works in PRE-LIVE but nobody else can see you — correct behaviour, by design.

4. **Creating video elements too late (Element-First Rule)** — Register elements *before* streams arrive. If you create a `<video>` element in `localMediaChange`, the stream is already lost.

   **⚠️ CRITICAL for screenshare:** The screenshare `<video>` element must exist and be registered with `setLocalScreen()` BEFORE calling `toggleScreenshare()`. Create both camera and screenshare tiles in `channelSelected`, with the screenshare tile hidden (`display: none`).

5. **Not creating tiles on demand in `remoteStreamStart`** — Stream events can arrive before `remoteJoined`. Always check if the tile exists and create it if needed.

6. **Missing `playsInline` on video elements** — Required for iOS. Videos won't autoplay inline without it.

7. **Not muting your own `<video>` element** — Always set `muted = true` on local video elements to prevent audio feedback/echo.

8. **Not checking status in `remoteLeft`** — A member with `displayStatus === 'PRE-LIVE'` hasn't left; they may rejoin. Only remove tiles for `'INACTIVE'` members.

9. **Using `getMediaStates()` for local indicators** — Use `MiniChat.mediaState` for the local user. `getMediaStates(MiniChat.memberId)` reflects WebRTC state and is meaningless in PRE-LIVE.

10. **Confusing toggle vs mute** — Camera: use `toggleVideo()` (hardware on/off). Microphone: use `toggleMuteAudio()` after initial startup (instant mute/unmute).

11. **Removing and recreating tiles to move them** — Use `appendChild()` to move the existing element. Never `.remove()` then recreate — the stream attachment is lost.

12. **Ignoring self status changes in `memberUpdate`** — While you shouldn't create tiles for yourself, you MUST update your UI controls (Start/Stop Live buttons, status text) when `memberId === MiniChat.memberId`. Check `member.displayStatus` and update buttons BEFORE returning:
   ```javascript
   MiniChat.on('memberUpdate', (memberId) => {
       const member = MiniChat.getMember(memberId);
       if (memberId === MiniChat.memberId) {
           // Update YOUR controls based on status
           if (member.displayStatus === 'ACTIVE') {
               startBtn.disabled = true;
               stopBtn.disabled = false;
           } else if (member.displayStatus === 'PRE-LIVE') {
               startBtn.disabled = false;
               stopBtn.disabled = true;
           }
           return;  // NOW skip tile operations
       }
       // Handle remote member tiles...
   });
   ```

13. **Not removing the local screenshare tile when sharing stops** — In `localMediaChange`, when `screen.video` is false, the screenshare tile must be **removed entirely** (`tile.remove()`), not just hidden. When toggling screenshare back on, `toggleLiveScreen()` re-creates the tile if needed before calling `toggleScreenshare()`. When the tile is shown (screen active), remember to toggle both `display` and the video/placeholder visibility classes.

14. **Not calling `updateGridLayout()` after tile changes** — Any operation that adds, removes, or shows/hides a tile must call `updateGridLayout()` afterward. This function recalculates whether the grid should be in normal mode (grid-N classes) or presentation mode (screenshare/spotlight active), and restructures the DOM accordingly.

---

*MiniChat API v1.0 — Facade over MiniChatCore. For advanced use, access `MiniChat.core` for the full MiniChatCore API.*

---

---

# Part 2 — Design Guide

Version: 2.3
Last updated: 2026-02-19

---

## Authority & Scope

This document defines **visual, interaction, and layout rules** for MiniChatCore-based apps.

### Authority Rule (Important)

When behavior or lifecycle rules conflict:

- **MINI_GUIDE defines system behavior and lifecycle semantics**
- **DESIGN_GUIDE defines visual presentation and interaction rules**

DESIGN_GUIDE must not override MiniChatCore lifecycle behavior.

---

## Lifecycle Model (Authoritative)

This guide follows the MiniChatCore lifecycle exactly:

```
PRE-LIVE → LIVE → PRE-LIVE / EXIT
```

### State Definitions

- **PRE-LIVE**
  - User is inside the room context
  - Camera and mic preview may be active
  - WebRTC is NOT connected
  - No media is transmitted

- **LIVE**
  - WebRTC is connected
  - Media is actively transmitted

- **EXIT**
  - User has fully left the room
  - Camera and mic are released
  - Tiles must be destroyed

> PRE-LIVE is NOT a lobby and NOT a partial join.

---

## Core Design Philosophy (from v2.0)

1. **Good defaults beat configuration** — if the user does nothing, the UI should still feel right.
2. **Visual fairness** — participants are equal unless explicitly designed otherwise.
3. **Space-aware layouts** — no cramped or floating tiles.
4. **Mobile-first, desktop-enhanced** — vertical clarity first, spatial balance later.
5. **Neutral first, accent second** — accents communicate meaning, not decoration.
6. **No emoji** — use inline SVG icons exclusively. Emoji are platform-inconsistent and not styleable.

---

## Color Theme & Tokens (Default: VibeLive Teal)

Default theme used unless overridden by product-specific theming.

- Accent: `#0EA5A4`
- Radius: `16px`
- Max content width: `980px`
- Font stack: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`

### Canonical CSS Variables

```css
:root {
  --radius: 16px;
  --max: 980px;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;

  --bg: #f7f9f8;
  --card: #ffffff;
  --soft: #f0f4f3;
  --border: #e2e8f0;
  --borderSoft: #dbe2ea;

  --text: #1e293b;
  --muted: #64748b;
  --muted2: #9ca3af;

  --accent: #0EA5A4;
  --accentHover: #0d9488;
  --accentSoft: rgba(14,165,164,.10);
  --accentBorder: rgba(14,165,164,.35);

  --liveBg: #e8f4ed;
  --liveBorder: #a6c5a3;
  --liveText: #324252;

  --disabledBg: #f3f4f6;
  --disabledBorder: #e5e7eb;
  --disabledText: #6b7280;

  --dangerBg: #FEF2F2;
  --dangerBorder: #fca5a5;
  --dangerText: #b91c1c;

  --overlay: rgba(30, 41, 59, 0.5);
}
```

---

## Entry Flow

### Entry Screen (Required)

Use **two separated cards**:

#### Card Structure

```
┌─────────────────────────────┐
│  Name Card                  │
│  ┌───────────────────────┐  │
│  │ Your name             │  │
│  │ [___________________] │  │
│  └───────────────────────┘  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Action Card                │
│                             │
│  [ + Start a Room ] (primary)│
│                             │
│  ────────── OR ──────────   │
│                             │
│  Join with room code        │
│  [_________] [ Join ]       │
│                             │
└─────────────────────────────┘
```

- **Name card**: Label + text input (max 24 chars), **autofocus on load** — typing your name is the default CTA
- **Action card**: Primary CTA, OR divider, then room code input + Join button side by side
- Both actions are **always visible** — no hiding/showing based on code input
- **Join row layout**: Room code input takes **75%**, Join button takes **25%** (`flex: 0 0 25%`)

#### Disabled Button Styling

- Disabled buttons appear at **full opacity** — no dimming, no grey overrides
- Only `cursor: not-allowed` is applied to indicate the disabled state
- Buttons retain their full color identity (accent for primary, soft for secondary) at all times
- This ensures the visual hierarchy and color cues are clear even before the user has typed a name

#### Name Validation Hint

- When a user clicks a disabled button without entering a name, show a **hint message** below the name input: "Please enter your name first"
- The hint uses `--dangerText` color and fades in/out
- The name input is auto-focused so the user can immediately start typing
- The hint disappears after 3 seconds or when the user starts typing

#### Button Loading Behavior

- **"Start a Room"** → shows spinner + "Creating..." while connecting (indicates room creation in progress)
- **"Join"** → label stays as **"Join"** while connecting (button is disabled only, no text change)

#### Dynamic Button Priority

- **No room code entered** → "Start a Room" = primary (accent color), "Join" = secondary
- **Room code entered** → "Join" = primary (accent color), "Start a Room" = secondary
- This guides users naturally toward the most relevant action

#### URL Deep Linking (`?code=`)

- Auto-fill room code from URL parameter
- Triggers dynamic priority swap → "Join" becomes primary

#### Shareable Invite Link

- Copy/share actions must produce a full URL with `?code=<roomCode>`, not the raw code alone
- This ensures recipients land directly into the join flow via deep linking

---

## Pre-Live Setup Screen (PRE-LIVE)

Purpose:
- Camera preview
- Mic / camera toggles
- Readiness confirmation

Rules:
- **Same topbar as live screen** — app name (left), room code + copy-code + copy-link buttons (right)
- Content below topbar is **vertically and horizontally centered**
- Camera preview uses **~70% of available space** — balanced size that avoids feeling cramped or overwhelming (e.g. use `min(70%, calc((100vh - offset) * 16/9 * 0.7))`)
- The content wrapper must use `align-self: stretch` so percentage-based widths resolve against the full viewport width
- Controls below preview
- **Go Live / Enter Room** is primary CTA, placed in an action row below controls
- **Back button** sits alongside "Go Live" in the same row — secondary styling (soft background, border), navigates back to the entry screen, exits the channel, and releases camera/mic preview
- No other participants visible
- Camera off → initials placeholder (stable tile size)
- **No drag/resize handles** — tile interaction controls (drag handle, resize handle) are hidden in pre-live; they only appear on live room tiles

---

## Video Tile Rules (Unified)

### Tile Anatomy (Camera Tiles)

Each **camera tile** contains:
- Video OR initials placeholder
- Name label (bottom-left) — local user shows **"Name (You)"** (e.g. "April (You)"), remote users show their display name
- Camera + mic indicators (**always visible**)
- **LIVE status badge** — shown on all tiles (local and remote) when the participant is live. Uses `--liveBg` / `--liveText` styling. Badge is hidden when the participant is not live.

Tiles never contain controls.

> **Screen share tiles** are an exception — they show a name label and LIVE badge, but no mic/camera indicators. See [Screen Share Tile Semantics](#screen-share-tile-semantics).

### Initials Placeholder

When camera is off, show initials inside the placeholder:
- **Single name** (e.g. "April") → first letter only → **A**
- **Two or more names** (e.g. "April Kim") → first letter of first + last name → **AK**
- Empty/missing name → **?**

### Tile Sizing (Non-Negotiable)

- Size must be independent of camera state
- Use `::before` spacer (`padding-top: 56.25%`)
- Video and placeholder are absolute overlays
- **Hide browser-native video controls** — Chrome and Safari show play/pause overlays on `<video>` elements on hover. Suppress with `::-webkit-media-controls` pseudo-elements set to `display: none !important`

### Media Indicators

- Default state: cam OFF, mic OFF
- Icons required (no color-only meaning)
- **No emoji characters** — all icons must be inline SVG or icon font. Emoji rendering is inconsistent across platforms and does not meet design quality standards.

Indicator visibility must be **immediately obvious** at any tile size:
- ON → `--accent` icon color + accent-tinted background pill (`rgba(accent, .25)`)
- OFF → `--dangerText` icon color + danger-tinted background pill (`rgba(danger, .25)`)
- **On video tiles** (inside `.member-info`): indicators use **higher opacity backgrounds** (`rgba(accent, .7)` / `rgba(danger, .7)`) with white icon color to ensure visibility against any video content
- Do NOT rely on opacity alone to distinguish states — opacity differences are too subtle on dark backgrounds and at small sizes

---

## Tile Lifecycle Rules

- Create tile on room entry or member visibility
- **Remote tiles appear when the participant is LIVE or PRE-LIVE** — both active and pre-live members are visible to others
- **Do NOT remove camera tiles** on LIVE → PRE-LIVE — they may rejoin
- **Screenshare tiles are ephemeral** — remove entirely when sharing stops (`remoteStreamEnd` for screenshare)
- Remove camera tiles only when displayStatus = **INACTIVE** or explicit exit

---

## Screen Share & Presentation Mode

### How Presentation Mode Works

TinyRoom uses a **single `#videoGrid`** container that dynamically switches between normal grid mode and presentation mode. There is no separate `#screenshareGrid`. When a screenshare or spotlight is active, `updateGridLayout()` restructures the grid:

1. The grid gets the `presentation` CSS class
2. A `.screenshare-area` div is dynamically created (prepended to grid) — this is the **featured row**
3. A `.camera-strip` div is dynamically created (appended to grid) — this is the **thumbnail row**
4. Screenshare tiles and spotlighted camera tiles are moved into `.screenshare-area`
5. Remaining camera tiles are moved into `.camera-strip`

When screenshare/spotlight ends, the containers are removed and tiles are restored to the normal grid.

```css
/* Presentation mode: two-row layout */
#videoGrid.presentation {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;    /* Featured area fills space, strip auto-sizes */
    place-items: center;
    transition: grid-template-rows 0.3s ease;
}
```

### Screen Share Priority

- Multiple participants may share their screen simultaneously
- All active screen shares are displayed **side by side** in the `.screenshare-area`
- On mobile (narrow viewports), multiple screenshares **stack vertically** (`flex-direction: column`)
- Screen shares always occupy the primary visual surface (row 1 of the presentation grid)

### Featured Area (`.screenshare-area`)

The featured area holds screenshare tiles and spotlighted camera tiles:

```css
.screenshare-area {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    min-height: 0;
}

.screenshare-area .video-tile {
    flex: 1;
    min-width: 0;
    max-width: min(100%, calc((100vh - 220px) * 16 / 9));
    max-height: 100%;
}
```

- Tiles divide the area equally (`flex: 1`)
- Each tile is constrained by `max-width: min(100%, calc((100vh - 220px) * 16/9))` — the 220px accounts for controls bar + camera strip + padding
- Screenshare video uses `object-fit: contain` with black letterboxing — content is never cropped
- **Member-info is hidden** on screenshare tiles in the featured area (`.screenshare-area .video-tile .member-info { display: none }`)
- Spotlighted camera tiles in the featured area keep `object-fit: cover` and their member-info visible

### Camera Strip (`.camera-strip`)

```css
.camera-strip {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 8px 0 0;
    overflow-x: auto;
    width: 100%;
}

.camera-strip .video-tile {
    flex: 0 0 180px;    /* Fixed 180px thumbnails on desktop */
    width: 180px;
}
```

- Camera tiles are fixed-width thumbnails (180px desktop, 120px mobile)
- Strip scrolls horizontally when there are many participants
- Strip sits in row 2 of the presentation grid, below the featured area

### Screen Share Tile Semantics

- Screen share tiles in the featured area:
  - **Member-info is hidden** — no name label, indicators, or badges visible
  - The placeholder shows "Your Screen" / "Name's Screen" when video is not active
- Screen share is content — the visual focus is on what's being shared, not who's sharing

### Screen Share Transitions

- Entering or exiting presentation mode uses smooth CSS transitions on `grid-template-rows`
- `updateGridLayout()` moves tiles via `appendChild()` — DOM elements are moved, not recreated
- Tile positions remain stable within the camera strip

### Local Screenshare Lifecycle

When the local user stops screen sharing, the screenshare tile is **removed entirely** from the DOM (not just hidden). This is different from camera tiles which persist:

```javascript
// In localMediaChange handler:
if (screen.video) {
    screenTile.style.display = 'flex';
    screenTile.querySelector('.video-placeholder')?.classList.add('hidden');
    screenTile.querySelector('video')?.classList.add('visible');
} else {
    screenTile.remove();   // Removed entirely, not hidden
}
```

When toggling screenshare on again, `toggleLiveScreen()` checks if the tile exists and re-creates it if needed before calling `toggleScreenshare()`.

Known SDK limitation: local self screenshare preview may appear black.

---

## Spotlight

Spotlight allows a camera tile to be promoted to the featured area alongside screenshare tiles, giving that participant visual prominence.

### Behavior

- Clicking the spotlight button on a camera tile toggles it into/out of the `.screenshare-area`
- Only **one** camera tile can be spotlighted at a time — spotlighting a new tile removes the previous spotlight
- Spotlighted tiles trigger presentation mode (same as screenshare) via `updateGridLayout()`
- When spotlight is removed and no screenshare is active, the grid returns to normal mode

### Visual Treatment

```css
/* Accent border on spotlighted tile */
.video-tile.tile-spotlighted {
    border: 2px solid var(--accent);
}

/* Spotlighted camera keeps cover fit and member-info (unlike screenshare) */
.screenshare-area .video-tile.tile-spotlighted .video-container video {
    object-fit: cover;
    background: var(--soft);
}

.screenshare-area .video-tile.tile-spotlighted .member-info {
    display: flex;
}
```

### Spotlight Button

- Appears in `.tile-actions` on camera tiles (hover-reveal)
- Icon toggles between expand (maximize arrows) and minimize (inward arrows)
- Button gets accent background when spotlight is active

---

## Tile Interactions (Drag, Resize, Fullscreen)

TinyRoom tiles support drag, resize, and fullscreen — enabling users to customize their view during a live session.

### Drag

- **Drag handle**: top-left corner of each tile, visible on hover
- Dragging converts the tile to `position: absolute` (`tile-dragged` class) and removes it from the grid flow
- Dragged tiles are constrained within the `#videoGrid` bounds
- Dragged tiles persist their position across layout updates (they're excluded from grid reflow)

```css
.drag-handle {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 10;
    opacity: 0;
    pointer-events: none;
    cursor: grab;
}

.video-tile:hover .drag-handle {
    opacity: 1;
    pointer-events: auto;
}

.video-tile.tile-dragged {
    position: absolute;
    transition: none;
}

.video-tile.tile-dragging {
    z-index: 50;
    opacity: 0.85;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}
```

### Resize

- **Resize handle**: bottom-right corner, visible on hover (diagonal lines indicator)
- Minimum size: 160px × 90px
- Resized tiles get the `tile-resized` class, which hides the aspect-ratio `::before` spacer
- Resize is free-form (not locked to 16:9)

```css
.resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
}

.video-tile.tile-resized::before { display: none; }
```

### Fullscreen

- Screenshare tiles have a **fullscreen button** in `.tile-actions` (top-right, hover-reveal)
- Uses the browser Fullscreen API (`requestFullscreen`)
- In fullscreen: border-radius and border are removed, `object-fit: contain` is used, and tile actions auto-hide after 1 second (re-appear on hover)

### Reset Layout

A **"Reset Layout"** button becomes visible when any tile has been dragged or resized. Clicking it:
- Removes `tile-dragged` and `tile-resized` classes from all tiles
- Clears all inline positioning styles (top, left, bottom, right, width)
- Removes all spotlight states
- Calls `updateGridLayout()` to restore the normal grid

### Pre-Live Restriction

- Drag handles, resize handles, and tile-actions are **hidden in pre-live** — they only appear on live room tiles

---

## Tile Layout Decision Model (Authoritative)

### How Layout Works

TinyRoom uses a **CSS class-based grid system**. The `updateGridLayout()` function counts visible tiles and applies a `grid-N` class (where N = 1–8) to `#videoGrid`. Each class defines the appropriate `grid-template-columns`.

When screenshare or spotlight is active, the grid switches to **presentation mode** instead (see [Screen Share & Presentation Mode](#screen-share--presentation-mode)).

### Layout Update Flow

1. Count visible tiles (exclude `display: none` and dragged tiles)
2. Check for screenshare or spotlight presence
3. If screenshare/spotlight → apply `presentation` class (featured area + camera strip)
4. Otherwise → apply `grid-N` class based on visible tile count (capped at 8)

```javascript
function updateGridLayout() {
    const grid = document.getElementById('videoGrid');
    const allTiles = Array.from(grid.querySelectorAll('.video-tile')).filter(
        c => c.style.display !== 'none'
    );
    const hasScreenshare = allTiles.some(c => c.dataset.streamType === 'screenshare');
    const hasSpotlight = allTiles.some(c => c.classList.contains('tile-spotlighted'));

    grid.className = '';

    if (hasScreenshare || hasSpotlight) {
        // Presentation mode — see Screen Share section
    } else {
        // Normal grid mode
        const gridCount = allVisible.filter(c => !c.classList.contains('tile-dragged')).length;
        if (gridCount > 0) grid.classList.add(`grid-${Math.min(gridCount, 8)}`);
    }
}
```

### Aspect Ratio (Hard Rule)

- All tiles preserve **16:9** via `::before { padding-top: 56.25% }`
- Cropping is allowed only as a last resort
- Letterboxing is preferred over distortion
- **Distortion is never allowed**

### Space-Maximizing Principle

Single-participant and pre-live tiles **fill the available viewport**, not use small fixed widths:

```css
#videoGrid.grid-1 .video-tile {
    width: min(100%, calc((100vh - 140px) * 16 / 9));
}
```

The 140px offset accounts for topbar + controls bar + padding. The tile is as large as possible while maintaining 16:9 without overflow.

### Grid CSS Classes (Desktop)

```css
/* 1 tile: centered, viewport-filling */
#videoGrid.grid-1 { grid-template-columns: 1fr; place-items: center; }
#videoGrid.grid-1 .video-tile { width: min(100%, calc((100vh - 140px) * 16 / 9)); }

/* 2 tiles: side by side */
#videoGrid.grid-2 { grid-template-columns: 1fr 1fr; }

/* 3 tiles: single row */
#videoGrid.grid-3 { grid-template-columns: 1fr 1fr 1fr; }

/* 4 tiles: 2×2 */
#videoGrid.grid-4 { grid-template-columns: 1fr 1fr; }

/* 5 tiles: 3+2 centered — 6-column sub-grid trick */
#videoGrid.grid-5 { grid-template-columns: repeat(6, 1fr); }
#videoGrid.grid-5 .video-tile { grid-column: span 2; }
#videoGrid.grid-5 .video-tile:nth-child(4) { grid-column: 2 / span 2; }

/* 6 tiles: 3×2 */
#videoGrid.grid-6 { grid-template-columns: 1fr 1fr 1fr; }

/* 7 tiles: 4+3 centered — 8-column sub-grid trick */
#videoGrid.grid-7 { grid-template-columns: repeat(8, 1fr); }
#videoGrid.grid-7 .video-tile { grid-column: span 2; }
#videoGrid.grid-7 .video-tile:nth-child(5) { grid-column: 2 / span 2; }

/* 8 tiles: 4×2 */
#videoGrid.grid-8 { grid-template-columns: 1fr 1fr 1fr 1fr; }
```

**How the sub-grid centering works (5 and 7 tiles):**
- For 5 tiles: a 6-column grid is used. Each tile spans 2 columns. Row 1 has tiles at columns 1-2, 3-4, 5-6. Row 2's first tile starts at column 2 (spanning 2-3), automatically centering the bottom row.
- For 7 tiles: same principle with 8 columns and the 5th tile offset to column 2.

### Summary Table

| Tile Count | Layout | CSS Class | Centering Method |
|-----------:|--------|-----------|-----------------|
| 1 | Single tile, centered, viewport-filling | `grid-1` | `place-items: center` |
| 2 | 1 row × 2 | `grid-2` | `1fr 1fr` |
| 3 | 1 row × 3 | `grid-3` | `1fr 1fr 1fr` |
| 4 | 2 × 2 | `grid-4` | `1fr 1fr` |
| 5 | 3 + 2 (centered) | `grid-5` | 6-col sub-grid |
| 6 | 3 × 2 | `grid-6` | `1fr 1fr 1fr` |
| 7 | 4 + 3 (centered) | `grid-7` | 8-col sub-grid |
| 8 | 4 × 2 | `grid-8` | `1fr 1fr 1fr 1fr` |

### Three-Participant Layout Rule

Default behavior (desktop):
- Use a single-row layout (1 × 3)
- All tiles equal size
- Group centered

Fallback behavior (tablet: 641px–768px):
- A 2 + 1 centered layout is used when viewport is too narrow for 3-across
- Uses the same sub-grid centering trick: `repeat(4, 1fr)` with tiles spanning 2 columns, 3rd tile offset to `grid-column: 2 / span 2`

```css
@media (min-width: 641px) and (max-width: 768px) {
    #videoGrid.grid-3 { grid-template-columns: repeat(4, 1fr); }
    #videoGrid.grid-3 .video-tile { grid-column: span 2; }
    #videoGrid.grid-3 .video-tile:nth-child(3) { grid-column: 2 / span 2; }
}
```

### Mobile (<=640px)

```css
@media (max-width: 640px) {
    #videoGrid.grid-2 { grid-template-columns: 1fr; }          /* Stack */
    #videoGrid.grid-3 { grid-template-columns: 1fr; }          /* Stack */
    #videoGrid.grid-4,
    #videoGrid.grid-6,
    #videoGrid.grid-8 { grid-template-columns: 1fr 1fr; }     /* 2-col */
    #videoGrid.grid-5 { grid-template-columns: 1fr 1fr; }     /* 2-col, reset sub-grid */
    #videoGrid.grid-5 .video-tile { grid-column: span 1; }
    #videoGrid.grid-7 { grid-template-columns: 1fr 1fr; }     /* 2-col, reset sub-grid */
    #videoGrid.grid-7 .video-tile { grid-column: span 1; }

    /* Screenshare stacks vertically */
    .screenshare-area { flex-direction: column; }
    .screenshare-area .video-tile { flex: none; width: 100%; }

    /* Camera strip thumbnails shrink */
    .camera-strip .video-tile { flex: 0 0 120px; width: 120px; }
}
```

### Tile Layout Anti-Patterns (Do Not Implement)

- Jumping layout when a participant toggles camera
- Reordering tiles based on audio level
- Host tiles being larger by default
- Left-aligned grids with empty trailing space
- Shrinking all tiles to fit a new participant instantly

When implementing tile layout logic, **prioritize visual balance over mathematical simplicity**.

---

## Topbar (Consistent Across Screens)

PRE-LIVE and LIVE screens must share an **identical topbar**:

- **Left**: App name (e.g. "TinyRoom")
- **Right**: Room code (monospace, accent-colored pill) + copy-code button + copy-link button

This gives users persistent access to sharing tools and maintains visual continuity across state transitions. The topbar sits at the top edge, outside the centered content area.

### Copy Button Feedback

- When a copy button (copy-code or copy-link) is clicked, a **"Copied!" tooltip** appears directly below the button
- The tooltip fades in, stays for 1.5 seconds, then fades out
- Styled with inverted colors (`--text` background, `--bg` text) for contrast against the topbar
- No toast notification — feedback is localized to the button itself

---

## Controls Placement

Primary controls:
- Mic
- Camera
- Leave room

Secondary:
- Screen share
- Settings

Placement:
- Desktop: bottom center bar
- Mobile: floating bottom bar

Leave button must be visually separated (danger affordance).

### Leave Room Behavior

When the user leaves a room:
- Return to the **entry screen** (create/join), NOT the pre-live screen
- All video tiles must be destroyed
- Camera and mic preview must be released
- Room state is fully reset — the user can start or join a new room immediately

---

## Theme Mode: Light / Dark (User Choice)

Users must be able to choose between **Light mode** and **Dark mode**. The choice applies globally across entry, pre-live, and live room states.

### Principles

- **Dark mode is the default**
- Light mode is available as an equal, first-class option
- Mode switching must not affect layout, sizing, or behavior
- Only colors, shadows, and contrast change — **structure stays identical**

### Implementation Rules

- Use CSS variables for all colors (no hard-coded values)
- Theme switch is implemented by toggling a root attribute or class:
  - `data-theme="dark"` (default)
  - `data-theme="light"`
- All components must derive colors from semantic tokens (bg, card, text, accent, etc.)

### Dark Mode Token Guidance

Dark mode should:
- Reduce eye strain
- Preserve hierarchy and contrast
- Avoid pure black backgrounds

Recommended adjustments (example):

```css
[data-theme="dark"] {
  --bg: #0f172a;          /* deep slate */
  --card: #111827;        /* card surface */
  --soft: #1f2937;        /* subtle fill */
  --border: #273244;
  --borderSoft: #334155;

  --text: #e5e7eb;
  --muted: #9ca3af;
  --muted2: #6b7280;

  /* accent remains the same hue */
  --accent: #0EA5A4;
  --accentHover: #14b8a6;
  --accentSoft: rgba(14,165,164,.18);
  --accentBorder: rgba(14,165,164,.45);

  --liveBg: rgba(16,185,129,.15);
  --liveBorder: rgba(16,185,129,.4);
  --liveText: #a7f3d0;

  --dangerBg: rgba(239,68,68,.15);
  --dangerBorder: rgba(239,68,68,.4);
  --dangerText: #fca5a5;

  --overlay: rgba(0,0,0,0.6);
}
```

### UX Rules

- Theme choice must persist (localStorage or user preference)
- Theme toggle is placed in the **bottom-right corner** (fixed position, `z-index: 100`) — visible but unobtrusive across all screens
- Switching themes should be instant (no reload)
- Respect system preference on first visit (`prefers-color-scheme`)
- HTML root element must start with `data-theme="dark"` (dark is the default; JS upgrades to light if system preference or saved choice indicates light)

---

## Motion & Accessibility

Motion:
- Join / leave: soft scale + fade
- Layout reflow: smooth transitions
- Active speaker: subtle emphasis only

Accessibility:
- Never rely on color alone
- Respect reduced-motion
- Readable labels at small sizes
- Avoid flashing

---

## Summary

- MINI_GUIDE controls behavior
- DESIGN_GUIDE controls UI
- PRE-LIVE ≠ EXIT
- Camera tiles persist across LIVE ⇄ PRE-LIVE; screenshare tiles removed entirely on stream end
- Remote members visible in both LIVE and PRE-LIVE states
- Single `#videoGrid` switches between normal grid mode (grid-1 through grid-8) and presentation mode
- Presentation mode: `.screenshare-area` (featured) + `.camera-strip` (thumbnails) created dynamically
- Spotlight promotes a camera tile to the featured area alongside screenshare tiles
- Tile interactions: drag, resize, fullscreen, spotlight — all hover-reveal, live room only
- Media indicators always visible
- Screen share = separate tile in the featured area, member-info hidden
- Calm, human-first design

---

End of DESIGN_GUIDE_v2.3

---

---

*VibeLive Integration Guide — MiniChat API v0.63 + Design Guide v2.3 | Last updated: 2026-02-19*