-- create database if it doesn't exist (mysql)
CREATE DATABASE IF NOT EXISTS imagesdb;

-- switch to the imagesdb database (mysql)
USE imagesdb;

-- create table for images metadata if it doesn't exist (mysql)
CREATE TABLE IF NOT EXISTS images_meta (
  id VARCHAR(24) PRIMARY KEY,  -- unique id for each image (string, max 24 chars)
  name VARCHAR(255),           -- image name
  op VARCHAR(16),              -- operation type (e.g. encrypt/decrypt)
  mode VARCHAR(16),            -- mode used (e.g. ECB/CBC)
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- timestamp of record insertion
);
