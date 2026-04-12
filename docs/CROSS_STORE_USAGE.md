# Hướng dẫn gọi State giữa các Store

## 🎯 Tổng quan

Khi cần gọi các hàm từ store khác (ví dụ: gọi `useRoomStore` trong `useMessageStore`), Zustand cung cấp phương thức `getState()` để truy cập state và actions mà **không cần hooks**.

## ✨ Cách thực hiện

### 1. **Import Store cần sử dụng**

```typescript
import useRoomStore from "./useRoomStore";
```

### 2. **Sử dụng `getState()` để truy cập**

```typescript
const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      sendMessage: async (args: SendMessageArgs) => {
        // 🔥 Gọi useRoomStore
        const roomStore = useRoomStore.getState();
        
        // Gọi các hàm từ roomStore
        const room = await roomStore.getRoomById(args.roomId);
        const rooms = await roomStore.getRooms();
        roomStore.setType("private");
        
        // ... logic tiếp theo
      },
    }),
    { name: "message-storage" }
  )
);
```

## 📚 Ví dụ chi tiết

### Ví dụ 1: Lấy thông tin Room trước khi gửi Message

```typescript
sendMessage: async (args: SendMessageArgs) => {
  const { roomId, content } = args;
  
  // Lấy roomStore
  const roomStore = useRoomStore.getState();
  
  // Lấy thông tin room
  const room = await roomStore.getRoomById(roomId);
  
  if (!room) {
    console.error("Room not found!");
    return;
  }
  
  console.log("📍 Sending to room:", room.name);
  console.log("👥 Members:", room.members.length);
  
  // Gửi message...
}
```

### Ví dụ 2: Update Room sau khi gửi Message

```typescript
sendMessage: async (args: SendMessageArgs) => {
  const { roomId, content } = args;
  
  // Gửi message...
  socket?.emit("message:send", { roomId, content });
  
  // Update room store
  const roomStore = useRoomStore.getState();
  
  // Cập nhật last_message cho room
  roomStore.updateRoomSocket({
    ...roomStore.room,
    last_message: {
      id: messageId,
      content: content,
      createdAt: new Date().toISOString(),
      sender_fullname: userFullname,
      sender_id: userId,
    },
  });
}
```

### Ví dụ 3: Mark Room as Read khi đọc Message

```typescript
markMessageAsRead: async (roomId: string, messageId: string, socket: any) => {
  // Emit socket event
  socket?.emit("mark:read", { roomId, messageId });
  
  // Update room store
  const roomStore = useRoomStore.getState();
  roomStore.setRoomReaded({
    roomId,
    lastMessageId: messageId,
  });
  
  // Update local state
  get().setRoomReaded({ roomId, lastMessageId: messageId });
}
```

## 🔄 Sử dụng cả hai chiều

### MessageStore gọi RoomStore

```typescript
// trong useMessageStore.ts
import useRoomStore from "./useRoomStore";

const useMessageStore = create(() => ({
  sendMessage: async () => {
    const roomStore = useRoomStore.getState();
    await roomStore.getRoomById(roomId);
  },
}));
```

### RoomStore gọi MessageStore

```typescript
// trong useRoomStore.ts
import useMessageStore from "./useMessageStore";

const useRoomStore = create(() => ({
  deleteRoom: async (roomId: string) => {
    // Xóa room
    await deleteOne(db.rooms, roomId);
    
    // Xóa tất cả messages của room
    const messageStore = useMessageStore.getState();
    // Có thể thêm hàm clearMessagesByRoomId vào MessageState
  },
}));
```

## ⚠️ Lưu ý quan trọng

### 1. **Không dùng hooks trong Store**

❌ **SAI:**
```typescript
const useMessageStore = create(() => ({
  sendMessage: () => {
    const roomStore = useRoomStore(); // ❌ Lỗi: Invalid hook call
  },
}));
```

✅ **ĐÚNG:**
```typescript
const useMessageStore = create(() => ({
  sendMessage: () => {
    const roomStore = useRoomStore.getState(); // ✅ OK
  },
}));
```

### 2. **Tránh Circular Dependency**

Nếu A import B và B import A → circular dependency!

