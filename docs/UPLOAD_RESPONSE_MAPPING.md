# Upload Response Mapping Test

## API Response Example

```json
{
  "message": "Tải file thành công",
  "statusCode": 200,
  "reasonStatusCode": "OK",
  "metadata": {
    "_id": "690b1dba1f73400e53177486",
    "url": "https://s3.us-east-005.backblazeb2.com/app-chat-public/019a258a9540000000ff11.019a258c095c000000eb3d/geminigeneratedimagenzcwxunzcwxunzcw_1762336187076.png",
    "kind": "image",
    "name": "Gemini_Generated_Image_nzcwxunzcwxunzcw.png",
    "size": { "low": 1467707, "high": 0, "unsigned": false },
    "mimeType": "image/png",
    "status": "uploaded"
  }
}
```

## Transformed Result

```typescript
{
  "_id": "690b1dba1f73400e53177486",
  "url": "https://s3.us-east-005.backblazeb2.com/...",
  "kind": "image",
  "name": "Gemini_Generated_Image_nzcwxunzcwxunzcw.png",
  "size": 1467707,           // ← Converted from MongoDB Long
  "mimeType": "image/png",
  "status": "uploaded"
}
```

## Field Mapping

| API Field           | Type        | Transformed Field | Type   | Notes                                 |
| ------------------- | ----------- | ----------------- | ------ | ------------------------------------- |
| `metadata._id`      | string      | `_id`             | string | ID giữ nguyên                         |
| `metadata.url`      | string      | `url`             | string | S3 URL                                |
| `metadata.kind`     | string      | `kind`            | string | "image", "video", "audio", "document" |
| `metadata.name`     | string      | `name`            | string | Tên file gốc                          |
| `metadata.size`     | Long/number | `size`            | number | Convert MongoDB Long → number         |
| `metadata.mimeType` | string      | `mimeType`        | string | "image/png", "video/mp4", etc         |
| `metadata.status`   | string      | `status`          | string | "uploaded"                            |

## MongoDB Long Type Handling

**Input (MongoDB Long):**

```javascript
{
  low: 1467707,
  high: 0,
  unsigned: false
}
```

**Output (JavaScript number):**

```javascript
1467707;
```

**Implementation:**

```typescript
let size: number | undefined;
if (metadata.size) {
  if (typeof metadata.size === "number") {
    size = metadata.size;
  } else if (typeof metadata.size === "object" && "low" in metadata.size) {
    // MongoDB Long type
    size = metadata.size.low;
  }
}
```

## Multiple Files Upload Result

**API Responses (4 files):**

```javascript
// File 1 response
{ metadata: { _id: "690b1db71f73400e53177480", url: "...", size: { low: 1595010 }, ... } }

// File 2 response
{ metadata: { _id: "690b1db71f73400e53177481", url: "...", size: { low: 1467707 }, ... } }

// File 3 response
{ metadata: { _id: "690b1db71f73400e53177482", url: "...", size: { low: 1516650 }, ... } }

// File 4 response
{ metadata: { _id: "690b1db71f73400e53177483", url: "...", size: { low: 1548785 }, ... } }
```

**Transformed Array:**

```javascript
[
  {
    _id: "690b1db71f73400e53177480",
    kind: "photo",
    name: "Gemini_Generated_Image_4qc7rf4qc7rf4qc7.png",
    size: 1595010,
    mimeType: "image/png",
    status: "uploaded",
    uploadProgress: 100,
  },
  {
    _id: "690b1db71f73400e53177481",
    kind: "photo",
    name: "Gemini_Generated_Image_nzcwxunzcwxunzcw.png",
    size: 1467707,
    mimeType: "image/png",
    status: "uploaded",
    uploadProgress: 100,
  },
  {
    _id: "690b1db71f73400e53177482",
    kind: "photo",
    name: "Gemini_Generated_Image_evj33pevj33pevj3.png",
    size: 1516650,
    mimeType: "image/png",
    status: "uploaded",
    uploadProgress: 100,
  },
  {
    _id: "690b1db71f73400e53177483",
    kind: "photo",
    name: "Gemini_Generated_Image_o1cf3yo1cf3yo1cf.png",
    size: 1548785,
    mimeType: "image/png",
    status: "uploaded",
    uploadProgress: 100,
  },
];
```

## Console Logs Expected

