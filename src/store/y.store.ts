import useAuthStore from "@/store/useAuthStore";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

const authState = useAuthStore((state) => state);
// Create the shared doc
export const doc = new Y.Doc();

// Create a websocket provider
export const provider = new WebsocketProvider(
  process.env.NEXT_PUBLIC_SOCKET_DOC_URL || "ws://localhost:5000",
  "docs",
  doc
);

// Export the provider's awareness API
export const awareness = provider.awareness;

if (authState.user) {
  awareness.setLocalState({
    name: authState.user.fullname,
    email: authState.user.email || authState.user.phone,
  });
}