**Giải pháp:**
- Tách logic chung ra file riêng
- Hoặc chỉ import một chiều (A → B, không B → A)

### 3. **Type Safety**

```typescript
// Đảm bảo type chính xác
const roomStore = useRoomStore.getState();
const room: roomType | undefined = await roomStore.getRoomById(roomId);

if (!room) {
  throw new Error("Room not found");
}
```

## 🎨 Pattern khuyên dùng

### Pattern 1: Helper Functions

```typescript
// utils/store-helpers.ts
export const getRoomInfo = async (roomId: string) => {
  const roomStore = useRoomStore.getState();
  return await roomStore.getRoomById(roomId);
};

export const updateRoomLastMessage = (roomId: string, message: MessageType) => {
  const roomStore = useRoomStore.getState();
  roomStore.updateRoomSocket({
    ...roomStore.room,
    last_message: {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      sender_fullname: message.sender.fullname,
      sender_id: message.sender._id,
    },
  });
};
```

Sử dụng:
```typescript
import { getRoomInfo, updateRoomLastMessage } from "@/utils/store-helpers";

sendMessage: async (args) => {
  const room = await getRoomInfo(args.roomId);
  // ... send message
  updateRoomLastMessage(args.roomId, newMessage);
}
```

### Pattern 2: Computed Values

```typescript
const useMessageStore = create(() => ({
  getRoomWithMessages: async (roomId: string) => {
    const roomStore = useRoomStore.getState();
    const messageStore = useMessageStore.getState();
    
    const [room, messages] = await Promise.all([
      roomStore.getRoomById(roomId),
      messageStore.getMessageByRoomId(roomId),
    ]);
    
    return { room, messages };
  },
}));
```

## 📊 Real-world Example: Complete Flow

```typescript
const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      sendMessage: async (args: SendMessageArgs) => {
        const { roomId, content, socket } = args;
        
        // 1️⃣ Lấy thông tin room
        const roomStore = useRoomStore.getState();
        const room = await roomStore.getRoomById(roomId);
        
        if (!room) {
          console.error("❌ Room not found!");
          return;
        }
        
        console.log(`📤 Sending to: ${room.name}`);
        
        // 2️⃣ Tạo message
        const messageId = new ObjectId().toHexString();
        const newMessage: MessageType = {
          id: messageId,
          roomId,
          content,
          createdAt: new Date().toISOString(),
          status: "pending",
          // ... other fields
        };
        
        // 3️⃣ Update local message state
        set({
          messagesRoom: {
            ...get().messagesRoom,
            [roomId]: {
              ...get().messagesRoom[roomId],
              messages: [
                ...(get().messagesRoom[roomId]?.messages || []),
                newMessage,
              ],
            },
          },
        });
        
        // 4️⃣ Emit socket
        socket?.emit("message:send", { roomId, content, id: messageId });
        
        // 5️⃣ Update room's last message
        roomStore.updateRoomSocket({
          ...room,
          last_message: {
            id: messageId,
            content,
            createdAt: newMessage.createdAt,
            sender_fullname: args.userFullname || "",
            sender_id: args.userId || "",
          },
          updatedAt: new Date().toISOString(),
        });
        
        // 6️⃣ Refresh rooms list to show latest message
        await roomStore.getRoomsByType(roomStore.type);
      },
    }),
    { name: "message-storage" }
  )
);
```

## 🚀 Performance Tips

1. **Chỉ gọi khi cần thiết**: Không gọi `getState()` trong mỗi render
2. **Cache kết quả**: Lưu kết quả nếu cần dùng nhiều lần
3. **Batch updates**: Gom nhiều updates thành một lần set()
4. **Async properly**: Dùng Promise.all() cho multiple async calls

## 📝 Checklist

- ✅ Import store cần dùng
- ✅ Sử dụng `getState()` thay vì hook
- ✅ Kiểm tra circular dependency
- ✅ Type check kỹ càng
- ✅ Handle null/undefined cases
- ✅ Test thoroughly

## 🔗 References

- [Zustand Docs - Accessing state outside of components](https://github.com/pmndrs/zustand#accessing-state-outside-of-components)
- [Zustand Best Practices](https://github.com/pmndrs/zustand/wiki/Best-Practices)
