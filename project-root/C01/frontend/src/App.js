import React, { useState, useRef } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [key, setKey] = useState("");
  const [operation, setOperation] = useState("encrypt");
  const [mode, setMode] = useState("ECB");
  const [msg, setMsg] = useState("");
  const [imgUrl, setImgUrl] = useState(null);

  const lastIdRef = useRef(null);
  const pollRef = useRef(null);

  /* ------------------ POLLING ------------------ */
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/result/last");
        if (!r.ok) {
          console.warn("Status", r.status);
          return;
        }

        if (r.status === 204) return; 

        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          console.warn("Nu e JSON, content-type:", ct);
          return;
        }

        const { id } = await r.json();
        if (id && id !== lastIdRef.current) {
          lastIdRef.current = id;

          const fileResp = await fetch(`/api/result/${id}`);

          if (!fileResp.ok) throw new Error("Download failed " + fileResp.status);

          const blob = await fileResp.blob();
          setImgUrl(URL.createObjectURL(blob));
          clearInterval(pollRef.current);
          setMsg("Imagine procesata ✔");
        }
      } catch (e) {
        console.error("Eroare la polling:", e);
        setMsg("Eroare la polling: " + e.message);
      }
    }, 1000);
  };

  /* ------------------ UPLOAD ------------------ */
  const send = async (e) => {
    e.preventDefault();
    if (!file) return alert("Selecteaza BMP");

    setImgUrl(null);
    setMsg("Se trimite...");
    lastIdRef.current = null;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("key", key);
    fd.append("operation", operation);
    fd.append("mode", mode);

    try {
      await fetch("/api/encrypt/upload", {
        method: "POST",
        body: fd,
      });
      setMsg("Trimis spre procesare…");
      startPolling();
    } catch (error) {
      setMsg("Eroare la upload: " + error.message);
    }
  };
const getDownloadName = () => {
  if (!file) return `${operation === "encrypt" ? "enc" : "dec"}_${mode}_result.bmp`;
  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
  return `${operation === "encrypt" ? "enc" : "dec"}_${mode}_${nameWithoutExt}.bmp`;
};
  /* ------------------ UI ------------------ */
  return (
    <div style={{ maxWidth: 480, margin: "auto" }}>
      <h2>AES Encrypt/Decrypt BMP</h2>
      <form onSubmit={send}>
        <input
          type="file"
          accept=".bmp"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        <br />
        <input
          value={key}
          placeholder="AES key"
          onChange={(e) => setKey(e.target.value)}
        />
        <br />
        <select value={operation} onChange={(e) => setOperation(e.target.value)}>
          <option value="encrypt">Encrypt</option>
          <option value="decrypt">Decrypt</option>
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="ECB">ECB</option>
          <option value="CBC">CBC</option>
        </select>
        <br />
        <button>Upload</button>
      </form>

      <p>{msg}</p>

       {imgUrl && (
      <>
        <h3>Rezultat</h3>
        <img
          src={imgUrl}
          alt="BMP procesat"
          style={{ maxWidth: "100%", border: "1px solid #ccc" }}
        />
        <p>
          <a href={imgUrl} download={getDownloadName()}>
            Descarca
          </a>
        </p>
      </>
    )}

    </div>
  );
}