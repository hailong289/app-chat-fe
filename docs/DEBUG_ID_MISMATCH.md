# Debug ID Mismatch Issue

## Problem

IDs trả về từ server không khớp với IDs được gửi lên trong request.

## Debug Logs to Check

### 1. Check IDs before upload (Client)

```
📋 File IDs to upload: [
  { name: "file1.png", _id: "690b1db71f73400e53177480" },
  { name: "file2.png", _id: "690b1db71f73400e53177481" }
]
```

### 2. Check request payload (Service)

```
📤 Uploading file: {
  fileName: "file1.png",
  fileSize: 1595010,
  roomId: "019a258c095c000000eb3d",
  fileId: "690b1db71f73400e53177480"  ← ID sent to server
}
```

### 3. Check raw API response (Service)

```
📥 Raw API response: {
  message: "Tải file thành công",
  statusCode: 200,
  metadata: {
    _id: "690b1dba1f73400e53177486",  ← ID from server
    url: "https://...",
    kind: "image",
    name: "file1.png",
    ...
  }
}
```

### 4. Check ID consistency (Service)

```
🔍 Check ID consistency: {
  sentId: "690b1db71f73400e53177480",
  receivedId: "690b1dba1f73400e53177486",
  match: false  ← ❌ PROBLEM!
}
```

## Common Causes

### Cause 1: Backend không sử dụng `id` từ request

**Expected Backend Code:**

```javascript
// Backend PHẢI sử dụng id từ request
const fileId = req.body.id; // ← QUAN TRỌNG!

const file = await File.create({
  _id: fileId,  // ← Sử dụng ID từ client
  url: uploadedUrl,
  kind: fileKind,
  name: fileName,
  ...
});

res.json({
  message: "Tải file thành công",
  metadata: {
    _id: fileId,  // ← Trả về cùng ID
    url: uploadedUrl,
    ...
  }
});
```

**Wrong Backend Code:**

```javascript
// SAI: Backend tự generate ID mới
const file = await File.create({
  // _id không được chỉ định → MongoDB tự tạo ID mới
  url: uploadedUrl,
  kind: fileKind,
  name: fileName,
  ...
});

// Trả về ID khác với client gửi lên
res.json({
  metadata: {
    _id: file._id,  // ← ID mới, không khớp với request!
  }
});
```

### Cause 2: Request không gửi `id` parameter

**Check FormData in Network Tab:**

```
POST /api/filesystem/upload-single-user

FormData:
- file: (binary)
- roomId: "019a258c095c000000eb3d"
- id: "690b1db71f73400e53177480"  ← Phải có field này!
```

Nếu `id` field không có → Backend không nhận được ID → Tự tạo ID mới

### Cause 3: Backend validation reject `id`

Backend có thể validate `id` và reject nếu không hợp lệ:

```javascript
// Backend validation
if (!ObjectId.isValid(req.body.id)) {
  // Generate new ID nếu không hợp lệ
  fileId = new ObjectId().toString();
} else {
  fileId = req.body.id;
}
```

## Debugging Steps

### Step 1: Verify FormData

Open Browser DevTools → Network Tab → Find upload request → Check FormData:

```
file: (binary)
roomId: "019a258c095c000000eb3d"
id: "690b1db71f73400e53177480"  ← Must exist!
```

### Step 2: Check Backend Logs

Add logging on backend:

```javascript
app.post('/filesystem/upload-single-user', (req, res) => {
  console.log('📥 Received upload request:', {
    fileName: req.file?.originalname,
    roomId: req.body.roomId,
    requestedId: req.body.id,  // ← Log ID received
  });

  const fileId = req.body.id;  // Use ID from request

  console.log('💾 Creating file with ID:', fileId);

  const file = await File.create({
    _id: fileId,  // Use requested ID
    // ...
  });

  console.log('✅ File created:', {
    _id: file._id,
    matchesRequest: file._id === req.body.id,
  });

  res.json({
    metadata: {
      _id: file._id,  // Should match request
      // ...
    }
  });
});
```

### Step 3: Compare Logs

**Client Log:**

```
📤 Uploading file: { fileId: "690b1db71f73400e53177480" }
```

**Backend Log:**

```
📥 Received upload request: { requestedId: "690b1db71f73400e53177480" }
💾 Creating file with ID: "690b1db71f73400e53177480"
✅ File created: { _id: "690b1db71f73400e53177480", matchesRequest: true }
```

**Client Log:**

```
📥 Raw API response: { metadata: { _id: "690b1db71f73400e53177480" } }
🔍 Check ID consistency: { match: true }  ← ✅ CORRECT!
```

### Step 4: Check Database

Query database để verify:

```javascript
db.files.findOne({ _id: "690b1db71f73400e53177480" });
```

Nếu không tìm thấy → Backend không dùng ID từ request

## Fix Backend

### MongoDB (Mongoose)

```javascript
const fileSchema = new Schema(
  {
    _id: String, // ← Allow custom _id
    url: String,
    kind: String,
    name: String,
    // ...
  },
  { _id: false }
); // ← Disable auto _id generation

// Create with custom ID
const file = await File.create({
  _id: req.body.id, // ← Use ID from request
  url: uploadedUrl,
  kind: fileKind,
  name: fileName,
  size: fileSize,
  mimeType: fileMimeType,
  status: "uploaded",
  roomId: req.body.roomId,
});
```

### Prisma

```prisma
model File {
  id       String   @id  // ← Custom ID
  url      String
  kind     String
  name     String
  // ...
}
```

```javascript
const file = await prisma.file.create({
  data: {
    id: req.body.id, // ← Use ID from request
    url: uploadedUrl,
    kind: fileKind,
    name: fileName,
    // ...
  },
});
```

## Expected Flow

```
Client                          Server                    Database
------                          ------                    --------
1. Generate ID
   690b...480

2. Send request
   { id: "690b...480" }  →

3.                              Receive ID
                                690b...480

4.                              Create record        →    _id: 690b...480
                                                          url: https://...

5.                              Response
   ← { _id: "690b...480" }

6. Verify match
   ✅ 690b...480 === 690b...480
```

## Testing

### Test 1: Single File

```javascript
const fileId = new ObjectId().toHexString();
console.log("Generated ID:", fileId);

// Upload file
const result = await uploadFile(file, { id: fileId });
console.log("Returned ID:", result._id);
console.log("Match:", fileId === result._id); // Should be true
```

### Test 2: Multiple Files

```javascript
const files = [file1, file2, file3];
const ids = files.map(() => new ObjectId().toHexString());

console.log("Generated IDs:", ids);

const results = await uploadMultiple(files, { id: ids });

results.forEach((result, idx) => {
  console.log(`File ${idx}:`, {
    sent: ids[idx],
    received: result._id,
    match: ids[idx] === result._id,
  });
});
```

## Solution Checklist

- [ ] Client sends `id` in FormData
- [ ] Backend receives `id` from `req.body.id`
- [ ] Backend uses received `id` for file creation
- [ ] Backend returns same `id` in response
- [ ] Database has record with matching `_id`
- [ ] Client verifies `sentId === receivedId`

## Quick Fix Command

If you control the backend, update the upload handler:

```javascript
// OLD
const file = await File.create({ url, kind, name });

// NEW
const file = await File.create({
  _id: req.body.id, // ← Add this
  url,
  kind,
  name,
});
```
