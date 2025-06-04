package com.example.processor;

import org.json.JSONObject;

import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.util.Base64;
import java.util.List;

public class PictureProcessor {

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    /* internal container address for Node.js API (set via docker-compose) */
    private static final String NODE_URL =
            "http://" + System.getenv().getOrDefault("RESULT_API_HOST", "c05")
            + ":3000/api/result";

    public static void process(String json) throws Exception {

        /* quick validation */
        if (json == null || json.isBlank() || !json.trim().startsWith("{"))
            throw new IllegalArgumentException("Invalid JSON payload");

        Path in  = null;
        Path out = null;

        try {
            /* parse json input */
            JSONObject o   = new JSONObject(json);
            byte[] img     = Base64.getDecoder().decode(o.getString("fileBase64"));
            String file    = o.getString("fileName");
            String key     = o.getString("key");          // used only by MPI binary
            String op      = o.getString("operation");    // encrypt or decrypt
            String mode    = o.getString("mode");         // ECB or CBC mode

            /* create temp files for input and output images */
            in  = Files.createTempFile("src-", ".bmp");
            out = Files.createTempFile("dst-", ".bmp");
            Files.write(in, img);

            /* run MPI binary with 4 processes and OpenMP inside */
            List<String> cmd = List.of(
                    "mpirun", "--allow-run-as-root", "-np", "4",
                    "/usr/local/bin/mpi_openmp",
                    in.toString(), out.toString(), key, op, mode
            );

            if (new ProcessBuilder(cmd).inheritIO().start().waitFor() != 0)
                throw new IOException("MPI process exited with error");

            /* send the processed result back to Node.js service */
            String body = new JSONObject()
                    .put("fileName",     file)
                    .put("operation",    op)
                    .put("mode",         mode)
                    .put("resultBase64", Base64.getEncoder().encodeToString(
                                            Files.readAllBytes(out)))
                    .toString();

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(NODE_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> resp = HTTP.send(req,
                                                  HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() / 100 != 2)
                throw new IOException("Upload failed " + resp.statusCode()
                                      + " - " + resp.body());

            System.out.println("Upload OK - bytes: " + Files.size(out));

        } finally {
            if (in  != null) Files.deleteIfExists(in);
            if (out != null) Files.deleteIfExists(out);
        }
    }
}
