# VibeLive API Guide

**Build an anonymous video chat app with VibeLive**

Version 0.75 | March 04, 2026

Works with vanilla JS, React, Vue, or any framework. See [Using VibeLive with React](#using-vibelive-with-react) for React-specific patterns.

---

## Setup

There are two ways to load VibeLive depending on your workflow.

### Option A â€” ESM Bundle (frameworks / module imports)

Import the self-contained ESM bundle â€” works with React, Vue, Svelte, TypeScript, or any `import`-based workflow. No source files needed:

```html
<script type="module">
    import VibeLive from 'https://makedo.com/sdk/makedo-vibelive.esm.js';

    VibeLive.init({ contextId: 'YOUR_CONTEXT_ID' });

    // Wire up events...
    VibeLive.on('channelSelected', (channel) => { /* ... */ });
    VibeLive.on('remoteStreamStart', (memberId, streamType) => { /* ... */ });
</script>
```

Or if bundling your own app with webpack/vite/esbuild, install the file locally and import it:

```javascript
import VibeLive from './sdk/makedo-vibelive.esm.js';
```

### Option B â€” Pre-built Bundle (plain HTML / no build tools)

Load `makedo-vibelive.min.js` with a plain `<script>` tag. No `import`, no module setup:

```html
<!-- Load the bundle â€” puts VibeLive on window immediately -->
<script src="https://makedo.com/sdk/makedo-vibelive.min.js"></script>

<script>
    VibeLive.init({ contextId: 'YOUR_CONTEXT_ID' });

    VibeLive.on('channelSelected', (channel) => { /* ... */ });
    VibeLive.on('remoteStreamStart', (memberId, streamType) => { /* ... */ });
</script>

<!-- onclick handlers work the same way -->
<button onclick="VibeLive.signup('Alex')">Join</button>
<button onclick="VibeLive.startLive()">Go Live</button>
```

The bundle is a single self-contained file â€” no import maps, no `type="module"`, no build tools required. This is the simplest integration for plain HTML pages or CMS environments.

> **âš ï¸ Don't mix them**: Do not `import VibeLive from 'makedo-vibelive.min.js'` â€” the IIFE bundle has no `export default`. For module imports use Option A (`makedo-vibelive.esm.js`); for plain `<script>` tags use Option B (`makedo-vibelive.min.js`).

> **ðŸ§ª Quick Start**: Use `contextId: 'vlp_Hsnz3HDI7gAA'` to test immediately â€” no token needed.

> **Trial vs. Production**  
> Your context ID is all you need to get started. Trial contexts work out of the box â€” the server applies automatic session limits (room size, duration, concurrency).  
> When you're ready to go to production, you'll receive a non-trial context. Production contexts require a `proxy` option: a server-side endpoint you control that adds your secret auth token to outbound requests, keeping it out of client-side code. Pass it as `proxy: '/my-proxy'`. See [Going to Production](#going-to-production) for details.

`VibeLive` is automatically available on `window` in both options â€” all methods work directly in `onclick` handlers without any extra wiring. The `onclick` style is fine for demos and quick prototypes, but for real apps use `addEventListener` â€” it supports `async/await`, proper error handling, and keeps logic out of HTML attributes.

---

## User Flow

Anonymous users have two paths â€” **create** or **join** a room:

```
signup(name) â†’ createRoom(title) â†’ enterByRoomCode(code) â†’ startLive()
signup(name) â†’ enterByRoomCode(code) â†’ startLive()
```

### Create a Room

```javascript
await VibeLive.signup('Alex');
const room = await VibeLive.createRoom("Alex's Room");
// room.room_code is the shareable code (e.g., "X7kQ3m")
await VibeLive.enterByRoomCode(room.room_code);
// Now in PRE-LIVE â€” call startLive() when ready
```

### Join a Room

```javascript
await VibeLive.signup('Jordan');
await VibeLive.enterByRoomCode('X7kQ3m');
// Now in PRE-LIVE â€” call startLive() when ready
```

### Change Display Name on Rejoin

Pass an optional `displayName` to update your name when entering a channel:

```javascript
// Exit current room
await VibeLive.exitRoom();

// Re-enter with new display name (no page reload needed)
await VibeLive.enterByRoomCode('X7kQ3m', 'NewName');
// Other members will receive a member_config_update event with your new name
```

### Always `await` Authentication

`signup()` must complete before any other calls. It establishes the session and WebSocket connection.

---

## Member Lifecycle: PRE-LIVE â†’ LIVE â†’ EXIT

```
PRE-LIVE    â†’    LIVE    â†’    PRE-LIVE or EXIT
(preparing)      (streaming)   (back or gone)
```

| State | What's happening | How to enter |
|-------|-----------------|--------------|
| **PRE-LIVE** | Channel selected, no WebRTC | `enterByRoomCode()` |
| **LIVE** | WebRTC connected, sending/receiving media | `startLive()` |
| **PRE-LIVE** | WebRTC disconnected, still in channel | `stopLive()` |
| **EXIT** | Fully departed, camera released | `exitRoom()` |

- `startLive()` â€” Connect WebRTC, go LIVE
- `stopLive()` â€” Disconnect WebRTC, return to PRE-LIVE (quick rejoin possible)
- `exitRoom()` â€” Full teardown, release camera/mic, stay logged in (can enter a different room)
- `logout()` â€” Full session teardown including authentication

---

## Media Controls

### Toggle vs Mute

Two different concepts â€” understand the difference:

| Action | What Happens | Camera Light | Others See |
|--------|--------------|--------------|------------|
| `toggleVideo()` | Start/stop capture | On/Off | Video appears/disappears |
| `toggleMuteVideo()` | Hide while capturing | Stays On | Black frame |
| `toggleAudio()` | Start/stop microphone | â€” | Audio appears/disappears |
| `toggleMuteAudio()` | Silence while capturing | â€” | Silence |

`toggleScreenshare()` starts/stops screen sharing.

### Recommended UX Pattern

**Camera button:** Use `toggleVideo()`
- Users expect the camera light to turn OFF (privacy)
- Stopping capture releases system resources

**Microphone button:** Use `toggleMuteAudio()` (after initial `toggleAudio()` to start capture)
- Users expect instant unmute (common in meetings)
- Keeps microphone warm â€” no permission prompt when unmuting

**Example:**
```javascript
// On room entry: connect WebRTC first
await VibeLive.startLive();          // WebRTC only â€” does NOT start audio or video

// Then start capture (startLive does not do this automatically)
await VibeLive.toggleAudio();        // Starts mic â€” required before toggleMuteAudio() is meaningful
await VibeLive.toggleVideo();        // Starts camera

// User clicks mic button (during call)
VibeLive.toggleMuteAudio();         // Mute/unmute â€” instant, no hardware restart

// User clicks camera button (during call)
VibeLive.toggleVideo();             // Stop/start â€” hardware light on/off
```

Use `toggleMuteVideo()` only for specialized cases (e.g., "hide self while fixing appearance" but keep capturing).

### Screenshare

Screen sharing is typically offered in **LIVE mode only**. In both cases, follow the Element-First Rule: create and register the screenshare tile in `channelSelected` (hidden with `display: none`).

### Reading Local Media State

```javascript
VibeLive.mediaState
// â†’ { audio: true/false, video: true/false, audioMuted: true/false, videoMuted: true/false }

VibeLive.screenState
// â†’ { video: true/false, videoMuted: true/false }
```

### Reading Remote Media State

```javascript
const states = VibeLive.getMediaStates(memberId);
// states.cam_audio_detail: 'ON' | 'MUTED' | 'OFF'
// states.cam_video_detail: 'ON' | 'HIDDEN' | 'OFF'
// states.screen_audio_detail: 'ON' | 'MUTED' | 'OFF'
// states.screen_video_detail: 'ON' | 'HIDDEN' | 'OFF'
```

### Local vs Live Media State

There are two separate "worlds" of media state:

| Source | What it reflects | Use for |
|--------|-----------------|--------|
| `VibeLive.mediaState` | **Hardware state** â€” is the camera/mic capturing? | Local user's indicators |
| `VibeLive.getMediaStates(id)` | **WebRTC state** â€” what's being transmitted? | Remote member indicators |

In **PRE-LIVE**, the local camera can be on (for preview) but nothing is transmitted. This is correct â€” the local indicator reflects what the user cares about: *"Is my camera on?"*

In **LIVE**, the two states naturally align. No special synchronization logic is needed.

**Always use `VibeLive.mediaState` for the local user's indicators** â€” never `VibeLive.getMediaStates(VibeLive.memberId)`, which reflects WebRTC state and won't be meaningful in PRE-LIVE.

---

## The Element-First Rule

> **For local streams: register video elements before streams arrive, not in response to them.**

When VibeLive creates a media stream, it immediately attaches to whatever `<video>` element you've registered. No element registered = stream silently lost.

| Media Type | When to Register | Why |
|---|---|---|
| **Local camera** | At tile creation time | `toggleVideo()` attaches immediately |
| **Local screenshare** | At tile creation time (hidden) | `toggleScreenshare()` attaches immediately |
| **Remote camera** | Inside `remoteStreamStart` handler | Stream is arriving *right now* |
| **Remote screenshare** | Inside `remoteStreamStart` handler | Stream is arriving *right now* |

> **Note:** The "before streams arrive" requirement applies only to **local** streams. For remote streams, `remoteStreamStart` is both the signal and the correct registration moment â€” there is nothing to pre-create.

```javascript
// âœ… Register both local elements at tile creation
VibeLive.setLocalCamera(cameraVideoEl);
VibeLive.setLocalScreen(screenVideoEl);

// âŒ DON'T create elements in localMediaChange â€” too late!
```

**Why this matters for screenshare:** When you call `toggleScreenshare()`, the stream is produced **instantly**. If you wait until `localMediaChange` fires to create the tile and call `setLocalScreen()`, the stream has already been produced with no element to attach to â€” result: blank screen. The element must exist and be registered **before** the user clicks the screenshare button.

---

## Building Video Tiles

Each video stream gets its own **independent tile** identified by `tile-{memberId}-{streamType}`. This gives maximum layout flexibility â€” screenshare tiles can span multiple grid columns, expand on click, or move to a featured area.

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
        placeholder.innerHTML = `<span>ðŸ–¥ï¸ ${isLocal ? `${name}'s (You)` : name + "'s"} Screen</span>`;
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
                <span class="indicator cam-video" title="Camera">ðŸ“¹</span>
                <span class="indicator cam-audio" title="Microphone">ðŸŽ¤</span>
            </div>
        `;
    } else {
        memberInfo.innerHTML = `
            <span class="member-name">ðŸ–¥ï¸ ${isLocal ? `${name}'s (You)` : name + "'s"} Screen</span>
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
            VibeLive.setLocalCamera(video);
        } else {
            VibeLive.setLocalScreen(video);
        }
    }
}
```

**Key points:**
- Each tile is independent â€” camera and screenshare are separate grid items
- `data-member-id`, `data-stream-type`, and `data-is-local` attributes enable CSS targeting and DOM queries
- CSS examples: `#screenshareGrid .video-tile { width: 100%; }` Â· `.video-tile[data-is-local="true"] { border: 2px solid #0af; }`
- To find all remote tiles: `document.querySelectorAll('.video-tile[data-is-local="false"]')`
- **Two containers are required:** `#cameraGrid` for camera tiles and `#screenshareGrid` for screenshare tiles. This keeps them independently styled and positioned â€” screenshare tiles are typically larger, full-width, or in a separate column.
- `playsInline` is required for iOS
- `muted = true` on local video prevents audio feedback

