# Ke hoach cai tien luong STT trong Call

## Muc tieu

1. Doi nut `Bat dau phien am` trong panel STT thanh switch dieu khien theo nguoi nghe:
   - UserB bat switch cua UserA thi client UserA bat ghi am local va gui transcript ve UserB.
   - UserA bat switch cua UserB thi client UserB bat ghi am local va gui transcript ve UserA.
2. Tach cau hinh dich STT thanh `from language` va `to language`, khong dung mot select STT language de suy ra ca nguon dich va dich den.

## Hien trang

### Frontend

- `src/app/call/page.tsx`
  - Dang tao `sttBrowser` bang `useSpeechToText`.
  - Dang tao `sttGoogle` bang `useGoogleStt`.
  - Dang chon active hook bang `sttEngine`.
  - Dang truyen `onToggle` xuong `SpeechToTextPanel`, nen ai bam nut thi may nguoi do bat mic local.

- `src/hooks/useSpeechToText.ts`
  - Dung Web Speech API.
  - Chi nghe microphone local.
  - Final segment emit `call:stt-segment` len server.
  - Nhan `call:stt-segment` tu remote va append vao `segments`.

- `src/hooks/useGoogleStt.ts`
  - Dung `navigator.mediaDevices.getUserMedia` + `MediaRecorder`.
  - Gui chunk qua `call:stt-audio-chunk`.
  - Nhan `call:stt-result` va append vao `segments`.

- `src/components/call/SpeechToTextPanel.tsx`
  - Footer dang co nut `Bat dau phien am` / `Dung phien am`.
  - Doi ngon ngu nhan dang bang `lang`.
  - Auto translate dang hard-code:
    - `from`: lay tu `currentLangInfo.apiCode`.
    - `to`: `"vi"`.
  - Neu `lang` la tieng Viet thi khong dich.

### Backend lien quan

- `app-nest-be/apps/socket/src/call/call.gateway.ts`
  - Da co `call:stt-segment`: relay text Web Speech API cho cac peer khac.
  - Da co `call:stt-audio-chunk`: goi AI service transcribe realtime roi emit `call:stt-result`.
  - Chua co event dieu khien remote bat/tat STT theo nguoi nghe.

## Gioi han ky thuat quan trong

Browser khong cho UserB thu truc tiep microphone cua UserA. Vi vay flow dung phai la:

```text
UserB bat switch nghe UserA
  -> UserB emit request control len server
  -> Server relay lenh sang client UserA
  -> Client UserA tu xin quyen mic/local recorder va bat STT
  -> UserA gui transcript/audio chunk len server
  -> Server route ket qua ve UserB
```

Viec "ghi am UserA" thuc chat van phai chay tren may UserA. UserB chi dieu khien viec subscribe/request transcript.

## Thiet ke luong moi

### 1. Data model tren frontend

Them state trong `src/app/call/page.tsx`:

```ts
type SttSubscriptionState = Record<string, boolean>;

const [sttSubscriptions, setSttSubscriptions] = useState<SttSubscriptionState>({});
const [sttTranslateEnabled, setSttTranslateEnabled] = useState(true);
const [sttTranslateFrom, setSttTranslateFrom] = useState("auto");
const [sttTranslateTo, setSttTranslateTo] = useState("vi");
```

Trong do key cua `sttSubscriptions` la `speakerUserId`.

### 2. UI panel STT

Sua `src/components/call/SpeechToTextPanel.tsx`:

- Thay footer button bang switch.
- P2P:
  - Hien mot switch: `Nhan phien am tu {remoteName}`.
- Group:
  - Hien danh sach remote members, moi member co mot switch.
- Giu lai indicator local neu chinh client dang bi remote yeu cau bat recorder:
  - `Dang gui phien am cua ban`.
- Them khu vuc dich:
  - Toggle `Dich transcript`.
  - Select `From`: `auto`, `vi`, `en`, `ja`, `ko`, `zh`, `fr`, `de`, `es`, ...
  - Select `To`: `vi`, `en`, `ja`, `ko`, `zh`, `fr`, `de`, `es`, ...
  - Khong cho `To = auto`.
  - Neu `From === To` thi khong goi API dich.

### 3. Socket event dieu khien

Them event moi:

```ts
socket.emit("call:stt-control", {
  roomId,
  targetUserId,
  enabled,
  engine,
  recognitionLanguage,
  translateFrom,
  translateTo,
});
```

