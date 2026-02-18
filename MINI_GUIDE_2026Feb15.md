# MiniChat API Guide

**Build an anonymous video chat app with MiniChat**

Version 0.6 | February 15, 2026

---

## Setup

Import and initialize MiniChat:

```html
<script type="module">
    import MiniChat from 'https://proto2.makedo.com:8883/v05/scripts/makedo-vibelive.min.js';

    MiniChat.init({
        contextId: 'YOUR_CONTEXT_ID',
        contextAuthToken: 'YOUR_CONTEXT_TOKEN'
    });

    // Wire up events...
    MiniChat.on('channelSelected', (channel) => { /* ... */ });
    MiniChat.on('remoteStreamStart', (memberId, streamType) => { /* ... */ });
</script>

<!-- onclick handlers just work â€” no window.xxx workaround needed -->
<button onclick="MiniChat.signup('Alex')">Join</button>
<button onclick="MiniChat.startLive()">Go Live</button>
```

> **ðŸ§ª Test Credentials**: Use `contextId: 'Kw6w6w6w6w'` and `contextAuthToken: 'qftRdeQ12ZcrKYixauWpxGiB'` for quick testing.

`MiniChat` is automatically available on `window` â€” all methods work directly in `onclick` handlers without any extra wiring.

---

## User Flow

Anonymous users have two paths â€” **create** or **join** a room:

```
signup(name) â†’ createRoom(title) â†’ enterByRoomCode(code) â†’ startLive()
signup(name) â†’ enterByRoomCode(code) â†’ startLive()
```

### Create a Room

```javascript
await MiniChat.signup('Alex');
const room = await MiniChat.createRoom("Alex's Room");
// room.room_code is the shareable code (e.g., "X7kQ3m")
await MiniChat.enterByRoomCode(room.room_code);
// Now in PRE-LIVE â€” call startLive() when ready
```

### Join a Room

```javascript
await MiniChat.signup('Jordan');
await MiniChat.enterByRoomCode('X7kQ3m');
// Now in PRE-LIVE â€” call startLive() when ready
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
- `exitRoom()` â€” Full teardown, release camera/mic

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
// On room entry: start both
await MiniChat.startLive();

// User clicks mic button (during call)
MiniChat.toggleMuteAudio();  // Mute/unmute â€” instant, no hardware restart

// User clicks camera button (during call)
MiniChat.toggleVideo();      // Stop/start â€” hardware light on/off
```

Use `toggleMuteVideo()` only for specialized cases (e.g., "hide self while fixing appearance" but keep capturing).

### Screenshare

Screen sharing is typically offered in **LIVE mode only**. In both cases, follow the Element-First Rule: create and register the screenshare tile in `channelSelected` (hidden with `display: none`).

### Reading Local Media State

