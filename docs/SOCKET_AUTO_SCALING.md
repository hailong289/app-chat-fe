# Socket.IO Auto Scaling Configuration Guide

## 📋 Overview

Tài liệu này hướng dẫn cấu hình Socket.IO server để hỗ trợ Auto Scaling với multiple instances.

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Load Balancer  │ (Nginx/ALB/CloudFlare)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│Server 1│ │Server 2│ ... (Auto Scaling)
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         ▼
    ┌─────────┐
    │  Redis  │ (Socket.IO Adapter)
    └─────────┘
```

## 🔧 Backend Configuration

### 1. Install Dependencies

```bash
npm install socket.io socket.io-redis @socket.io/redis-adapter redis
# hoặc
yarn add socket.io socket.io-redis @socket.io/redis-adapter redis
```

### 2. Socket.IO Server Setup (Node.js/Express)

```javascript
// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const app = express();
const server = http.createServer(app);

// Redis clients for Socket.IO adapter
const pubClient = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});
const subClient = pubClient.duplicate();

// Initialize Socket.IO with Redis adapter
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
  // Quan trọng cho Auto Scaling
  adapter: createAdapter(pubClient, subClient),
  // Transports
  transports: ['websocket', 'polling'],
  // Connection settings
  pingInterval: 25000,
  pingTimeout: 60000,
  // Sticky session không bắt buộc khi dùng Redis adapter
  allowEIO3: true,
});

// Connect Redis
Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  console.log('✅ Redis adapter connected');
});

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Verify JWT token
    const decoded = await verifyToken(token);
    socket.userId = decoded.userId;
    socket.user = decoded;
    
    // Log connection với server instance ID
    console.log(`✅ User ${decoded.userId} connected to server ${process.env.INSTANCE_ID || 'unknown'}`);
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Connection handler
io.on('connection', (socket) => {
  const userId = socket.userId;
  
  // Join user-specific room (works across instances with Redis)
  socket.join(`user:${userId}`);
  
  // Handle client info
  socket.on('client:info', (data) => {
    console.log('📱 Client info:', data);
    // Store client info if needed
  });
  
  // Example: Send message to specific user (works across instances)
  socket.on('message:send', async (data) => {
    const { recipientId, content } = data;
    
    // Emit to recipient (Redis will route to correct instance)
    io.to(`user:${recipientId}`).emit('message:new', {
      senderId: userId,
      content,
      timestamp: Date.now(),
    });
  });
  
  // Graceful disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User ${userId} disconnected. Reason: ${reason}`);
  });
});

// Health check endpoint (for load balancer)
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'OK',
    instance: process.env.INSTANCE_ID || 'unknown',
    connections: io.engine.clientsCount,
  };
  res.status(200).json(health);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, closing server gracefully...');
  
  // Notify clients about server shutdown
  io.emit('server:maintenance', { 
    message: 'Server is shutting down for maintenance',
    reconnect: true,
  });
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    pubClient.quit();
    subClient.quit();
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
  console.log(`📊 Instance ID: ${process.env.INSTANCE_ID || 'unknown'}`);
});
```

### 3. Redis Configuration

```bash
# Redis URL format
REDIS_URL=redis://username:password@host:port/database

# Examples:
# Local: redis://localhost:6379
# AWS ElastiCache: redis://my-cluster.xxxxx.cache.amazonaws.com:6379
# Redis Cloud: redis://default:password@redis-12345.cloud.redislabs.com:12345
```

## 🔀 Load Balancer Configuration

### Nginx (Sticky Session với IP Hash)

```nginx
upstream socket_backend {
    ip_hash;  # Sticky session based on client IP
    server server1.example.com:5000;
    server server2.example.com:5000;
    server server3.example.com:5000;
}

