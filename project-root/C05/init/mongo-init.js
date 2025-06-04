// switch to the imagesdb database (mongodb)
db = db.getSiblingDB('imagesdb');

// create collections for files and chunks (mongodb)
db.createCollection('fs.files');
db.createCollection('fs.chunks');