Backend relay sang target:

```ts
socket.to(targetSocketRoom).emit("call:stt-control", {
  roomId,
  requestedByUserId,
  requestedByName,
  targetUserId,
  enabled,
  engine,
  recognitionLanguage,
  translateFrom,
  translateTo,
});
```

Can validate:

- requester nam trong room.
- target nam trong room.
- requester khac target.
- room dang co call active.

### 4. Route transcript ve dung nguoi subscribe

Co hai huong:

#### Phuong an A: Server luu subscription map

Server luu:

```text
stt:subscribers:{roomId}:{speakerUserId} -> Set<requesterUserId>
```

Khi speaker gui transcript, server chi emit ve requester trong set.

Uu diem:

- Dung nghia "UserB bat nghe UserA".
- Khong spam transcript cho ca room.
- Hop ly voi group call.

Nhuoc diem:

- Can cleanup khi disconnect/end call.
- Can map userId -> socket rooms.

#### Phuong an B: Speaker gui kem target requester list

Client target nhan control, luu requesterIds local, khi emit transcript thi kem `requestedByUserIds`.

Uu diem:

- Backend it state hon.

Nhuoc diem:

- Tin vao client hon.
- Group/multi-device kho hon.

Chon phuong an A.

### 5. Sua hooks STT

Nen tach thanh 2 tang:

1. Hook recorder/transcriber:
   - `useSpeechToText` va `useGoogleStt` tiep tuc phu trach bat/tat local recorder.
2. Hook dieu khien remote:
   - Them hook moi `useRemoteSttControl`.
   - Nhan `call:stt-control`.
   - Neu `targetUserId === currentUserId`:
     - `enabled=true`: start active STT engine.
     - `enabled=false`: stop STT neu khong con requester nao.
   - Gui UI status cho panel.

Can tranh loop:

- Khi remote control bat local recorder, khong duoc tu dong bat switch local cua chinh minh.
- Local manual start va remote-requested start can co reason/source rieng:
  - `manual`
  - `remote-requested`

### 6. Payload transcript moi

Voi Browser STT:

```ts
socket.emit("call:stt-segment", {
  roomId,
  speakerUserId: currentUserId,
  speaker,
  text,
  isFinal: true,
  timestamp,
});
```

Voi Google STT:

```ts
socket.emit("call:stt-audio-chunk", {
  roomId,
  speakerUserId: currentUserId,
  speaker,
  audioChunk,
  mimeType,
  language,
});
```

Backend nen stamp lai `speakerUserId` tu authenticated user thay vi tin payload FE.

Ket qua ve requester:

```ts
{
  roomId,
  speakerUserId,
  speaker,
  text,
  detectedLanguage,
  timestamp
}
```

### 7. Dich STT from/to

Sua `SpeechToTextPanel`:

- Bo logic `isVietnamese` la dieu kien bat/tat dich.
- Dieu kien dich moi:
  - `sttTranslateEnabled === true`
  - `seg.isFinal === true`
  - `seg.text.trim()` co noi dung
  - `translateFrom !== translateTo`
  - chua dich segment do voi cung config `from/to`

Nen doi key map translations:

```ts
const translationKey = `${seg.id}:${translateFrom}:${translateTo}`;
```

Goi API:

```ts
aiService.translate(
  seg.text,
  translateFrom === "auto" ? "auto" : translateFrom,
  translateTo,
  null,
);
```

Copy transcript:

- Neu co dich: copy ca original + translated.
- Neu tat dich: copy original.
- Include language pair neu can:

```text
[10:20:30] [UserA] hello
  -> vi: xin chao
```

### 8. Chu y ngon ngu voi Google STT

Hien `useGoogleStt` chi map:

```ts
language: sttLang.startsWith("vi") ? "vi" : "en"
```

Trong khi UI `STT_LANGUAGES` co nhieu ngon ngu. Khi trien khai can chon mot trong hai:

1. Giai phap nhanh:
   - Google STT chi support `vi/en`.
   - Neu chon ngon ngu khac thi disable Google hoac fallback Browser.
2. Giai phap tot hon:
   - Mo rong backend `TranscribeRealtime` de chap nhan cac ma ngon ngu khac.
   - Update prompt/provider neu can.

Khuyen nghi lam giai phap nhanh truoc de giam rui ro.

## Danh sach file du kien sua

Frontend:

