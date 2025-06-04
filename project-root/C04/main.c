/*
 * mpi_openmp_safe.c ― aes-128 ecb/cbc on bmp (mpi + openmp)
 * usage:
 *   mpirun -np <n> ./mpi_openmp_safe <src.bmp> <dst.bmp> <key[<=16b]> <encrypt|decrypt> <ecb|cbc>
 *
 *  ecb  – each 16b block can be processed in parallel
 *  cbc  – processed sequentially inside each rank
 */

#include <mpi.h>
#include <omp.h>
#include <openssl/evp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define bmp_header 54
#define blk        16

/* ────────────── helper: encrypt/decrypt a buffer ───────────── */
static int aes_buffer(unsigned char *buf, size_t len,
                      const unsigned char *key,
                      int encrypt,
                      int ecb)
{
    if (len % blk != 0) {
        fprintf(stderr, "buffer length must be multiple of %d\n", blk);
        return -1;
    }

    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    if (!ctx) return -1;

    // choose cipher type based on ecb flag
    const EVP_CIPHER *cipher = ecb ? EVP_aes_128_ecb() : EVP_aes_128_cbc();
    unsigned char iv[blk] = {0};

    // initialize cipher context
    if (!EVP_CipherInit_ex(ctx, cipher, NULL, NULL, NULL, encrypt)) {
        EVP_CIPHER_CTX_free(ctx);
        return -1;
    }

    // set key length
    if (!EVP_CIPHER_CTX_set_key_length(ctx, blk)) {
        EVP_CIPHER_CTX_free(ctx);
        return -1;
    }

    // set key and iv (iv only if cbc)
    if (!EVP_CipherInit_ex(ctx, NULL, NULL, key, ecb ? NULL : iv, encrypt)) {
        EVP_CIPHER_CTX_free(ctx);
        return -1;
    }

    // disable padding (bmp data length is multiple of block size)
    EVP_CIPHER_CTX_set_padding(ctx, 0);

    int out_len1 = 0, out_len2 = 0;
    unsigned char *outbuf = malloc(len);
    if (!outbuf) {
        EVP_CIPHER_CTX_free(ctx);
        return -1;
    }

    // update cipher with input buffer
    if (!EVP_CipherUpdate(ctx, outbuf, &out_len1, buf, (int)len)) {
        free(outbuf);
        EVP_CIPHER_CTX_free(ctx);
        return -1;
    }

    // finalize cipher operation
    if (!EVP_CipherFinal_ex(ctx, outbuf + out_len1, &out_len2)) {
        free(outbuf);
        EVP_CIPHER_CTX_free(ctx);
        return -1;
    }

    // copy encrypted/decrypted data back to buffer
    memcpy(buf, outbuf, len);

    free(outbuf);
    EVP_CIPHER_CTX_free(ctx);
    return 0;
}

