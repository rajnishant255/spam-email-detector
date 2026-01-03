// frontend/src/App.js
import React, { useState, useEffect } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000/api/spam";

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHighlightedHtml(text, keywords) {
  if (!text) return "";
  if (!keywords || keywords.length === 0) return text;

  const escaped = keywords.map(escapeRegExp);
  const regex = new RegExp("(" + escaped.join("|") + ")", "gi");

  // Wrap matches in <mark>
  return text.replace(regex, '<mark class="kw-highlight">$1</mark>');
}

function App() {
  const [text, setText] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [result, setResult] = useState("");
  const [probability, setProbability] = useState(null);
  const [time, setTime] = useState("");
  const [matchedKeywords, setMatchedKeywords] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("History error:", e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleCheck = async (withNotify) => {
    setError("");
    setResult("");
    setProbability(null);
    setTime("");
    setMatchedKeywords([]);

    if (!text.trim()) {
      setError("Please type or paste an email text.");
      return;
    }
    if (withNotify && !alertEmail.trim()) {
      setError("Please enter an email address for alerts.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          notifyEmail: withNotify ? alertEmail.trim() : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
      } else {
        setResult(data.result); // "spam" / "not_spam"
        setProbability(data.spamProbability);
        setTime(data.createdAt);
        setMatchedKeywords(data.matchedKeywords || []);
        loadHistory();
      }
    } catch (e) {
      console.error(e);
      setError("Cannot reach server. Is backend running on port 5000?");
    } finally {
      setLoading(false);
    }
  };

  const isSpam = result === "spam";
  const spamPercent =
    probability !== null ? (probability * 100).toFixed(2) + "%" : "--";

  const highlightedHtml = getHighlightedHtml(text, matchedKeywords);

  return (
    <div className="page">
      <header className="header">
        <h1>Spam Email Detector</h1>
        <p className="subtitle">
          Simple MERN app that shows <span className="why">why</span> something
          is spam.
        </p>
      </header>

      <main className="layout">
        {/* LEFT: input + buttons */}
        <section className="panel left-panel">
          <h2>1. Paste Email</h2>
          <p className="hint">
            Paste the email text below and click a button to check.
          </p>

          <textarea
            className="email-input"
            placeholder="Example: Congratulations, you won a free lottery. Click here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="email-input-row">
            <label className="small-label">
              Your email for alerts (optional):
            </label>
            <input
              type="email"
              className="alert-email"
              placeholder="you@example.com"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
            />
          </div>

          <p className="tiny-hint">
            If you use the blue button, we'll send an email if spam percentage
            is ≥ <strong>40%</strong>.
          </p>

          <div className="button-row">
            <button
              className="btn btn-outline"
              onClick={() => handleCheck(false)}
              disabled={!text.trim() || loading}
            >
              {loading ? "Checking..." : "Check Spam & Explain"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleCheck(true)}
              disabled={!text.trim() || !alertEmail.trim() || loading}
            >
              {loading ? "Checking..." : "Check & Notify Me"}
            </button>
          </div>

          {error && <div className="error-banner">{error}</div>}
        </section>

        {/* RIGHT: result + explanation */}
        <section className="panel right-panel">
          <h2>2. Result & Explanation</h2>

          <div className={`result-card ${result ? (isSpam ? "spam" : "ham") : ""}`}>
            {!result ? (
              <p className="placeholder">
                Run a check to see the result and explanation.
              </p>
            ) : (
              <>
                <h3 className="result-title">
                  {isSpam ? "SPAM" : "NOT SPAM"}
                </h3>
                <p className="result-line">
                  Spam probability: <strong>{spamPercent}</strong>
                </p>
                {time && (
                  <p className="result-line small">
                    Checked at:{" "}
                    {new Date(time).toLocaleString(undefined, {
                      hour12: true
                    })}
                  </p>
                )}

                <div className="keywords-section">
                  <p className="result-line">
                    <strong>Matched keywords:</strong>
                  </p>
                  {matchedKeywords && matchedKeywords.length > 0 ? (
                    <div className="keyword-chips">
                      {matchedKeywords.map((kw, idx) => (
                        <span key={idx} className="chip">
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="small">No specific spam keywords detected.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="preview-box">
            <h3>Highlighted Email Preview</h3>
            <div
              className="preview-content"
              dangerouslySetInnerHTML={{ __html: highlightedHtml || text }}
            />
          </div>
        </section>
      </main>

      {/* History */}
      <section className="history-panel">
        <h2>Recent Checks (Last 10)</h2>
        {history.length === 0 ? (
          <p className="small">No checks yet.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Result</th>
                <th>Spam %</th>
                <th>Keywords</th>
                <th>Text</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td
                    className={
                      item.result === "spam" ? "badge badge-spam" : "badge badge-ham"
                    }
                  >
                    {item.result.toUpperCase()}
                  </td>
                  <td>{(item.spamProbability * 100).toFixed(1)}%</td>
                  <td>
                    {item.matchedKeywords && item.matchedKeywords.length > 0
                      ? item.matchedKeywords.join(", ")
                      : "-"}
                  </td>
                  <td>{item.text}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default App;