```
🚀 Starting upload for 4 files
📋 File IDs to upload: [
  { name: "Gemini_Generated_Image_4qc7rf4qc7rf4qc7.png", _id: "690b1db71f73400e53177480" },
  { name: "Gemini_Generated_Image_nzcwxunzcwxunzcw.png", _id: "690b1db71f73400e53177481" },
  { name: "Gemini_Generated_Image_evj33pevj33pevj3.png", _id: "690b1db71f73400e53177482" },
  { name: "Gemini_Generated_Image_o1cf3yo1cf3yo1cf.png", _id: "690b1db71f73400e53177483" }
]
📤 Upload progress [0]: 0 % Gemini_Generated_Image_4qc7rf4qc7rf4qc7.png
📤 Upload progress [1]: 0 % Gemini_Generated_Image_nzcwxunzcwxunzcw.png
📤 Upload progress [2]: 0 % Gemini_Generated_Image_evj33pevj33pevj3.png
📤 Upload progress [3]: 0 % Gemini_Generated_Image_o1cf3yo1cf3yo1cf.png
...
📤 Upload progress [0]: 100 % Gemini_Generated_Image_4qc7rf4qc7rf4qc7.png
📤 Upload progress [1]: 100 % Gemini_Generated_Image_nzcwxunzcwxunzcw.png
📤 Upload progress [2]: 100 % Gemini_Generated_Image_evj33pevj33pevj3.png
📤 Upload progress [3]: 100 % Gemini_Generated_Image_o1cf3yo1cf3yo1cf.png
✅ All files uploaded: [...]
🔍 Verifying IDs match:
  File 0: ✅ 690b1db71f73400e53177480 === 690b1db71f73400e53177480
    - Name: Gemini_Generated_Image_4qc7rf4qc7rf4qc7.png, Size: 1595010 bytes, Type: image/png
  File 1: ✅ 690b1db71f73400e53177481 === 690b1db71f73400e53177481
    - Name: Gemini_Generated_Image_nzcwxunzcwxunzcw.png, Size: 1467707 bytes, Type: image/png
  File 2: ✅ 690b1db71f73400e53177482 === 690b1db71f73400e53177482
    - Name: Gemini_Generated_Image_evj33pevj33pevj3.png, Size: 1516650 bytes, Type: image/png
  File 3: ✅ 690b1db71f73400e53177483 === 690b1db71f73400e53177483
    - Name: Gemini_Generated_Image_o1cf3yo1cf3yo1cf.png, Size: 1548785 bytes, Type: image/png
```

## Test Cases

### Test 1: MongoDB Long Conversion

```typescript
const input = {
  metadata: {
    size: { low: 1467707, high: 0, unsigned: false },
  },
};

const result = transformUploadResponse(input);
expect(result.size).toBe(1467707);
expect(typeof result.size).toBe("number");
```

### Test 2: Regular Number Size

```typescript
const input = {
  metadata: {
    size: 1467707,
  },
};

const result = transformUploadResponse(input);
expect(result.size).toBe(1467707);
```

### Test 3: All Fields Present

```typescript
const input = {
  message: "Tải file thành công",
  statusCode: 200,
  metadata: {
    _id: "690b1dba1f73400e53177486",
    url: "https://s3.../file.png",
    kind: "image",
    name: "file.png",
    size: { low: 1467707, high: 0, unsigned: false },
    mimeType: "image/png",
    status: "uploaded",
  },
};

const result = transformUploadResponse(input);
expect(result).toEqual({
  _id: "690b1dba1f73400e53177486",
  url: "https://s3.../file.png",
  kind: "image",
  name: "file.png",
  size: 1467707,
  mimeType: "image/png",
  status: "uploaded",
});
```

## FilePreview Final State

After upload, FilePreview should have all server data:

```typescript
{
  _id: "690b1db71f73400e53177480",           // ← From client (preserved)
  url: "https://s3.../file.png",              // ← From server (updated)
  uploadedUrl: "https://s3.../file.png",      // ← From server
  kind: "photo",                               // ← From server or client fallback
  name: "Gemini_Generated_Image_4qc7rf.png",  // ← From server or client fallback
  size: 1595010,                               // ← From server (converted from Long)
  mimeType: "image/png",                       // ← From server or client fallback
  status: "uploaded",                          // ← Set after upload
  uploadProgress: 100,                         // ← Set after upload
  file: undefined,                             // ← Removed after upload
  thumbUrl: "blob:http://...",                // ← From client (if exists)
  width: 1920,                                 // ← From client (if exists)
  height: 1080                                 // ← From client (if exists)
}
```

## Verification Commands

### Check transformed response

```javascript
// In service
console.log("Raw API response:", apiResp);
console.log("Transformed:", transformUploadResponse(apiResp));
```

### Check size conversion

```javascript
const metadata = response.data.metadata;
console.log("Original size:", metadata.size);
console.log("Type:", typeof metadata.size);
console.log(
  "Is Long?",
  typeof metadata.size === "object" && "low" in metadata.size
);
console.log("Converted:", result.size, typeof result.size);
```

### Check final FilePreview

```javascript
const state = useMessageStore.getState();
const msg = state.messagesRoom[roomId]?.messages.find(
  (m) => m.id === messageId
);
console.log("Attachments:", msg?.attachments);

msg?.attachments?.forEach((att) => {
  console.log(`${att.name}:`, {
    id: att._id,
    size: att.size,
    type: att.mimeType,
    url: att.url.substring(0, 50) + "...",
  });
});
```
