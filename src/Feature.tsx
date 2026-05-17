import { useEffect, useState } from "react";
import {
  QRExchange,
  longestSimplePath,
  makeScanPayload,
  usePerPeerValue,
  type MeshConfig,
  type YRoom,
  type Edge,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
const NAME_KEY = (p: string) => `${p}:displayName`;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="viral-screen">
        <h1>handshake chain</h1>
        <p className="viral-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [, rerender] = useState(0);

  const names = usePerPeerValue<string>(room, "names", "");

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const edges = room.doc.getArray<Edge>("edges");
    const cb = () => rerender((n) => n + 1);
    edges.observe(cb);
    return () => {
      edges.unobserve(cb);
    };
  }, [room]);

  const edges = room.doc.getArray<Edge>("edges");
  const namesMap = room.doc.getMap<string>("names");

  // register my name
  useEffect(() => {
    if (name.trim()) names.setMy(name.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, room.peerId]);

  const edgeList = edges.toArray();

  const has = (from: string, to: string) => edgeList.some((e) => e.from === from && e.to === to);

  const handshake = (otherPeerId: string, otherName?: string) => {
    const t = name.trim();
    if (!t) return;
    if (otherPeerId === room.peerId) return;
    room.doc.transact(() => {
      namesMap.set(room.peerId, t);
      if (otherName) namesMap.set(otherPeerId, otherName);
      // bidirectional edge inserted as a single transaction
      if (!has(room.peerId, otherPeerId))
        edges.push([{ from: room.peerId, to: otherPeerId, ts: Date.now() }]);
      if (!has(otherPeerId, room.peerId))
        edges.push([{ from: otherPeerId, to: room.peerId, ts: Date.now() }]);
    });
  };

  const myPayload = makeScanPayload(room.roomId, room.peerId, name.trim() || "anon");

  const path = longestSimplePath(edgeList);
  const myHandshakes = edgeList.filter((e) => e.from === room.peerId).length;
  const allPeers = new Set<string>();
  edgeList.forEach((e) => {
    allPeers.add(e.from);
    allPeers.add(e.to);
  });
  names.entries.forEach(([k]) => allPeers.add(k));

  return (
    <div className="viral-screen">
      <header>
        <h1>handshake chain</h1>
        <p className="viral-status">
          {allPeers.size} people · {edgeList.length / 2} handshakes · longest chain:{" "}
          <strong>{path.length}</strong> · you: {myHandshakes} handshakes
        </p>
      </header>

      <input
        className="viral-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={48}
        aria-label="your name"
      />

      <QRExchange
        myPayload={myPayload}
        showLabel="your handshake QR"
        scanLabel="shake hands (scan a QR)"
        onScan={(parsed) => handshake(parsed.peerId, parsed.extra ?? undefined)}
      />

      <section>
        <h2 className="viral-section-title">longest chain in the room</h2>
        {path.length < 2 ? (
          <p className="viral-empty">need at least one handshake</p>
        ) : (
          <ol className="hsc-path">
            {path.map((p, i) => (
              <li key={p} className={p === room.peerId ? "is-me" : ""}>
                {i > 0 && <span className="hsc-arrow">→</span>}
                <span className="hsc-node">
                  {names.valueOf(p) ?? p.slice(0, 6)}
                  {p === room.peerId ? " (you)" : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="viral-section-title">your handshakes</h2>
        {myHandshakes === 0 ? (
          <p className="viral-empty">no handshakes yet</p>
        ) : (
          <ul className="viral-tags">
            {edgeList
              .filter((e) => e.from === room.peerId)
              .map((e) => (
                <li key={e.to}>
                  <strong>{names.valueOf(e.to) ?? e.to.slice(0, 6)}</strong>
                  <span style={{ opacity: 0.6, marginLeft: "0.4rem" }}>
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
