import { useState } from "react";
import yaml from "js-yaml";
import Header from "./components/Header";

const REPO_URL = "https://github.com/Babug01/helm-values-diff";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  return false;
}

// Flat list of dot-notation paths that differ. Arrays are compared by
// index — reordering an array therefore shows up as every shifted index
// being "changed" (or added/removed at the tail), not as a smart
// move-detection diff. Called out in the UI, not silently assumed.
function deepDiff(base, compare, pathPrefix = "") {
  const results = [];
  if (isPlainObject(base) && isPlainObject(compare)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(compare)]);
    for (const key of [...keys].sort()) {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const inBase = Object.prototype.hasOwnProperty.call(base, key);
      const inCompare = Object.prototype.hasOwnProperty.call(compare, key);
      if (inBase && !inCompare) results.push({ path, type: "removed", oldValue: base[key] });
      else if (!inBase && inCompare) results.push({ path, type: "added", newValue: compare[key] });
      else results.push(...deepDiff(base[key], compare[key], path));
    }
  } else if (Array.isArray(base) && Array.isArray(compare)) {
    const maxLen = Math.max(base.length, compare.length);
    for (let i = 0; i < maxLen; i++) {
      const path = `${pathPrefix}[${i}]`;
      const inBase = i < base.length;
      const inCompare = i < compare.length;
      if (inBase && !inCompare) results.push({ path, type: "removed", oldValue: base[i] });
      else if (!inBase && inCompare) results.push({ path, type: "added", newValue: compare[i] });
      else results.push(...deepDiff(base[i], compare[i], path));
    }
  } else if (!deepEqual(base, compare)) {
    results.push({ path: pathPrefix || "(root)", type: "changed", oldValue: base, newValue: compare });
  }
  return results;
}