```javascript
MiniChat.mediaState
// â†’ { audio: true/false, video: true/false, audioMuted: true/false, videoMuted: true/false }

MiniChat.screenState
// â†’ { video: true/false, videoMuted: true/false }
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
| `MiniChat.mediaState` | **Hardware state** â€” is the camera/mic capturing? | Local user's indicators |
| `MiniChat.getMediaStates(id)` | **WebRTC state** â€” what's being transmitted? | Remote member indicators |

In **PRE-LIVE**, the local camera can be on (for preview) but nothing is transmitted. This is correct â€” the local indicator reflects what the user cares about: *"Is my camera on?"*

In **LIVE**, the two states naturally align. No special synchronization logic is needed.

**Always use `MiniChat.mediaState` for the local user's indicators** â€” never `MiniChat.getMediaStates(MiniChat.memberId)`, which reflects WebRTC state and won't be meaningful in PRE-LIVE.

---

## The Element-First Rule

> **Register video elements before streams arrive, not in response to them.**

When MiniChat creates a media stream, it immediately attaches to whatever `<video>` element you've registered. No element registered = stream silently lost.

| Media Type | When to Register | Why |
|---|---|---|
| **Local camera** | At tile creation time | `toggleVideo()` attaches immediately |
| **Local screenshare** | At tile creation time (hidden) | `toggleScreenshare()` attaches immediately |
| **Remote camera** | Inside `remoteStreamStart` handler | Stream is arriving *right now* |
| **Remote screenshare** | Inside `remoteStreamStart` handler | Stream is arriving *right now* |

```javascript
// âœ… Register both local elements at tile creation
MiniChat.setLocalCamera(cameraVideoEl);
MiniChat.setLocalScreen(screenVideoEl);

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

    // Video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';

    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    if (streamType === 'camera') {
        placeholder.innerHTML = `<span>${isLocal ? 'You' : name}</span>`;
    } else {
        placeholder.innerHTML = `<span>ðŸ–¥ï¸ ${isLocal ? 'Your' : name + "'s"} Screen</span>`;
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
            <span class="member-name">${isLocal ? 'You' : name}</span>
            <div class="member-indicators">
                <span class="status-badge"></span>
                <span class="indicator cam-video" title="Camera">ðŸ“¹</span>
                <span class="indicator cam-audio" title="Microphone">ðŸŽ¤</span>
            </div>
        `;
    } else {
        memberInfo.innerHTML = `
            <span class="member-name">ðŸ–¥ï¸ ${isLocal ? 'Your' : name + "'s"} Screen</span>
        `;
    }

    tile.appendChild(videoContainer);
    tile.appendChild(memberInfo);
    document.getElementById('videoGrid').appendChild(tile);

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
- Each tile is independent â€” camera and screenshare are separate grid items
- `data-member-id` and `data-stream-type` attributes enable CSS targeting
- CSS example: `.video-tile[data-stream-type="screenshare"] { grid-column: span 2; }`
- `playsInline` is required for iOS
- `muted = true` on local video prevents audio feedback

---

## Moving Video Tiles (Preview Areas, Featured Views)

When implementing preview modes or featured speaker layouts, **always move the existing DOM element** â€” never remove and recreate.

### âœ… The Safe Way: appendChild()

```javascript
// Move to preview area (PRE-LIVE)
const tile = document.getElementById(`tile-${MiniChat.memberId}-camera`);
document.getElementById('previewArea').appendChild(tile);

// Move back to main grid (LIVE)
document.getElementById('videoGrid').appendChild(tile);
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

> **âš ï¸ Always create tiles on demand in `remoteStreamStart`.**
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
    if (m?.displayStatus === 'INACTIVE') {
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
// â†’ [{ id, displayName, displayStatus, ... }]
```

Use `MiniChat.memberId` for your own member ID. Use `MiniChat.roomCode` for the shareable room code.

`memberUpdate` fires for ALL members including yourself â€” useful for updating status badges.

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

    <div id="videoGrid" class="video-grid"></div>

    <script type="module">
        import MiniChat from 'https://proto2.makedo.com:8883/v05/scripts/makedo-vibelive.min.js';

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
                if (m.id !== MiniChat.memberId && m.displayStatus === 'ACTIVE') {
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
            if (m?.displayStatus === 'INACTIVE') {
                document.getElementById(`tile-${id}-camera`)?.remove();
                document.getElementById(`tile-${id}-screenshare`)?.remove();
            }
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
                <div class="video-placeholder"><span>${streamType === 'camera'
                    ? (isLocal ? 'You' : name)
                    : 'ðŸ–¥ï¸ ' + (isLocal ? 'Your' : name + "'s") + ' Screen'}</span></div>
                <video autoplay playsinline ${isLocal || streamType === 'screenshare' ? 'muted' : ''}></video>
            `;

            document.getElementById('videoGrid').appendChild(tile);

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
| `enterByRoomCode(code, displayName?)` | Enter room â†’ PRE-LIVE (displayName optional, updates member name) |
| `startLive()` | Connect WebRTC â†’ LIVE |
| `stopLive()` | Disconnect WebRTC â†’ PRE-LIVE |
| `exitRoom()` | Full teardown, release camera |
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
| `channel` | Object | Current channel |
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
| `channelSelected` | `(channel)` | Entered a room (PRE-LIVE) |
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

1. **Not calling `init()` first** â€” Every method throws `"Call MiniChat.init() first"` without it.

2. **Not awaiting `signup()`** â€” Session and WebSocket won't be ready for subsequent calls.

3. **Forgetting `startLive()`** â€” `enterByRoomCode()` only puts you in PRE-LIVE. You must call `startLive()` to connect WebRTC and start sending/receiving media.

4. **Creating video elements too late (Element-First Rule)** â€” Register elements *before* streams arrive. If you create a `<video>` element in `localMediaChange`, the stream is already lost.

   **âš ï¸ CRITICAL for screenshare:** The screenshare `<video>` element must exist and be registered with `setLocalScreen()` BEFORE calling `toggleScreenshare()`. Create both camera and screenshare tiles in `channelSelected`, with the screenshare tile hidden (`display: none`).

5. **Not creating tiles on demand in `remoteStreamStart`** â€” Stream events can arrive before `remoteJoined`. Always check if the tile exists and create it if needed.

6. **Missing `playsInline` on video elements** â€” Required for iOS. Videos won't autoplay inline without it.

7. **Not muting your own `<video>` element** â€” Always set `muted = true` on local video elements to prevent audio feedback/echo.

8. **Not checking status in `remoteLeft`** â€” A member with `displayStatus === 'PRE-LIVE'` hasn't left; they may rejoin. Only remove tiles for `'INACTIVE'` members.

9. **Using `getMediaStates()` for local indicators** â€” Use `MiniChat.mediaState` for the local user. `getMediaStates(MiniChat.memberId)` reflects WebRTC state and is meaningless in PRE-LIVE.

10. **Confusing toggle vs mute** â€” Camera: use `toggleVideo()` (hardware on/off). Microphone: use `toggleMuteAudio()` after initial startup (instant mute/unmute).

11. **Removing and recreating tiles to move them** â€” Use `appendChild()` to move the existing element. Never `.remove()` then recreate â€” the stream attachment is lost.

12. **Ignoring self status changes in `memberUpdate`** â€” While you shouldn't create tiles for yourself, you MUST update your UI controls (Start/Stop Live buttons, status text) when `memberId === MiniChat.memberId`. Check `member.displayStatus` and update buttons BEFORE returning:
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

*MiniChat API v1.0 â€” Facade over MiniChatCore. For advanced use, access `MiniChat.core` for the full MiniChatCore API.*