server {
    listen 80;
    server_name socket.example.com;
    
    location / {
        proxy_pass http://socket_backend;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer
        proxy_buffering off;
    }
    
    # Health check
    location /health {
        proxy_pass http://socket_backend/health;
    }
}
```

### AWS Application Load Balancer (ALB)

```yaml
# Target Group Settings:
- Protocol: HTTP
- Port: 5000
- Health Check Path: /health
- Health Check Interval: 30 seconds
- Stickiness: 
    - Type: Application-based cookie
    - Cookie name: AWSALB
    - Duration: 1 day

# Listener Rules:
- Protocol: HTTPS
- Port: 443
- SSL Certificate: Your SSL cert
- Default Action: Forward to target group
```

### Docker Compose (Development/Testing)

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    
  socket-server-1:
    build: .
    ports:
      - "5001:5000"
    environment:
      - PORT=5000
      - REDIS_URL=redis://redis:6379
      - INSTANCE_ID=server-1
      - NODE_ENV=production
    depends_on:
      - redis
      
  socket-server-2:
    build: .
    ports:
      - "5002:5000"
    environment:
      - PORT=5000
      - REDIS_URL=redis://redis:6379
      - INSTANCE_ID=server-2
      - NODE_ENV=production
    depends_on:
      - redis
      
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - socket-server-1
      - socket-server-2

volumes:
  redis_data:
```

## 🚀 Deployment Checklist

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=production
INSTANCE_ID=server-1  # Unique per instance

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key

# Client
CLIENT_URL=https://your-app.com

# Monitoring (optional)
SENTRY_DSN=https://...
NEW_RELIC_LICENSE_KEY=...
```

### Pre-deployment Steps

- [ ] Cài đặt và cấu hình Redis
- [ ] Test Redis connection từ mỗi server instance
- [ ] Cấu hình Load Balancer với sticky session hoặc Redis adapter
- [ ] Setup health check endpoints
- [ ] Cấu hình auto scaling rules (CPU/Memory thresholds)
- [ ] Setup monitoring & alerting
- [ ] Test failover scenario
- [ ] Configure graceful shutdown

## 📊 Monitoring

### Key Metrics to Monitor

```javascript
// Add monitoring endpoint
app.get('/metrics', (req, res) => {
  res.json({
    instance: process.env.INSTANCE_ID,
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  });
});
```

### Recommended Tools

- **Socket.IO Admin UI**: https://socket.io/docs/v4/admin-ui/
- **PM2**: Process management và monitoring
- **New Relic / DataDog**: APM monitoring
- **CloudWatch / Grafana**: Metrics visualization

## 🧪 Testing Auto Scaling

```javascript
// test-scaling.js
const io = require('socket.io-client');

// Connect 1000 clients
const sockets = [];
for (let i = 0; i < 1000; i++) {
  const socket = io('http://localhost:80', {
    auth: { token: 'test-token' },
  });
  
  socket.on('connect', () => {
    console.log(`Client ${i} connected:`, socket.id);
  });
  
  sockets.push(socket);
}

// Send message from random client
setInterval(() => {
  const randomSocket = sockets[Math.floor(Math.random() * sockets.length)];
  randomSocket.emit('message:send', { content: 'Test message' });
}, 1000);
```

## 🔐 Security Best Practices

1. **Authentication**: Always verify JWT tokens
2. **Rate Limiting**: Implement per-user rate limits
3. **CORS**: Configure proper CORS origins
4. **SSL/TLS**: Use HTTPS in production
5. **Redis Security**: Enable Redis AUTH and use SSL
6. **Namespace Isolation**: Use Socket.IO namespaces for different features

## 📚 References

- Socket.IO Docs: https://socket.io/docs/v4/
- Redis Adapter: https://socket.io/docs/v4/redis-adapter/
- Nginx WebSocket: https://nginx.org/en/docs/http/websocket.html
- AWS ALB WebSocket: https://aws.amazon.com/blogs/aws/new-aws-application-load-balancer/

---

Created by: Your Team
Last Updated: November 2025
