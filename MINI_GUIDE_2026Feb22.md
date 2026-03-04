# MiniChat API Guide

**Build an anonymous video chat app with MiniChat**

Version 0.65 | February 22, 2026

Works with vanilla JS, React, Vue, or any framework. See [Using MiniChat with React](#using-minichat-with-react) for React-specific patterns.

---

## Setup

There are two ways to load MiniChat depending on your workflow.

### Option A — Source Module (development / frameworks)

Import directly from the source file, which has `export default`:

```html
<script type="module">
    import MiniChat from 'https://proto2.makedo.com/v05/scripts/minichat-api.js';

    MiniChat.init({
        contextId: 'YOUR_CONTEXT_ID',
        contextAuthToken: 'YOUR_CONTEXT_TOKEN'
    });

    // Wire up events...
    MiniChat.on('channelSelected', (channel) => { /* ... */ });
    MiniChat.on('remoteStreamStart', (memberId, streamType) => { /* ... */ });
</script>

<!-- onclick handlers just work — MiniChat is also on window automatically -->
<button onclick="MiniChat.signup('Alex')">Join</button>
<button onclick="MiniChat.startLive()">Go Live</button>
```

### Option B — Pre-built Bundle (production / plain HTML)

Load `makedo-vibelive.min.js` with a plain `<script>` tag. No `import`, no module setup:

```html
<!-- Load the bundle — puts MiniChat on window immediately -->
<script src="https://proto2.makedo.com/v05/scripts/makedo-vibelive.min.js"></script>

<script>
    MiniChat.init({
        contextId: 'YOUR_CONTEXT_ID',
        contextAuthToken: 'YOUR_CONTEXT_TOKEN'
    });

    MiniChat.on('channelSelected', (channel) => { /* ... */ });
    MiniChat.on('remoteStreamStart', (memberId, streamType) => { /* ... */ });
</script>

<!-- onclick handlers work the same way -->
<button onclick="MiniChat.signup('Alex')">Join</button>
<button onclick="MiniChat.startLive()">Go Live</button>
```

The bundle is a single self-contained file — no import maps, no `type="module"`, no build tools required. This is the simplest integration for plain HTML pages or CMS environments.

> **⚠️ Don't mix them**: Do not `import MiniChat from 'makedo-vibelive.min.js'` — the bundle is IIFE format and has no `export default`. Use Option A (`minichat-api.js`) for module imports, or Option B (`makedo-vibelive.min.js`) with a plain `<script>` tag.

> **🧪 Test Credentials**: Use `contextId: 'Kw6w6w6w6w'` and `contextAuthToken: 'qftRdeQ12ZcrKYixauWpxGiB'` for quick testing.

`MiniChat` is automatically available on `window` in both options — all methods work directly in `onclick` handlers without any extra wiring. The `onclick` style is fine for demos and quick prototypes, but for real apps use `addEventListener` — it supports `async/await`, proper error handling, and keeps logic out of HTML attributes.

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
// On room entry: connect WebRTC first
await MiniChat.startLive();          // WebRTC only — does NOT start audio or video

// Then start capture (startLive does not do this automatically)
await MiniChat.toggleAudio();        // Starts mic — required before toggleMuteAudio() is meaningful
await MiniChat.toggleVideo();        // Starts camera

// User clicks mic button (during call)
MiniChat.toggleMuteAudio();         // Mute/unmute — instant, no hardware restart

// User clicks camera button (during call)
MiniChat.toggleVideo();             // Stop/start — hardware light on/off
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
    tile.dataset.isLocal = isLocal ? 'true' : 'false';

    // Video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';

    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    if (streamType === 'camera') {
        placeholder.innerHTML = `<span>${isLocal ? `${name} (You)` : name}</span>`;
    } else {
        placeholder.innerHTML = `<span>🖥️ ${isLocal ? `${name}'s (You)` : name + "'s"} Screen</span>`;
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
                <span class="indicator cam-video" title="Camera">📹</span>
                <span class="indicator cam-audio" title="Microphone">🎤</span>
            </div>
        `;
    } else {
        memberInfo.innerHTML = `
            <span class="member-name">🖥️ ${isLocal ? `${name}'s (You)` : name + "'s"} Screen</span>
        `;
    }

    tile.appendChild(videoContainer);
    tile.appendChild(memberInfo);
    // Camera tiles go to cameraGrid; screenshare tiles go to screenshareGrid
    const targetGrid = streamType === 'screenshare'
        ? document.getElementById('screenshareGrid')
        : document.getElementById('cameraGrid');
    targetGrid.appendChild(tile);

    // Register local elements immediately (Element-First Rule)
    if (isLocal) {
        if (streamType === 'camera') {
            MiniChat.setLocalCamera(video);
        } else {
            MiniChat.setLocalScreen(video);
        }
    }
}
```

**Key points:**
- Each tile is independent — camera and screenshare are separate grid items
- `data-member-id`, `data-stream-type`, and `data-is-local` attributes enable CSS targeting and DOM queries
- CSS examples: `#screenshareGrid .video-tile { width: 100%; }` · `.video-tile[data-is-local="true"] { border: 2px solid #0af; }`
- To find all remote tiles: `document.querySelectorAll('.video-tile[data-is-local="false"]')`
- **Two containers are required:** `#cameraGrid` for camera tiles and `#screenshareGrid` for screenshare tiles. This keeps them independently styled and positioned — screenshare tiles are typically larger, full-width, or in a separate column.
- `playsInline` is required for iOS
- `muted = true` on local video prevents audio feedback

---

## Moving Video Tiles (Preview Areas, Featured Views)

When implementing preview modes or featured speaker layouts, **always move the existing DOM element** — never remove and recreate.

### ✅ The Safe Way: appendChild()

```javascript
// Move to preview area (PRE-LIVE)
const tile = document.getElementById(`tile-${MiniChat.memberId}-camera`);
document.getElementById('previewArea').appendChild(tile);

// Move back to camera grid (LIVE)
document.getElementById('cameraGrid').appendChild(tile);
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

    // Screenshare tile (hide tile entirely when inactive)
    const screenTile = document.getElementById(`tile-${MiniChat.memberId}-screenshare`);
    if (screenTile) {
        if (screen.video) {
            screenTile.style.display = 'flex';
            screenTile.querySelector('.video-placeholder')?.classList.add('hidden');
            screenTile.querySelector('video')?.classList.add('visible');
        } else {
            screenTile.style.display = 'none';
        }
    }

    updateMemberIndicators(MiniChat.memberId);
});
```

**Important:** Local video is attached **directly** when you call `toggleVideo()`, not via WebRTC events. `remoteStreamStart` only fires for **remote** members.

### Handling Member Left

Check whether they truly exited or just returned to PRE-LIVE:

```javascript
MiniChat.on('remoteLeft', (memberId) => {
    const m = MiniChat.getMember(memberId);
    if (m?.displayStatus === 'EXITED') {
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
        if (m.displayStatus === 'LIVE' || m.displayStatus === 'PRE-LIVE') {
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
> The example above creates tiles for both `'LIVE'` and `'PRE-LIVE'` members when you go LIVE. This is the recommended default — you see everyone already in the channel, including those still preparing.
>
> You can restrict to `'LIVE'` only if your app only wants to show members who are actively streaming:
> ```javascript
> // Variation: streamers only
> if (m.displayStatus === 'LIVE') {
>     createVideoTile(m.id, m.displayName, 'camera', false);
> }
> ```
> The tradeoff:
> - **`'LIVE' || 'PRE-LIVE'`** — everyone present gets a tile immediately; good for small groups and social apps
> - **`'LIVE'` only — tiles appear only when streaming starts; better for larger rooms or broadcast-style apps where PRE-LIVE presence is invisible by design
>
> Note: `remoteJoined` fires when a member goes LIVE (not when they enter PRE-LIVE), so it always represents a `'LIVE'` member — no filtering needed there.

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
member.displayStatus   // 'LIVE', 'PRE-LIVE', or 'EXITED'
member.hasCamera       // boolean
member.hasScreenshare  // boolean

// Fetch all current channel members from server
const members = await MiniChat.getMembers();
// → [{ id, displayName, displayStatus, ... }]
```

Use `MiniChat.memberId` for your own member ID. Use `MiniChat.roomCode` for the shareable room code.

`memberUpdate` fires for ALL members including yourself. Always re-query `getMember(memberId)` inside the handler — the event is a signal that data changed, not a carrier of the new data:

```javascript
MiniChat.on('memberUpdate', (memberId) => {
    const member = MiniChat.getMember(memberId);  // re-query for fresh state
    if (!member) return;
    // member.displayStatus, member.displayName, member.hasCamera, etc. are now current
});
```

---

## Complete Minimal Example

A working app in under 50 lines of JavaScript:

```html
<!DOCTYPE html>
<html>
<head>
    <title>MiniChat Demo</title>
    <style>
        .video-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .video-tile { position: relative; width: 320px; height: 240px; background: #222; }
        .video-tile video { width: 100%; height: 100%; object-fit: cover; }
        .video-placeholder { position: absolute; inset: 0; display: flex;
            align-items: center; justify-content: center; color: white; font-size: 1.2em; }
        .hidden { display: none; }
        .visible { display: block; }
        /* Screenshare tiles are wider — style independently from camera grid */
        #screenshareGrid .video-tile { width: 100%; max-width: 800px; height: 450px; }
    </style>
</head>
<body>
    <h2>MiniChat</h2>

    <div id="entry">
        <input id="name" placeholder="Your name">
        <button id="createBtn">Create Room</button>
        <input id="code" placeholder="Room code">
        <button id="joinBtn">Join Room</button>
    </div>

    <div id="controls" style="display: none;">
        <span id="roomInfo"></span>
        <button onclick="MiniChat.startLive()">Go Live</button>
        <button onclick="MiniChat.stopLive()">Stop Live</button>
        <button onclick="MiniChat.toggleVideo()">Toggle Camera</button>
        <button onclick="MiniChat.toggleMuteAudio()">Mute/Unmute Mic</button>
    </div>

    <div id="screenshareGrid" class="video-grid"></div>
    <div id="cameraGrid" class="video-grid"></div>

    <script type="module">
        import MiniChat from 'https://proto2.makedo.com/v05/scripts/minichat-api.js';

        MiniChat.init({ contextId: 'Kw6w6w6w6w', contextAuthToken: 'qftRdeQ12ZcrKYixauWpxGiB' });

        // --- Entry functions ---

        document.getElementById('createBtn').addEventListener('click', async () => {
            await MiniChat.signup(document.getElementById('name').value || 'Guest');
            const room = await MiniChat.createRoom('My Room');
            await MiniChat.enterByRoomCode(room.room_code);
        });

        document.getElementById('joinBtn').addEventListener('click', async () => {
            await MiniChat.signup(document.getElementById('name').value || 'Guest');
            await MiniChat.enterByRoomCode(document.getElementById('code').value);
        });

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
                    (m.displayStatus === 'LIVE' || m.displayStatus === 'PRE-LIVE')) {
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
            if (screenTile) screenTile.style.display = MiniChat.screenState.video ? 'block' : 'none';
        });

        MiniChat.on('remoteLeft', (id) => {
            const m = MiniChat.getMember(id);
            if (m?.displayStatus === 'EXITED') {
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
            tile.dataset.isLocal = isLocal ? 'true' : 'false';
            if (streamType === 'screenshare' && isLocal) tile.style.display = 'none';

            tile.innerHTML = `
                <div class="video-placeholder"><span>${streamType === 'camera'
                    ? (isLocal ? `${name} (You)` : name)
                    : '🖥️ ' + (isLocal ? `${name}'s (You)` : name + "'s") + ' Screen'}</span></div>
                <video autoplay playsinline ${isLocal || streamType === 'screenshare' ? 'muted' : ''}></video>
            `;

            // Camera tiles go to cameraGrid; screenshare tiles go to screenshareGrid
            const targetGrid = streamType === 'screenshare'
                ? document.getElementById('screenshareGrid')
                : document.getElementById('cameraGrid');
            targetGrid.appendChild(tile);

            if (isLocal) {
                const video = tile.querySelector('video');
                if (streamType === 'camera') MiniChat.setLocalCamera(video);
                else MiniChat.setLocalScreen(video);
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

8. **Not checking status in `remoteLeft`** — A member with `displayStatus === 'PRE-LIVE'` hasn't left; they may rejoin. Only remove tiles for `'EXITED'` members.

9. **Using `getMediaStates()` for local indicators** — Use `MiniChat.mediaState` for the local user. `getMediaStates(MiniChat.memberId)` reflects WebRTC state and is meaningless in PRE-LIVE.

10. **Confusing toggle vs mute** — Camera: use `toggleVideo()` (hardware on/off). Microphone: use `toggleMuteAudio()` after initial startup (instant mute/unmute).

11. **Removing and recreating tiles to move them** — Use `appendChild()` to move the existing element. Never `.remove()` then recreate — the stream attachment is lost.

12. **Ignoring self status changes in `memberUpdate`** — While you shouldn't create tiles for yourself, you MUST update your UI controls (Start/Stop Live buttons, status text) when `memberId === MiniChat.memberId`. Check `member.displayStatus` and update buttons BEFORE returning:
   ```javascript
   MiniChat.on('memberUpdate', (memberId) => {
       const member = MiniChat.getMember(memberId);
       if (memberId === MiniChat.memberId) {
           // Update YOUR controls based on status
           if (member.displayStatus === 'LIVE') {
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

---

## Using MiniChat with React

MiniChat works well with React. A few patterns to know:

### Stabilize ref callbacks with `useCallback`

MiniChat needs real DOM elements via `setLocalCamera()`, `setRemoteCamera()`, etc. In React, an inline ref callback creates a new function on every render, which causes React to tear down and re-fire the ref — re-registering the same element repeatedly. This can cause **video flicker**.

Wrap ref callbacks in `useCallback`:

```jsx
const videoRefCallback = useCallback((el) => {
    if (!el) return;
    if (tile.isLocal) MiniChat.setLocalCamera(el);
}, [tile.id, tile.isLocal, tile.streamType]);

<video ref={videoRefCallback} autoPlay playsInline muted />
```

### The Element-First Rule in React

The [Element-First Rule](#the-element-first-rule) requires local video elements to exist *before* streams are produced. In React, elements only exist after render — so if your component conditionally renders a tile based on state, the element won't be in the DOM when `toggleVideo()` runs.

Always include local tiles in the render output and hide with `style` instead of unmounting:

```jsx
// ✅ Always in DOM — ref fires on mount, element ready before toggleVideo()
const hideTile = tile.isLocal && !tile.showVideo;
<div style={hideTile ? { display: 'none' } : {}}>
    <video ref={videoRefCallback} ... />
</div>

// ❌ Element doesn't exist until showVideo is true — too late
{tile.showVideo && <div><video ref={videoRefCallback} ... /></div>}
```

### Register remote elements after render

When `remoteStreamStart` fires, you'll update state to add a tile — but React hasn't rendered yet, so the `<video>` element doesn't exist. Register remote elements in a `useEffect` that runs after the render completes:

```jsx
useEffect(() => {
    tiles.forEach(tile => {
        if (tile.isLocal || !tile.showVideo) return;
        const el = videoRefs.current[tile.id];
        if (!el) return;
        MiniChat.setRemoteCamera(tile.memberId, el);
    });
}, [tiles]);
```

> **Note:** The API includes same-element guards, so calling `setRemoteCamera()` with an already-registered element is harmless. You don't need to track registration state yourself.

---

*MiniChat API v1.0*