---

## Moving Video Tiles (Preview Areas, Featured Views)

When implementing preview modes or featured speaker layouts, **always move the existing DOM element** â€” never remove and recreate.

### âœ… The Safe Way: appendChild()

```javascript
// Move to preview area (PRE-LIVE)
const tile = document.getElementById(`tile-${VibeLive.memberId}-camera`);
document.getElementById('previewArea').appendChild(tile);

// Move back to camera grid (LIVE)
document.getElementById('cameraGrid').appendChild(tile);
```

**Why this works:** `appendChild()` **moves** the element. The `<video>` element's `srcObject` persists. Element registration remains valid. No re-registration needed.

### âŒ Mistakes That Break Streams

```javascript
// âŒ Remove then recreate â€” stream lost
oldTile.remove();
createVideoTile(...);

// âŒ Clone the element â€” new element has no stream
const clone = original.cloneNode(true);

// âŒ Replace innerHTML â€” destroys the original element
container.innerHTML = tile.outerHTML;
```

---

## Event Handlers

### Registering Events

Use `VibeLive.on(event, callback)`:

```javascript
// Connection state (local)
VibeLive.on('localJoined', () => { });       // You went LIVE
VibeLive.on('localLeft', () => { });         // You returned to PRE-LIVE
VibeLive.on('kicked', (message) => { });     // Server ended the meeting â€” do NOT call exitRoom()

// Remote members
VibeLive.on('remoteJoined', (memberId) => { });
VibeLive.on('remoteLeft', (memberId) => { });
VibeLive.on('memberUpdate', (memberId) => { });   // Status changed (includes self!)

// Streams
VibeLive.on('remoteStreamStart', (memberId, streamType) => { });  // 'camera' or 'screenshare'
VibeLive.on('remoteStreamEnd', (memberId, streamType) => { });
VibeLive.on('remoteMediaChange', (memberId, streamType) => { });  // Mute/unmute

// Local media
VibeLive.on('localMediaChange', () => { });

// Channel
VibeLive.on('channelSelected', (channel) => { });

// Errors
VibeLive.on('error', (context, error) => { });
```

