// newsModel.js
const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  index: Number,
    site: String,
    title: String,
    description: String,
    image: String,
    author: String,
    date: String,
});

const News = mongoose.model('News', newsSchema);

module.exports = News;
