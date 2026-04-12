## Quick Start Guide: Using Unified Signal

### Backend Setup ✅

Already configured! The `UnifiedSignalHandler` is injected into `CallGateway`.

### Frontend Setup

#### 1. Initialize SignalManager

```typescript
// In your call component or hook
import { SignalManager } from "@/lib/signal-manager";
import { useEffect, useRef } from "react";

const MyCallComponent = () => {
  const signalManagerRef = useRef<SignalManager | null>(null);

  useEffect(() => {
    if (socket) {
      signalManagerRef.current = new SignalManager(socket);

      // Register handlers
      setupSignalHandlers(signalManagerRef.current);
    }

    return () => {
      signalManagerRef.current?.destroy();
    };
  }, [socket]);
};
```

#### 2. Register Signal Handlers

```typescript
function setupSignalHandlers(manager: SignalManager) {
  // P2P Handlers
  manager.on("p2p:offer", (data) => {
    console.log("Received P2P offer from", data.sender);
    // Handle WebRTC offer
    handleP2POffer(data.sender, data.sdp);
  });

  manager.on("p2p:answer", (data) => {
    console.log("Received P2P answer from", data.sender);
    // Handle WebRTC answer
    handleP2PAnswer(data.sender, data.sdp);
  });

  manager.on("p2p:candidate", (data) => {
    console.log("Received ICE candidate from", data.sender);
    // Handle ICE candidate
    handleP2PCandidate(data.sender, data.candidate);
  });

  // SFU Handlers
  manager.on("sfu:join", (data) => {
    if (data.ok) {
      console.log("Joined SFU room, capabilities:", data.rtpCapabilities);
      // Initialize SFU client with RTP capabilities
      initializeSFUClient(data.rtpCapabilities);
    }
  });

  manager.on("sfu:createTransport", (data) => {
    if (data.ok) {
      console.log("Transport created:", data.transportId);
      // Create local transport
      createLocalTransport(data);
    }
  });

  manager.on("sfu:produce", (data) => {
    if (data.ok) {
      console.log("Producer created:", data.producerId);
      // Track producer ID
      setProducerId(data.producerId);
    } else if (data.target === "broadcast") {
      console.log("New producer from user:", data.userId);
      // Start consuming from new producer
      startConsuming(data.producerId);
    }
  });

  manager.on("sfu:consume", (data) => {
    if (data.ok) {
      console.log("Consumer created:", data.consumerId);
      // Create consumer and play media
      createConsumer(data);
    }
  });
}
```

#### 3. Send Signals

```typescript
// P2P: Send offer to specific user
signalManager.send({
  roomId: "room-123",
  type: "offer",
  target: "user-456", // userId
  sdp: myOffer,
});

// P2P: Send answer
signalManager.send({
  roomId: "room-123",
  type: "answer",
  target: "user-456",
  sdp: myAnswer,
});

// P2P: Send ICE candidate
signalManager.send({
  roomId: "room-123",
  type: "candidate",
  target: "user-456",
  candidate: iceCandidate,
});

// SFU: Join room
signalManager.send({
  roomId: "room-123",
  type: "join",
  target: "sfu",
});

// SFU: Create transport
signalManager.send({
  roomId: "room-123",
  type: "createTransport",
  target: "sfu",
  direction: "send", // or 'recv'
});

// SFU: Connect transport
signalManager.send({
  roomId: "room-123",
  type: "connectTransport",
  target: "sfu",
  transportId: "transport-123",
  dtlsParameters: dtlsParams,
});

// SFU: Start producing
signalManager.send({
  roomId: "room-123",
  type: "produce",
  target: "sfu",
  transportId: "transport-123",
  kind: "video", // or 'audio'
  rtpParameters: rtpParams,
});

// SFU: Start consuming
signalManager.send({
  roomId: "room-123",
  type: "consume",
  target: "sfu",
  transportId: "transport-123",
  producerId: "producer-456",
  rtpCapabilities: myCapabilities,
});
```

### Complete Example

```typescript
import { SignalManager } from '@/lib/signal-manager';
import { useEffect, useRef, useState } from 'react';

export function useCallSignaling(socket: Socket | null, roomId: string) {
  const signalManagerRef = useRef<SignalManager | null>(null);
  const [rtpCapabilities, setRtpCapabilities] = useState<any>(null);
  const [transportId, setTransportId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const manager = new SignalManager(socket);
    signalManagerRef.current = manager;

    // Register all handlers
    manager.on('sfu:join', (data) => {
      if (data.ok) {
        setRtpCapabilities(data.rtpCapabilities);
        // Next: create send transport
        manager.send({
          roomId,
          type: 'createTransport',
          target: 'sfu',
          direction: 'send',
        });
      }
    });

    manager.on('sfu:createTransport', (data) => {
      if (data.ok) {
        setTransportId(data.transportId);
        // Connect transport with DTLS params
        // ... (get DTLS from local transport)
        manager.send({
          roomId,
          type: 'connectTransport',
          target: 'sfu',
          transportId: data.transportId,
          dtlsParameters: /* ... */,
        });
      }
    });

    // ... more handlers

    return () => manager.destroy();
  }, [socket, roomId]);

  const joinSFU = () => {
    signalManagerRef.current?.send({
      roomId,
      type: 'join',
      target: 'sfu',
    });
  };

  return { joinSFU, rtpCapabilities, transportId };
}
```

---

## Migration from Old Events

### Before (Old Style)

```typescript
// Multiple different events
socket.emit('call:offer', { ... });
socket.emit('call:answer', { ... });
socket.emit('sfu:join', { ... });
socket.emit('sfu:produce', { ... });

socket.on('call:offer', handler);
socket.on('call:answer', handler);
socket.on('sfu:newProducer', handler);
```

### After (Unified Style)

```typescript
// One event, route via target
signalManager.send({
  type: "offer",
  target: "user-123", // or 'sfu'
  // ... data
});

// One listener, auto-routed by sender
manager.on("p2p:offer", handler); // From peer
manager.on("sfu:join", handler); // From server
```

---

## Testing

```bash
# Backend
cd app-nest-be
yarn start:dev socket

# Frontend
cd app-chat-fe
yarn dev

# Test P2P call (1-on-1)
# 1. Open two browser windows
# 2. Login as different users
# 3. Start a call
# 4. Check console for "p2p:offer", "p2p:answer" logs

# Test SFU call (group)
# 1. Create a group chat
# 2. Start a call
# 3. Check console for "sfu:join", "sfu:produce" logs
```