/* ────────────────────────────────────────────────────────────── */
int main(int argc, char **argv)
{
    if (argc != 6) {
        fprintf(stderr,
            "usage: %s <src.bmp> <dst.bmp> <key[<=16b]> <encrypt|decrypt> <ecb|cbc>\n",
            argv[0]);
        return 1;
    }

    /* ─── parse cli arguments ────────────────────────────── */
    const char *src = argv[1], *dst = argv[2];
    unsigned char key[blk] = {0};
    size_t keylen = strlen(argv[3]);
    if (keylen > blk) keylen = blk;
    memcpy(key, argv[3], keylen);

    const int enc = strcmp(argv[4], "encrypt") == 0;
    const int dec = strcmp(argv[4], "decrypt") == 0;
    if (!enc && !dec) { fputs("arg4 must be encrypt|decrypt\n", stderr); return 1; }

    const int ecb = strcmp(argv[5], "ECB") == 0;
    const int cbc = strcmp(argv[5], "CBC") == 0;
    if (!ecb && !cbc) { fputs("arg5 must be ECB|CBC\n", stderr); return 1; }

    /* ─── initialize mpi ─────────────────────────────────── */
    MPI_Init(&argc, &argv);
    int rank, nprocs;
    MPI_Comm_rank(MPI_COMM_WORLD,&rank);
    MPI_Comm_size(MPI_COMM_WORLD,&nprocs);

    /* ─── rank 0 reads entire bmp file ───────────────────── */
    uint64_t fsize = 0;
    unsigned char *file = NULL;

    if (rank == 0) {
        FILE *fp = fopen(src, "rb");
        if (!fp) { perror("fopen"); MPI_Abort(MPI_COMM_WORLD, 2); }

        fseek(fp, 0, SEEK_END);
        fsize = ftell(fp);
        rewind(fp);

        if (fsize < bmp_header) { fprintf(stderr,"bmp too small\n"); MPI_Abort(MPI_COMM_WORLD, 3); }

        file = malloc(fsize);
        if (!file) { fprintf(stderr,"malloc failed\n"); MPI_Abort(MPI_COMM_WORLD, 4); }
        fread(file, 1, fsize, fp);
        fclose(fp);
    }

    /* ─── broadcast file size to all ranks ─────────────── */
    MPI_Bcast(&fsize, 1, MPI_UINT64_T, 0, MPI_COMM_WORLD);

    if (fsize < bmp_header) {
        if (rank == 0) fprintf(stderr, "file too small\n");
        MPI_Finalize();
        return 1;
    }

    const uint64_t payload = fsize - bmp_header;   /* pixel data only */

    // adjust payload to multiple of block size
    uint64_t adjusted_payload = payload - (payload % blk);

    /* ─── calculate counts and displacements for scatterv ───────────── */
    int *counts = malloc(nprocs * sizeof(int));
    int *displs = malloc(nprocs * sizeof(int));

    uint64_t base = adjusted_payload / nprocs;
    uint64_t rest = adjusted_payload % nprocs;

    for (int i = 0; i < nprocs; ++i) {
        uint64_t c = base + (i < rest ? 1 : 0);
        c -= c % blk; // align to 16 bytes multiple
        counts[i] = (int)c;
    }
    displs[0] = 0;
    for (int i = 1; i < nprocs; ++i)
        displs[i] = displs[i-1] + counts[i-1];

    /* ─── allocate local buffer for each rank ───────────── */
    int mycount = counts[rank];
    unsigned char *local = mycount ? malloc(mycount) : malloc(1);   /* ensure valid ptr */

    /* ─── scatter pixel data to all ranks ───────────────── */
    unsigned char *pix_global = (rank==0) ? (file + bmp_header) : NULL;
    MPI_Scatterv(pix_global, counts, displs, MPI_BYTE,
                 local, mycount, MPI_BYTE,
                 0, MPI_COMM_WORLD);

    /* ─── encrypt/decrypt local buffer ─────────────────── */
    if (mycount) {
        if (ecb) {
#pragma omp parallel
            {
                int tid_blocks = mycount / blk;
#pragma omp for schedule(static)
                for (int b = 0; b < tid_blocks; ++b)
                    aes_buffer(local + b*blk, blk, key, enc, 1);
            }
        } else {            /* cbc – single call for entire local buffer */
            if (mycount % blk != 0) {
                fprintf(stderr, "rank %d: cbc buffer length must be multiple of 16\n", rank);
                MPI_Abort(MPI_COMM_WORLD, 5);
            }
            aes_buffer(local, mycount, key, enc, 0);
        }
    }

    /* ─── gather processed pixels back to rank 0 ───────── */
    MPI_Gatherv(local, mycount, MPI_BYTE,
                pix_global, counts, displs, MPI_BYTE,
                0, MPI_COMM_WORLD);

    /* ─── rank 0 writes output bmp file ─────────────────── */
    if (rank == 0) {
        // if original payload had extra bytes beyond multiple of blk, copy them unchanged
        memcpy(file + bmp_header + adjusted_payload,
               pix_global + adjusted_payload,
               payload - adjusted_payload);

        FILE *fo = fopen(dst, "wb");
        if (!fo) { perror("fopen output"); MPI_Abort(MPI_COMM_WORLD, 6); }
        fwrite(file, 1, fsize, fo);
        fclose(fo);
        free(file);
    }

    free(local);
    free(counts);
    free(displs);

    MPI_Finalize();
    return 0;
}
