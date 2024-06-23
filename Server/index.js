const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cheerio = require("cheerio");
const News = require("./models/newsModel.js");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Configuration for each site
const sitesConfig = [
  {
    url: "https://www.aao.org/eye-health/news-list",
    selectors: {
      item: ".cms_Chrome",
      title: ".title",
      description: ".description",
      author: ".citation a",
      image: ".pull-right a img",
      date: ".citation span",
    },
  },
];

const scrapeNewsFromSite = async (siteConfig, indexOffset = 0) => {
  try {
    const { data } = await axios.get(siteConfig.url);
    const $ = cheerio.load(data);

    const newsItems = [];
    $(siteConfig.selectors.item).each((i, element) => {
      const index = i + 1 + indexOffset;
      const title = $(element).find(siteConfig.selectors.title).text().trim();
      const description = $(element).find(siteConfig.selectors.description).text().trim();
      const author = $(element).find(siteConfig.selectors.author).text().trim();
      const image = $(element).find(siteConfig.selectors.image).attr("src");
      const date = $(element).find(siteConfig.selectors.date).text().trim();

      newsItems.push({
        index,
        site: siteConfig.url,
        title,
        description,
        author,
        image,
        date,
      });
    });

    await News.insertMany(newsItems);
  } catch (error) {
    console.error(`Error scraping news from ${siteConfig.url}:`, error);
  }
};

// Function to scrape the news websites
const scrapeNews = async () => {
  try {
    await News.deleteMany({}); // Clear the database once before starting the scrape

    let indexOffset = 0;
    for (const siteConfig of sitesConfig) {
      await scrapeNewsFromSite(siteConfig, indexOffset);
      indexOffset += 1000; // Adjust the offset to ensure unique indexes for each site
    }

    const currentTimeStamp = Date.now();
    const currentDate = new Date(currentTimeStamp);
    console.log(currentDate.toString());
  } catch (error) {
    console.error("Error scraping news:", error);
  }
};

scrapeNews();

const scrapeInterval = 60 * 60 * 1000; // 1 hour in milliseconds
setInterval(scrapeNews, scrapeInterval);

app.get("/scrape", async (req, res) => {
  await scrapeNews();
  res.send("Scraping in progress...");
});

app.get("/", async (req, res) => {
  const allnews = await News.find({});
  allnews.sort((a, b) => a.index - b.index);
  if (allnews.length) {
    return res.status(200).json(allnews);
  }
  return res.status(200).json({ Sorry: "There are no news at this moment" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