Events can be chained:
```javascript
VibeLive.on('localJoined', handleJoined)
        .on('localLeft', handleLeft)
        .on('error', handleError);
```

### System-Initiated Exits (`kicked`)

The server can end a meeting for all participants (e.g. a trial time limit). When this happens, `kicked` fires with an optional message. By this point the bridge has already stopped all tracks and cleaned up state â€” **do not call `exitRoom()`**.

The recommended pattern is a shared teardown function called from both your exit button and your `kicked` handler:

```javascript
function tearDownRoom(statusMessage = '') {
    document.getElementById('cameraGrid').innerHTML = '';
    roomScreen.style.display  = 'none';
    entryScreen.style.display = 'block';
    setStatus(statusMessage);
}

exitBtn.addEventListener('click', async () => {
    await VibeLive.exitRoom();
    tearDownRoom();
});

VibeLive.on('kicked', (message) => {
    // exitRoom() already called internally â€” just update the UI
    tearDownRoom(message || 'The meeting has ended.');
});
```

### Handling Remote Streams

When a remote member starts streaming, create their tile and attach the stream:

```javascript
VibeLive.on('remoteStreamStart', (memberId, streamType) => {
    if (!VibeLive.isLive) return;  // Privacy-aware: only show when you're live

    const m = VibeLive.getMember(memberId);
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
            VibeLive.setRemoteCamera(memberId, video);
        } else {
            VibeLive.setRemoteScreen(memberId, video);
        }
    }

    updateMemberIndicators(memberId, streamType);
});

VibeLive.on('remoteStreamEnd', (memberId, streamType) => {
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

> **âš ï¸ Always create tiles on demand in `remoteStreamStart`.**
> When you call `startLive()`, WebRTC begins immediately. If others are already streaming, `remoteStreamStart` can fire **before** `remoteJoined`. If the tile doesn't exist, create it right there. Since `createVideoTile()` guards against duplicates, this is always safe.

### Video Placeholder vs Stream Presence

A stream can exist with only an audio track (video stopped). Use `remoteMediaChange` to check the actual video state:

```javascript
VibeLive.on('remoteMediaChange', (memberId, streamType) => {
    const states = VibeLive.getMediaStates(memberId);
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

VibeLive attaches streams but **never controls visibility**. Use `localMediaChange` to show/hide your own video:

```javascript
VibeLive.on('localMediaChange', () => {
    const s = VibeLive.mediaState;
    const screen = VibeLive.screenState;

    // Camera tile
    const camTile = document.getElementById(`tile-${VibeLive.memberId}-camera`);
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
    const screenTile = document.getElementById(`tile-${VibeLive.memberId}-screenshare`);
    if (screenTile) {
        if (screen.video) {
            screenTile.style.display = 'flex';
            screenTile.querySelector('.video-placeholder')?.classList.add('hidden');
            screenTile.querySelector('video')?.classList.add('visible');
        } else {
            screenTile.style.display = 'none';
        }
    }

    updateMemberIndicators(VibeLive.memberId);
});
```

**Important:** Local video is attached **directly** when you call `toggleVideo()`, not via WebRTC events. `remoteStreamStart` only fires for **remote** members.

### Handling Member Left

Check whether they truly exited or just returned to PRE-LIVE:

```javascript
VibeLive.on('remoteLeft', (memberId) => {
    const m = VibeLive.getMember(memberId);
    if (m?.displayStatus === 'EXITED') {
        // Remove tiles â€” they've left
        document.getElementById(`tile-${memberId}-camera`)?.remove();
        document.getElementById(`tile-${memberId}-screenshare`)?.remove();
    }
    // If PRE-LIVE, keep tiles â€” they may rejoin
});
```

---

## Privacy-Aware Visibility

Recommended pattern: only show remote member tiles when the local user is LIVE. This gives users a private "green room" in PRE-LIVE for adjusting camera/mic.

```javascript
VibeLive.on('channelSelected', async (channel) => {
    // PRE-LIVE: show only your own tiles
    const members = await VibeLive.getMembers();
    const self = members.find(m => m.id === VibeLive.memberId);
    if (self) {
        createVideoTile(self.id, self.displayName, 'camera', true);
        createVideoTile(self.id, self.displayName, 'screenshare', true);
        // screenshare tile starts hidden (Element-First Rule)
    }
});

VibeLive.on('localJoined', async () => {
    // Going LIVE: reveal remote members
    const members = await VibeLive.getMembers();
    members.forEach(m => {
        if (m.id === VibeLive.memberId) return;
        if (m.displayStatus === 'LIVE' || m.displayStatus === 'PRE-LIVE') {
            createVideoTile(m.id, m.displayName, 'camera', false);
        }
    });
});

VibeLive.on('localLeft', () => {
    // Back to PRE-LIVE: remove remote tiles for privacy
    document.querySelectorAll('.video-tile').forEach(tile => {
        if (tile.dataset.memberId !== VibeLive.memberId) {
            tile.remove();
        }
    });
});

VibeLive.on('remoteJoined', (memberId) => {
    if (!VibeLive.isLive) return;  // Don't show if we're not live
    const m = VibeLive.getMember(memberId);
    createVideoTile(memberId, m?.displayName || 'Unknown', 'camera', false);
});
```

> **Design choice: who gets a tile on `localJoined`?**
>
> The example above creates tiles for both `'LIVE'` and `'PRE-LIVE'` members when you go LIVE. This is the recommended default â€” you see everyone already in the channel, including those still preparing.
>
> You can restrict to `'LIVE'` only if your app only wants to show members who are actively streaming:
> ```javascript
> // Variation: streamers only
> if (m.displayStatus === 'LIVE') {
>     createVideoTile(m.id, m.displayName, 'camera', false);
> }
> ```
> The tradeoff:
> - **`'LIVE' || 'PRE-LIVE'`** â€” everyone present gets a tile immediately; good for small groups and social apps
> - **`'LIVE'` only** â€” tiles appear only when streaming starts; better for larger rooms or broadcast-style apps where PRE-LIVE presence is invisible by design
>
> Note: `remoteJoined` fires when a member goes LIVE (not when they enter PRE-LIVE), so it always represents a `'LIVE'` member â€” no filtering needed there.

```javascript

VibeLive.on('remoteStreamStart', (memberId, streamType) => {
    if (!VibeLive.isLive) return;  // Don't show if we're not live
    // ... attach stream (see Handling Remote Streams above)
});
```

---

## Member Info

```javascript
const member = VibeLive.getMember(memberId);
member.displayName     // "Alex"
member.displayStatus   // 'LIVE', 'PRE-LIVE', or 'EXITED'
member.hasCamera       // boolean
member.hasScreenshare  // boolean

// Fetch all current channel members from server
const members = await VibeLive.getMembers();
// â†’ [{ id, displayName, displayStatus, ... }]
```

Use `VibeLive.memberId` for your own member ID. Use `VibeLive.roomCode` for the shareable room code.

`memberUpdate` fires for ALL members including yourself. Always re-query `getMember(memberId)` inside the handler â€” the event is a signal that data changed, not a carrier of the new data:

```javascript
VibeLive.on('memberUpdate', (memberId) => {
    const member = VibeLive.getMember(memberId);  // re-query for fresh state
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
    <title>VibeLive Demo</title>
    <style>
        .video-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .video-tile { position: relative; width: 320px; height: 240px; background: #222; }
        .video-tile video { width: 100%; height: 100%; object-fit: cover; }
        .video-placeholder { position: absolute; inset: 0; display: flex;
            align-items: center; justify-content: center; color: white; font-size: 1.2em; }
        .hidden { display: none; }
        .visible { display: block; }
        /* Screenshare tiles are wider â€” style independently from camera grid */
        #screenshareGrid .video-tile { width: 100%; max-width: 800px; height: 450px; }
    </style>
</head>
<body>
    <h2>VibeLive</h2>

    <div id="entry">
        <input id="name" placeholder="Your name">
        <button id="createBtn">Create Room</button>
        <input id="code" placeholder="Room code">
        <button id="joinBtn">Join Room</button>
    </div>

    <div id="controls" style="display: none;">
        <span id="roomInfo"></span>
        <button onclick="VibeLive.startLive()">Go Live</button>
        <button onclick="VibeLive.stopLive()">Stop Live</button>
        <button onclick="VibeLive.toggleVideo()">Toggle Camera</button>
        <button onclick="VibeLive.toggleMuteAudio()">Mute/Unmute Mic</button>
    </div>

    <div id="screenshareGrid" class="video-grid"></div>
    <div id="cameraGrid" class="video-grid"></div>

    <script type="module">
        import VibeLive from 'https://makedo.com/sdk/vibelive-api.js';

        VibeLive.init({ contextId: 'vlp_Hsnz3HDI7gAA' });  // trial â€” contextId only, no token needed

        // --- Entry functions ---

        document.getElementById('createBtn').addEventListener('click', async () => {
            await VibeLive.signup(document.getElementById('name').value || 'Guest');
            const room = await VibeLive.createRoom('My Room');
            await VibeLive.enterByRoomCode(room.room_code);
        });

        document.getElementById('joinBtn').addEventListener('click', async () => {
            await VibeLive.signup(document.getElementById('name').value || 'Guest');
            await VibeLive.enterByRoomCode(document.getElementById('code').value);
        });

        // --- Events ---

        VibeLive.on('channelSelected', async (channel) => {
            document.getElementById('entry').style.display = 'none';
            document.getElementById('controls').style.display = 'block';
            document.getElementById('roomInfo').textContent = `Room: ${VibeLive.roomCode}`;

            // Create local tile (Element-First Rule)
            const self = (await VibeLive.getMembers()).find(m => m.id === VibeLive.memberId);
            if (self) {
                createVideoTile(self.id, self.displayName, 'camera', true);
                createVideoTile(self.id, self.displayName, 'screenshare', true);
            }

            // Start camera + mic for preview
            await VibeLive.toggleVideo();
            await VibeLive.toggleAudio();
        });

        VibeLive.on('localJoined', async () => {
            const members = await VibeLive.getMembers();
            members.forEach(m => {
                if (m.id !== VibeLive.memberId &&
                    (m.displayStatus === 'LIVE' || m.displayStatus === 'PRE-LIVE')) {
                    createVideoTile(m.id, m.displayName, 'camera', false);
                }
            });
        });

        VibeLive.on('remoteJoined', (id) => {
            if (!VibeLive.isLive) return;
            const m = VibeLive.getMember(id);
            createVideoTile(id, m?.displayName || 'Unknown', 'camera', false);
        });

        VibeLive.on('remoteStreamStart', (id, type) => {
            if (!VibeLive.isLive) return;
            const m = VibeLive.getMember(id);
            let tile = document.getElementById(`tile-${id}-${type}`);
            if (!tile) {
                createVideoTile(id, m?.displayName || 'Unknown', type, false);
                tile = document.getElementById(`tile-${id}-${type}`);
            }
            const video = tile?.querySelector('video');
            if (video) {
                video.classList.add('visible');
                tile.querySelector('.video-placeholder')?.classList.add('hidden');
                if (type === 'camera') VibeLive.setRemoteCamera(id, video);
                else VibeLive.setRemoteScreen(id, video);
            }
        });

        VibeLive.on('remoteStreamEnd', (id, type) => {
            const tile = document.getElementById(`tile-${id}-${type}`);
            if (!tile) return;
            if (type === 'screenshare') { tile.remove(); return; }
            tile.querySelector('video')?.classList.remove('visible');
            tile.querySelector('.video-placeholder')?.classList.remove('hidden');
        });

        VibeLive.on('localMediaChange', () => {
            const s = VibeLive.mediaState;
            const camTile = document.getElementById(`tile-${VibeLive.memberId}-camera`);
            if (camTile) {
                const v = camTile.querySelector('video');
                const p = camTile.querySelector('.video-placeholder');
                if (s.video) { p?.classList.add('hidden'); v?.classList.add('visible'); }
                else { p?.classList.remove('hidden'); v?.classList.remove('visible'); }
            }
            const screenTile = document.getElementById(`tile-${VibeLive.memberId}-screenshare`);
            if (screenTile) screenTile.style.display = VibeLive.screenState.video ? 'block' : 'none';
        });

        VibeLive.on('remoteLeft', (id) => {
            const m = VibeLive.getMember(id);
            if (m?.displayStatus === 'EXITED') {
                document.getElementById(`tile-${id}-camera`)?.remove();
                document.getElementById(`tile-${id}-screenshare`)?.remove();
            }
            // If PRE-LIVE, keep tiles â€” they stopped streaming but haven't left
        });

        VibeLive.on('error', (ctx, err) => console.error(`[${ctx}]`, err.message));

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
                    : 'ðŸ–¥ï¸ ' + (isLocal ? `${name}'s (You)` : name + "'s") + ' Screen'}</span></div>
                <video autoplay playsinline ${isLocal || streamType === 'screenshare' ? 'muted' : ''}></video>
            `;

            // Camera tiles go to cameraGrid; screenshare tiles go to screenshareGrid
            const targetGrid = streamType === 'screenshare'
                ? document.getElementById('screenshareGrid')
                : document.getElementById('cameraGrid');
            targetGrid.appendChild(tile);

            if (isLocal) {
                const video = tile.querySelector('video');
                if (streamType === 'camera') VibeLive.setLocalCamera(video);
                else VibeLive.setLocalScreen(video);
            }
        }
    </script>
</body>
</html>
```

---

## Going to Production

Trial contexts are designed for building and testing. They work with a `contextId` alone and impose automatic limits:

| Limit | Default |
|-------|---------|
| Active rooms at once | 3 |
| Participants per room | 3 |
| Session duration | 10 minutes |
| Post-session cooldown | 1 minute |

When you're ready to move beyond trial, you'll receive a **production context**. Production contexts have more lenient automatic limits but require an auth token to be attached to API requests. Because you should never expose a secret token in client-side code, VibeLive uses a **proxy pattern**:

1. You create a small server-side endpoint (any language/framework)
2. That endpoint forwards requests to the VibeLive server, adding your secret auth token as a header
3. You pass your endpoint's URL as `proxy` to `VibeLive.init()`

```js
// Trial (no token needed)
VibeLive.init({ contextId: 'YOUR_CONTEXT_ID' });

// Production (proxy adds the secret token server-side)
VibeLive.init({ contextId: 'YOUR_CONTEXT_ID', proxy: '/my-makedo-proxy' });
```

A minimal Express proxy looks like:

```js
app.post('/my-makedo-proxy', async (req, res) => {
    const response = await fetch('https://makedo.com/...', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Context-Auth-Token': process.env.MAKEDO_AUTH_TOKEN  // secret stays server-side
        },
        body: JSON.stringify(req.body)
    });
    res.json(await response.json());
});
```

---

## API Quick Reference

### Methods

| Method | Description |
|--------|-------------|
| `init({ contextId, proxy?, serverUrl? })` | Initialize VibeLive. Trial: `contextId` only. Production: add `proxy` URL. |
| `signup(name)` | Create anonymous guest session |
| `login(email, password)` | Login with existing account |
| `logout()` | Logout and cleanup |
| `createRoom(title)` | Create room, returns `{ id, room_code, title }` |
| `enterByRoomCode(code, displayName?)` | Enter room â†’ PRE-LIVE (displayName optional, updates member name) |
| `startLive()` | Connect WebRTC â†’ LIVE |
| `stopLive()` | Disconnect WebRTC â†’ PRE-LIVE |
| `exitRoom()` | Full teardown, release camera/mic â€” stay logged in |
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

1. **Not calling `init()` first** â€” Every method throws `"Call VibeLive.init() first"` without it.

2. **Not awaiting `signup()`** â€” Session and WebSocket won't be ready for subsequent calls.

3. **Forgetting `startLive()`** â€” `enterByRoomCode()` only puts you in PRE-LIVE. You must call `startLive()` to connect WebRTC and start sending/receiving media.

   PRE-LIVE is intentional, not just a waiting room. In PRE-LIVE, the local camera and mic work normally â€” you can call `toggleVideo()` and `toggleAudio()` and the user will see their own preview. Nothing is transmitted to others yet. This is the "green room": users adjust their setup privately before going live.

   Common mistakes stemming from misunderstanding PRE-LIVE:
   - Calling `startLive()` immediately inside `channelSelected` â€” this skips the green room and connects WebRTC before the user is ready.
   - Expecting remote tiles to appear in PRE-LIVE â€” remote streams don't arrive until you call `startLive()`.
   - Being surprised that `toggleVideo()` works in PRE-LIVE but nobody else can see you â€” correct behaviour, by design.

4. **Creating video elements too late (Element-First Rule)** â€” Register elements *before* streams arrive. If you create a `<video>` element in `localMediaChange`, the stream is already lost.

   **âš ï¸ CRITICAL for screenshare:** The screenshare `<video>` element must exist and be registered with `setLocalScreen()` BEFORE calling `toggleScreenshare()`. Create both camera and screenshare tiles in `channelSelected`, with the screenshare tile hidden (`display: none`).

5. **Not creating tiles on demand in `remoteStreamStart`** â€” Stream events can arrive before `remoteJoined`. Always check if the tile exists and create it if needed.

6. **Missing `playsInline` on video elements** â€” Required for iOS. Videos won't autoplay inline without it.

7. **Not muting your own `<video>` element** â€” Always set `muted = true` on local video elements to prevent audio feedback/echo.

8. **Not checking status in `remoteLeft`** â€” A member with `displayStatus === 'PRE-LIVE'` hasn't left; they may rejoin. Only remove tiles for `'EXITED'` members.

9. **Using `getMediaStates()` for local indicators** â€” Use `VibeLive.mediaState` for the local user. `getMediaStates(VibeLive.memberId)` reflects WebRTC state and is meaningless in PRE-LIVE.

10. **Confusing toggle vs mute** â€” Camera: use `toggleVideo()` (hardware on/off). Microphone: use `toggleMuteAudio()` after initial startup (instant mute/unmute).

11. **Removing and recreating tiles to move them** â€” Use `appendChild()` to move the existing element. Never `.remove()` then recreate â€” the stream attachment is lost.

12. **Ignoring self status changes in `memberUpdate`** â€” While you shouldn't create tiles for yourself, you MUST update your UI controls (Start/Stop Live buttons, status text) when `memberId === VibeLive.memberId`. Check `member.displayStatus` and update buttons BEFORE returning:
   ```javascript
   VibeLive.on('memberUpdate', (memberId) => {
       const member = VibeLive.getMember(memberId);
       if (memberId === VibeLive.memberId) {
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

## Using VibeLive with React

VibeLive works well with React. A few patterns to know:

### Stabilize ref callbacks with `useCallback`

VibeLive needs real DOM elements via `setLocalCamera()`, `setRemoteCamera()`, etc. In React, an inline ref callback creates a new function on every render, which causes React to tear down and re-fire the ref â€” re-registering the same element repeatedly. This can cause **video flicker**.

Wrap ref callbacks in `useCallback`:

```jsx
const videoRefCallback = useCallback((el) => {
    if (!el) return;
    if (tile.isLocal) VibeLive.setLocalCamera(el);
}, [tile.id, tile.isLocal, tile.streamType]);

<video ref={videoRefCallback} autoPlay playsInline muted />
```

### The Element-First Rule in React

The [Element-First Rule](#the-element-first-rule) requires local video elements to exist *before* streams are produced. In React, elements only exist after render â€” so if your component conditionally renders a tile based on state, the element won't be in the DOM when `toggleVideo()` runs.

Always include local tiles in the render output and hide with `style` instead of unmounting:

```jsx
// âœ… Always in DOM â€” ref fires on mount, element ready before toggleVideo()
const hideTile = tile.isLocal && !tile.showVideo;
<div style={hideTile ? { display: 'none' } : {}}>
    <video ref={videoRefCallback} ... />
</div>

// âŒ Element doesn't exist until showVideo is true â€” too late
{tile.showVideo && <div><video ref={videoRefCallback} ... /></div>}
```

### Register remote elements after render

When `remoteStreamStart` fires, you'll update state to add a tile â€” but React hasn't rendered yet, so the `<video>` element doesn't exist. Register remote elements in a `useEffect` that runs after the render completes:

```jsx
useEffect(() => {
    tiles.forEach(tile => {
        if (tile.isLocal || !tile.showVideo) return;
        const el = videoRefs.current[tile.id];
        if (!el) return;
        VibeLive.setRemoteCamera(tile.memberId, el);
    });
}, [tiles]);
```

> **Note:** The API includes same-element guards, so calling `setRemoteCamera()` with an already-registered element is harmless. You don't need to track registration state yourself.

---

*VibeLive API v1.0*