import express  from "express";
import morgan   from "morgan";
import cors     from "cors";
import dotenv   from "dotenv";
import mysql    from "mysql2/promise";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import { finished } from "stream/promises";

dotenv.config();
const app = express();

app.use(morgan("dev"));
app.use(express.json({ limit: "150mb" }));
app.use(cors({ origin: "*" }));

/* ─────────────── Mongo (GridFS) ─────────────── */
const mongo = new MongoClient(
  `mongodb://${process.env.MONGO_HOST}:27017`
);
await mongo.connect();
const bucket = new GridFSBucket(mongo.db("imagesdb"));

/* ─────────────── MySQL pool ─────────────── */
const db = mysql.createPool({
  host:               process.env.MYSQL_HOST,
  user:               process.env.MYSQL_USER,
  password:           process.env.MYSQL_PASSWORD,
  database:           process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit:    10
});

/* creeaza tabela la pornire */
await db.execute(`
  CREATE TABLE IF NOT EXISTS images_meta (
    id   VARCHAR(24) PRIMARY KEY,
    name VARCHAR(255),
    op   VARCHAR(16),
    mode VARCHAR(16),
    ts   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

/* ─────────────── /api/result  (POST) ─────────────── */
app.post("/api/result", async (req, res) => {
  try {
    const { fileName, operation, mode, resultBase64 } = req.body;

    if (!fileName || !operation || !mode || !resultBase64)
      return res.status(400).json({ error: "Missing required fields" });

    /* 1 salveaza fisierul in GridFS */
    const id = new ObjectId();
    const buffer = Buffer.from(resultBase64, "base64");
    await finished(bucket.openUploadStreamWithId(id, fileName).end(buffer));

    /* 2 metadate in MySQL */
    await db.execute(
      "INSERT INTO images_meta(id,name,op,mode) VALUES (?,?,?,?)",
      [id.toString(), fileName, operation, mode]
    );

    res.json({ id: id.toString() });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ─────────────── /api/result/last  (GET) ─────────────── */
app.get("/api/result/last", async (_req, res) => {
  const [rows] = await db.execute(
    "SELECT id FROM images_meta ORDER BY ts DESC LIMIT 1"
  );
  if (!rows.length) return res.status(204).end(); 
  res.json({ id: rows[0].id });
});

/* ─────────────── /api/result/:id  (GET) ─────────────── */
app.get("/api/result/:id([a-fA-F\\d]{24})", (req, res) => {
  const id = new ObjectId(req.params.id);
  bucket.find({ _id: id }).count().then(cnt => {
    if (!cnt) return res.status(404).json({ error: "File not found" });
    res.set("Cache-Control", "no-store").type("bmp");
    bucket.openDownloadStream(id).pipe(res);
  }).catch(err => {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  });
});

/* ─────────────── start ─────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Node API ready on port", PORT));