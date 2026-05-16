# React Native Implementation Plan for App Chat

This document outlines the strategy for migrating and adapting the existing Next.js web application flows to a React Native mobile application. The goal is to maximize code reuse (Zustand stores, Services, API integration) while substituting web-specific APIs (IndexedDB, localStorage, WebRTC) with robust mobile alternatives.

## User Review Required

> [!WARNING]
> **Database Selection:** The web app uses Dexie (IndexedDB) for caching rooms and messages. For React Native, we need a mobile-optimized local database. I recommend **WatermelonDB** or **Expo SQLite** for performance. Please review and confirm the preferred database.

> [!WARNING]
> **Authentication Security:** The web app relies on HttpOnly cookies for `refreshToken`. React Native's `fetch` API can handle cookies, but it can be inconsistent across iOS/Android. We may need to adjust the backend to return the `refreshToken` in the body for the mobile app, or ensure we use a robust cookie manager (like `@react-native-cookies/cookies`).

## Open Questions

> [!IMPORTANT]
> 1. Are we using **Expo** (Managed/Bare workflow) or **React Native CLI**? This impacts the library choices for WebRTC and File System.
> 2. For video/audio calls, the web uses standard WebRTC. Do we plan to use `react-native-webrtc` or a managed service SDK (like LiveKit/Agora) for the mobile app?
> 3. Should we implement offline-first messaging out of the box, or strictly mirror the web app's caching behavior?
> 4. **Collaborative Documents:** The web uses Yjs + WebSockets for real-time document editing. For mobile, building a rich-text collaborative editor natively is complex. Will we use a `WebView` wrapper around the web editor, or build a native rich-text editor using `react-native-pell-rich-editor` combined with Yjs?

---

## Proposed Architecture Adaptations

### 1. State Management & API
The current architecture cleanly separates UI from logic using `Zustand` and `Axios`. This is excellent for React Native.
- **Zustand Stores** (`useAuthStore`, `useRoomStore`, `useMessageStore`, etc.) can be reused almost entirely.
- **Axios Interceptors** for token refresh can be reused.

### 2. Local Storage & Caching
The web app uses `localStorage` for `accessToken` and `Dexie` (IndexedDB) for caching rooms and messages.
- **Key-Value Storage:** Replace `localStorage` with `react-native-mmkv` (fastest) or `AsyncStorage`.
- **Relational/Document Storage:** Replace `Dexie` with `WatermelonDB` (highly recommended for chat apps due to lazy loading and observable queries) or `Expo SQLite`.

### 3. Real-time Communication
- **Socket.IO:** `socket.io-client` works identically in React Native. We just need to handle app state changes (background/foreground) to disconnect/reconnect the socket to save battery.

### 4. Push Notifications
- Replace web Firebase setup (`libs/firebase.ts`) with `@react-native-firebase/messaging`.
- Handle background states, notification tapping, and deep linking into specific chat rooms.

---

## Detailed Flow Implementations

### Auth Flow (`useAuthStore`)
*   **Login/Register:** Call `AuthService`. Save `accessToken` to MMKV/SecureStore instead of `localStorage`.
*   **Refresh Token:** If keeping HttpOnly cookies, ensure Axios is configured with `withCredentials: true` and test across iOS/Android. Alternatively, store the refresh token securely in `expo-secure-store`.
*   **Logout:** Clear MMKV, clear local SQL DB, and unsubscribe from Firebase FCM.

### Room & Chat Flow (`useRoomStore`, `useMessageStore`)
*   **Room List:** Fetch from API, cache to SQLite/WatermelonDB. Subscribe to Socket.IO events (`room:new`, `room:update`).
*   **Messages:** Implement an optimistic UI update similar to the web. When `sendMessage` is called:
    1. Append to local state (Zustand) with `status="pending"`.
    2. Upload attachments using `expo-file-system` and `expo-image-picker`.
    3. Emit `message:send` via Socket.IO.
    4. Update status to `sent` on acknowledgment.
*   **Pagination:** Use React Native's `FlatList` with `inverted={true}` for the chat interface. Trigger `fetchNewMessages` on `onEndReached`.

### Call Flow (P2P and SFU)
*   **WebRTC:** Replace browser `RTCPeerConnection` with `react-native-webrtc`.
*   **UI:** Use `RTCView` to render local and remote video streams.
*   **Permissions:** Request `CAMERA` and `RECORD_AUDIO` permissions before initiating calls using `expo-permissions` or `react-native-permissions`.
*   **Call Service:** Implement CallKit (iOS) and ConnectionService (Android) via `react-native-callkeep` so incoming calls ring like native phone calls even when the app is killed.

### Contact & Friend Flow
*   Can be ported directly by reusing `useContactStore.ts` and UI components mapped to React Native equivalents (`View`, `Text`, `FlatList`).

### Document Flow (`useDocumentStore`, `y.store.ts`)
*   **API & State:** Reuse `useDocumentStore.ts` for listing, creating, and sharing documents.
*   **Collaboration:** `Y.Doc` and `y-websocket` work in React Native without much modification.
*   **UI:** The biggest challenge is the rich-text editor. We can either embed the Next.js editor via `react-native-webview` (easiest, ensures 100% feature parity) or implement a native rich-text editor like `react-native-pell-rich-editor` and sync its state with `Yjs` (better UX but harder to implement).

### Todo List Flow (`useTodoStore`)
*   **API & State:** Reuse `useTodoStore.ts` directly for CRUD operations on Todo items and Projects.
*   **UI:** Implement swipe-to-delete gestures using `react-native-gesture-handler` and `react-native-reanimated`. Use simple `CheckBox` components and native date pickers (`@react-native-community/datetimepicker`) for deadlines.

### Quizz Flow (`QuizzService`)
*   **Integration:** Quizzes are sent as chat messages. We will build custom message bubbles (`QuizMessageCard`) for quiz invitations.
*   **Taking Quizzes:** Implement a multi-step modal or dedicated screen for answering quiz questions. We will use native Radio buttons and Checkboxes.
*   **Submission:** Call `QuizzService.submitResult` and display the leaderboard using a standard `FlatList`.

### Flashcard Flow (`FlashcardService`)
*   **Deck Management:** Replicate the CRUD interface for Flashcard Decks using standard lists and forms.
*   **Study Interface:** Implement a Tinder-like swipeable card interface using `react-native-reanimated` and `react-native-gesture-handler` or a flip animation for the flashcards to show terms/definitions.
*   **Spaced Repetition:** Ensure any API calls related to study sessions (marking cards as correct/incorrect) map seamlessly from the web implementations.

---

## Verification Plan

### Automated Tests
- Setup unit tests for Zustand store logic using `jest` to ensure they handle the mobile-specific storage adapters correctly.

### Manual Verification
- **Auth:** Verify login, persistence across app restarts, and token refresh logic.
- **Chat:** Verify sending text and images, optimistic UI updates, and socket reconnections when toggling airplane mode.
- **Background States:** Verify FCM push notifications arrive when the app is closed, and tapping them opens the correct room.
- **Calls:** Test P2P and SFU calls between the React Native app and the Web app.
