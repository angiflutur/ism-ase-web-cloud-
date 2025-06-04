import React, { useState, useRef } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [key, setKey] = useState("");
  const [operation, setOperation] = useState("encrypt");
  const [mode, setMode] = useState("ECB");
  const [msg, setMsg] = useState("");
  const [imgUrl, setImgUrl] = useState(null);
  const [jobId, setJobId] = useState(null);

  const pollRef = useRef(null);

  // poll backend for processed image until ready or error
  const startPolling = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const fileResp = await fetch(`/api/result/${id}`);
        if (!fileResp.ok) {
          if (fileResp.status === 404) {
            // image not ready yet, keep polling
            setMsg("Processing in progress...");
            return;
          } else {
            throw new Error("Download failed with status " + fileResp.status);
          }
        }

        // image ready, convert to blob and create URL
        const blob = await fileResp.blob();
        setImgUrl(URL.createObjectURL(blob));
        clearInterval(pollRef.current);
        setMsg("Image processed successfully");
      } catch (e) {
        console.error("Polling error:", e);
        setMsg("Polling error: " + e.message);
        clearInterval(pollRef.current);
      }
    }, 1000);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a BMP file");

    // check if key length matches AES key sizes in bytes
    if (![16, 24, 32].includes(key.length)) {
      setMsg("Key must be exactly 16, 24, or 32 characters long (128/192/256 bits).");
      return;
    }

    setImgUrl(null);
    setMsg("Sending...");
    setJobId(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("key", key);
    fd.append("operation", operation);
    fd.append("mode", mode);

    try {
      const res = await fetch("/api/encrypt/upload", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Upload failed");

      // backend returns { id: "..." } to identify job
      const { id } = await res.json();
      setJobId(id);
      setMsg("Sent for processing…");

      // start polling for this job id
      startPolling(id);
    } catch (error) {
      setMsg("Upload error: " + error.message);
    }
  };

  // generate default filename for download link
  const getDownloadName = () => {
    if (!file) return `${operation === "encrypt" ? "enc" : "dec"}_${mode}_result.bmp`;
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    return `${operation === "encrypt" ? "enc" : "dec"}_${mode}_${nameWithoutExt}.bmp`;
  };

  return (
    <div style={{ maxWidth: 480, margin: "auto" }}>
      <h2>AES Encrypt/Decrypt BMP</h2>

      <form onSubmit={send}>
        <input type="file" accept=".bmp" onChange={(e) => setFile(e.target.files[0] || null)} />
        <br />
        <input
          value={key}
          placeholder="AES key (128, 192 or 256 bits)"
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
          <h3>Result</h3>
          <img
            src={imgUrl}
            alt="Processed BMP"
            style={{ maxWidth: "100%", border: "1px solid #ccc" }}
          />
          <p>
            <a href={imgUrl} download={getDownloadName()}>
              Download
            </a>
          </p>
        </>
      )}
    </div>
  );
}
