import { mergeLeanSafe, deriveStatus, deriveGroupCounts } from "./messageStatus";

describe("mergeLeanSafe", () => {
  const hydrated = {
    id: "m1",
    status: "read",
    attachments: [{ _id: "a1" }],
    reactions: [{ emoji: "👍" }],
    read_by: [{ user: { id: "u2" } }],
  } as any;

  it("lean incoming does not clobber hydrated arrays or status", () => {
    const lean = { id: "m1", _lean: true, attachments: [], reactions: [], read_by: [] } as any;
    const out = mergeLeanSafe(hydrated, lean);
    expect(out.attachments).toHaveLength(1);
    expect(out.reactions).toHaveLength(1);
    expect(out.read_by).toHaveLength(1);
    expect(out.status).toBe("read");
  });

  it("full (non-lean) incoming wins", () => {
    const full = { id: "m1", attachments: [{ _id: "a1" }, { _id: "a2" }], reactions: [], read_by: [{ user: { id: "u2" } }] } as any;
    const out = mergeLeanSafe(hydrated, full);
    expect(out.attachments).toHaveLength(2);
  });

  it("no existing → incoming returned as-is", () => {
    const lean = { id: "m9", _lean: true, attachments: [] } as any;
    const out = mergeLeanSafe(undefined, lean);
    expect(out.id).toBe("m9");
  });
});

describe("deriveStatus (1:1)", () => {
  const order = ["m1", "m2"];
  const room = {
    room_type: "private",
    members: [
      { id: "me" },
      { id: "u2", last_delivered_id: "m2", last_read_id: "m1" },
    ],
  } as any;

  it("read when other's read watermark >= message", () => {
    const msg = { id: "m1", sender: { id: "me" } } as any;
    expect(deriveStatus(msg, room, "me", order)).toBe("read");
  });

  it("delivered when only delivered watermark >= message", () => {
    const msg = { id: "m2", sender: { id: "me" } } as any;
    expect(deriveStatus(msg, room, "me", order)).toBe("delivered");
  });

  it("null for messages I did not send", () => {
    const msg = { id: "m2", sender: { id: "u2" } } as any;
    expect(deriveStatus(msg, room, "me", order)).toBeNull();
  });
});

describe("deriveGroupCounts", () => {
  const order = ["m1", "m2"];
  const room = {
    room_type: "group",
    members: [
      { id: "me" },
      { id: "u2", last_delivered_id: "m2", last_read_id: "m2" },
      { id: "u3", last_delivered_id: "m1", last_read_id: null },
    ],
  } as any;

  it("counts delivered and read excluding me", () => {
    const msg = { id: "m1", sender: { id: "me" } } as any;
    const c = deriveGroupCounts(msg, room, "me", order);
    expect(c.total).toBe(2);
    expect(c.deliveredCount).toBe(2);
    expect(c.readCount).toBe(1);
  });
});