- `src/app/call/page.tsx`
  - Them state subscription va translate from/to.
  - Truyen props moi vao `SpeechToTextPanel`.
  - Emit `call:stt-control` khi user bat/tat switch.

- `src/components/call/SpeechToTextPanel.tsx`
  - Doi footer button thanh switch/list switch.
  - Them UI `Translate from` va `Translate to`.
  - Doi auto-translate effect de dung from/to moi.

- `src/hooks/useSpeechToText.ts`
  - Them `speakerUserId`/metadata neu can.
  - Ho tro start/stop theo remote control.

- `src/hooks/useGoogleStt.ts`
  - Them `speakerUserId`/metadata neu can.
  - Ho tro start/stop theo remote control.

- Co the them file moi:
  - `src/hooks/useRemoteSttControl.ts`
  - `src/constants/languages.ts`

Backend:

- `../app-nest-be/apps/socket/src/call/call.gateway.ts`
  - Them handler `call:stt-control`.
  - Luu/don subscription map.
  - Route `call:stt-segment` va `call:stt-result` ve dung subscribers.

## Thu tu trien khai de an toan

### Phase 1: Tach from/to cho STT translation

1. Tao language options chung.
2. Them state `sttTranslateEnabled`, `sttTranslateFrom`, `sttTranslateTo`.
3. Sua `SpeechToTextPanel` nhan props va render 2 select.
4. Sua effect dich dung from/to.
5. Test copy transcript va clear transcript.

Ket qua phase 1: UI dich STT dung from/to, chua thay doi remote control.

### Phase 2: Doi button thanh switch o UI

1. Doi footer button thanh switch trong panel.
2. P2P hien switch cho remote member.
3. Group hien list switch cho tat ca remote members.
4. Tam thoi switch van co the map vao local toggle de kiem tra UI, chua bat remote.

Ket qua phase 2: UI dung hinh thuc switch, chua thay doi socket contract lon.

### Phase 3: Them remote STT control

1. Backend them `call:stt-control`.
2. FE emit control khi switch thay doi.
3. FE target nhan control va start/stop local recorder.
4. Them status "Dang gui phien am cua ban".

Ket qua phase 3: UserB bat switch co the yeu cau UserA tu bat STT.

### Phase 4: Route transcript theo subscriber

1. Backend them subscription map theo `roomId + speakerUserId`.
2. `call:stt-control enabled=true` add requester vao set.
3. `enabled=false` remove requester khoi set.
4. `call:stt-segment` va `call:stt-result` emit ve requester sockets trong set.
5. Cleanup khi `call:end`, `disconnect`, `handoff`.

Ket qua phase 4: Transcript chi ve dung nguoi dang bat switch.

### Phase 5: Kiem thu va hardening

1. P2P:
   - B bat A, A bat recorder va B nhan transcript.
   - B tat A, A dung recorder neu khong con subscriber.
   - A va B bat nhau dong thoi.
2. Group:
   - Nhieu nguoi subscribe cung mot speaker.
   - Mot requester tat nhung requester khac van con thi speaker van tiep tuc recorder.
3. Disconnect/end call:
   - Cleanup recorder.
   - Cleanup subscription map.
4. Doi engine/ngon ngu:
   - Dang nghe ma doi engine thi restart dung engine.
   - Google STT voi ngon ngu ngoai `vi/en` phai fallback/disable ro rang.

## Tieu chi hoan thanh

- Panel STT khong con nut `Bat dau phien am` dang button cu; thay bang switch theo remote participant.
- UserB bat switch cua UserA thi transcript cua UserA xuat hien o UserB.
- UserA bat switch cua UserB thi transcript cua UserB xuat hien o UserA.
- Tat switch thi khong nhan transcript moi tu speaker do.
- Doi `from/to` trong STT translation anh huong den ban dich moi.
- `To` khong cho chon `auto`.
- Khong tao duplicate socket listeners khi mo/dong panel.
- End call/disconnect khong de recorder chay ngam.

## Rui ro can luu y

- Quyen microphone: target user phai chap nhan quyen mic tren may cua ho.
- Privacy: nen hien ro khi user dang bi yeu cau gui transcript.
- Multi-device: mot user co nhieu socket can route control dung call window dang active.
- Cost Google STT: remote-requested recorder co the phat sinh chi phi neu bat lau.
- Browser STT support kem tren mot so trinh duyet; Google fallback can thong bao ro.
