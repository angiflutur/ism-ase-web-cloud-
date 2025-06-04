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

/* ─────────────── mongo (gridfs) ─────────────── */
const mongo = new MongoClient(
  `mongodb://${process.env.MONGO_HOST}:27017`
);
await mongo.connect();
// create a gridfs bucket for storing files in mongodb
const bucket = new GridFSBucket(mongo.db("imagesdb"));

/* ─────────────── mysql pool ─────────────── */
const db = mysql.createPool({
  host:               process.env.MYSQL_HOST,
  user:               process.env.MYSQL_USER,
  password:           process.env.MYSQL_PASSWORD,
  database:           process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit:    10
});

/* create table if not exists on startup */
await db.execute(`
  CREATE TABLE IF NOT EXISTS images_meta (
    id   VARCHAR(24) PRIMARY KEY,
    name VARCHAR(255),
    op   VARCHAR(16),
    mode VARCHAR(16),
    ts   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

/* ─────────────── /api/result  (post) ─────────────── */
app.post("/api/result", async (req, res) => {
  try {
    const { fileName, operation, mode, resultBase64 } = req.body;

    if (!fileName || !operation || !mode || !resultBase64)
      return res.status(400).json({ error: "missing required fields" });

    /* 1 convert base64 string to buffer and save file in gridfs */
    const id = new ObjectId();
    const buffer = Buffer.from(resultBase64, "base64");
    // wait for upload stream to finish
    await finished(bucket.openUploadStreamWithId(id, fileName).end(buffer));

    /* 2 insert metadata in mysql */
    await db.execute(
      "insert into images_meta(id,name,op,mode) values (?,?,?,?)",
      [id.toString(), fileName, operation, mode]
    );

    res.json({ id: id.toString() });
  } catch (err) {
    console.error("upload error:", err.message);
    res.status(500).json({ error: "internal server error" });
  }
});

/* ─────────────── /api/result/last  (get) ─────────────── */
app.get("/api/result/last", async (_req, res) => {
  // get the most recent record id from mysql
  const [rows] = await db.execute(
    "select id from images_meta order by ts desc limit 1"
  );
  if (!rows.length) return res.status(204).end(); // no data yet
  res.json({ id: rows[0].id });
});

/* ─────────────── /api/result/:id  (get) ─────────────── */
app.get("/api/result/:id([a-fA-F\\d]{24})", (req, res) => {
  const id = new ObjectId(req.params.id);
  // check if file exists in gridfs by count
  bucket.find({ _id: id }).count().then(cnt => {
    if (!cnt) return res.status(404).json({ error: "file not found" });
    res.set("cache-control", "no-store").type("bmp");
    // stream the file to response
    bucket.openDownloadStream(id).pipe(res);
  }).catch(err => {
    console.error(err.message);
    res.status(500).json({ error: "internal server error" });
  });
});

/* ─────────────── start server ─────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("node api ready on port", PORT));