function formatScalar(v) {
  if (v === undefined) return "(unset)";
  if (v === null) return "null";
  if (isPlainObject(v) || Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

const TYPE_COLOR = { added: "#3fb950", removed: "#e05c5c", changed: "#c97f2e" };

// Merged tree view: walks the union of both documents. Once a path matches
// (or is nested under) a diff entry, that status is inherited all the way
// down so an entirely-added/removed subtree renders in full, not just its root key.
function TreeNode({ nodeKey, base, compare, path, diffByPath, inherited }) {
  const direct = diffByPath.get(path);
  const status = direct?.type || inherited || null;

  if (status === "changed" && direct) {
    return (
      <div style={styles.treeRow}>
        <span style={styles.treeKey}>{nodeKey}</span>
        <span style={{ color: TYPE_COLOR.changed }}>{formatScalar(direct.oldValue)} → {formatScalar(direct.newValue)}</span>
      </div>
    );
  }

  const value = status === "removed" ? base : compare !== undefined ? compare : base;
  const isContainer = isPlainObject(value) || Array.isArray(value);

  if (!isContainer) {
    return (
      <div style={styles.treeRow}>
        <span style={styles.treeKey}>{nodeKey}</span>
        <span style={status ? { color: TYPE_COLOR[status] } : undefined}>{formatScalar(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [i, v])
    : Object.keys(value).sort().map((k) => [k, value[k]]);

  return (
    <div>
      <div style={styles.treeRow}>
        <span style={{ ...styles.treeKey, ...(status ? { color: TYPE_COLOR[status] } : {}) }}>{nodeKey}</span>
        <span style={{ opacity: 0.4, fontSize: 11 }}>{Array.isArray(value) ? `[${value.length}]` : "{...}"}</span>
      </div>
      <div style={styles.treeChildren}>
        {entries.map(([k, v]) => {
          const childPath = Array.isArray(value) ? `${path}[${k}]` : path ? `${path}.${k}` : String(k);
          const childBase = isPlainObject(base) || Array.isArray(base) ? base?.[k] : undefined;
          const childCompare = isPlainObject(compare) || Array.isArray(compare) ? compare?.[k] : undefined;
          return (
            <TreeNode
              key={childPath}
              nodeKey={Array.isArray(value) ? `[${k}]` : k}
              base={status === "removed" ? v : childBase}
              compare={status === "added" ? v : childCompare}
              path={childPath}
              diffByPath={diffByPath}
              inherited={status}
            />
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  root: { height: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column" },
  content: { fontFamily: "system-ui, sans-serif", padding: "20px 24px", flex: 1, minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", background: "var(--bg-subtle, #f0efed)" },
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text, #1a1a1a)" },
  subtitle: { fontSize: 13, opacity: 0.55, margin: "4px 0 0", color: "var(--text, #1a1a1a)" },
  note: { fontSize: 11, opacity: 0.5, margin: "6px 0 0", color: "var(--text, #1a1a1a)" },
  body: { display: "flex", gap: 16, flex: 1, minHeight: 0, minWidth: 0 },
  pane: { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 },
  paneHeader: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6, marginBottom: 8, color: "var(--text, #1a1a1a)" },
  textarea: {
    flex: 1, resize: "none", fontFamily: "'SFMono-Regular', Consolas, monospace", fontSize: 12, padding: 12,
    borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", background: "var(--input-bg, #f9fafb)",
    color: "var(--text, #1a1a1a)", outline: "none",
  },
  rail: { display: "flex", flexDirection: "column", gap: 10, width: 168, flexShrink: 0 },
  btn: (kind) => ({
    padding: "10px 14px", borderRadius: 6, border: kind === "primary" ? "none" : "1px solid var(--border, #e5e7eb)",
    background: kind === "primary" ? "var(--accent, #4f46e5)" : "transparent",
    color: kind === "primary" ? "#fff" : "var(--text, #1a1a1a)",
    cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%",
  }),
  railDivider: { height: 1, background: "var(--border, #e5e7eb)", margin: "2px 0" },
  checkboxRow: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text, #1a1a1a)" },
  errorBox: {
    flex: 1, padding: 16, borderRadius: 8, border: "1px solid #e05c5c", background: "rgba(224,92,92,0.08)",
    color: "#e05c5c", fontSize: 13, fontFamily: "'SFMono-Regular', Consolas, monospace", whiteSpace: "pre-wrap", overflow: "auto",
  },
  resultsPane: { flex: "1.2 1 0", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 },
  summaryRow: { display: "flex", gap: 8, marginBottom: 8 },
  summaryBadge: (type, count) => ({
    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: `${TYPE_COLOR[type]}1f`, color: TYPE_COLOR[type], opacity: count === 0 ? 0.4 : 1,
  }),
  resultsBox: { flex: 1, minHeight: 0, overflow: "auto", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, background: "var(--input-bg, #f9fafb)", padding: 10 },
  diffRow: { display: "flex", gap: 10, padding: "6px 8px", borderRadius: 6, fontSize: 12, fontFamily: "'SFMono-Regular', Consolas, monospace", alignItems: "baseline" },
  diffTag: (type) => ({ fontWeight: 700, color: TYPE_COLOR[type], width: 62, flexShrink: 0, textTransform: "uppercase", fontSize: 10 }),
  diffPath: { color: "var(--text, #1a1a1a)", wordBreak: "break-all" },
  diffValue: { opacity: 0.75, wordBreak: "break-all" },
  empty: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 13, color: "var(--text, #1a1a1a)" },
  treeRow: { display: "flex", gap: 8, fontSize: 12, fontFamily: "'SFMono-Regular', Consolas, monospace", padding: "1px 0" },
  treeKey: { color: "var(--text, #1a1a1a)", fontWeight: 600 },
  treeChildren: { marginLeft: 16, borderLeft: "1px solid var(--border, #e5e7eb)", paddingLeft: 10 },
};

export default function App() {
  const [baseText, setBaseText] = useState("");
  const [compareText, setCompareText] = useState("");
  const [diffs, setDiffs] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const [onlyDiffs, setOnlyDiffs] = useState(true);

  function runDiff() {
    try {
      const base = yaml.load(baseText) ?? {};
      const compare = yaml.load(compareText) ?? {};
      setDiffs(deepDiff(base, compare));
      setParsed({ base, compare });
      setError(null);
    } catch (e) {
      setDiffs(null);
      setParsed(null);
      setError("Couldn't parse YAML — " + e.message);
    }
  }

  function clearAll() {
    setBaseText("");
    setCompareText("");
    setDiffs(null);
    setParsed(null);
    setError(null);
  }

  const summary = diffs
    ? { added: diffs.filter((d) => d.type === "added").length, removed: diffs.filter((d) => d.type === "removed").length, changed: diffs.filter((d) => d.type === "changed").length }
    : null;

  return (
    <div style={styles.root}>
      <Header repoUrl={REPO_URL} />
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Helm Values Diff</h1>
          <p style={styles.subtitle}>Paste a base and a compare values.yaml, get a flat list of what changed by dot-notation path. Nothing leaves your browser.</p>
          <p style={styles.note}>Arrays are diffed by index — reordering a list shows as a full replacement of the shifted entries, not smart move-detection.</p>
        </div>

        <div style={styles.body}>
          <div style={styles.pane}>
            <div style={styles.paneHeader}>Base</div>
            <textarea style={styles.textarea} value={baseText} onChange={(e) => setBaseText(e.target.value)} placeholder="Paste base values.yaml here..." spellCheck={false} />
          </div>

          <div style={styles.pane}>
            <div style={styles.paneHeader}>Compare</div>
            <textarea style={styles.textarea} value={compareText} onChange={(e) => setCompareText(e.target.value)} placeholder="Paste compare values.yaml here..." spellCheck={false} />
          </div>

          <div style={styles.rail}>
            <button style={styles.btn("primary")} onClick={runDiff}>Diff</button>
            <div style={styles.checkboxRow}>
              <input type="checkbox" id="onlyDiffs" checked={onlyDiffs} onChange={(e) => setOnlyDiffs(e.target.checked)} />
              <label htmlFor="onlyDiffs">Only show differences (uncheck for full merged tree)</label>
            </div>
            <div style={styles.railDivider} />
            <button style={styles.btn("secondary")} onClick={clearAll}>Clear</button>
          </div>

          <div style={styles.resultsPane}>
            <div style={styles.paneHeader}>Result</div>
            {error ? (
              <div style={styles.errorBox}>{error}</div>
            ) : diffs ? (
              <>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryBadge("added", summary.added)}>+{summary.added} added</span>
                  <span style={styles.summaryBadge("removed", summary.removed)}>-{summary.removed} removed</span>
                  <span style={styles.summaryBadge("changed", summary.changed)}>~{summary.changed} changed</span>
                </div>
                <div style={styles.resultsBox}>
                  {onlyDiffs ? (
                    diffs.length === 0 ? (
                      <div style={{ opacity: 0.5, fontSize: 12 }}>No differences — the two documents are equivalent.</div>
                    ) : (
                      diffs.map((d, i) => (
                        <div key={i} style={styles.diffRow}>
                          <span style={styles.diffTag(d.type)}>{d.type}</span>
                          <span style={styles.diffPath}>{d.path}</span>
                          {d.type === "changed" && <span style={styles.diffValue}>{formatScalar(d.oldValue)} → {formatScalar(d.newValue)}</span>}
                          {d.type === "added" && <span style={styles.diffValue}>{formatScalar(d.newValue)}</span>}
                          {d.type === "removed" && <span style={styles.diffValue}>{formatScalar(d.oldValue)}</span>}
                        </div>
                      ))
                    )
                  ) : (
                    <TreeNode
                      nodeKey="(root)"
                      base={parsed.base}
                      compare={parsed.compare}
                      path=""
                      diffByPath={new Map(diffs.map((d) => [d.path, d]))}
                      inherited={null}
                    />
                  )}
                </div>
              </>
            ) : (
              <div style={styles.empty}>Paste both documents and click Diff.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
