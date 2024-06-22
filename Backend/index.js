const express = require('express');
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
require('dotenv').config()

const app = express();
const port = process.env.PORT;
const mongoUri = process.env.MONGODB_URI;

// MongoDB connection
mongoose.connect(mongoUri);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define a schema for the articles
const articleSchema = new mongoose.Schema({
    index: Number,
    site: String,
    headline: String,
    description: String,
    image: String,
    author: String,
    date: String,
});

const Article = mongoose.model('Article', articleSchema);

// Hardcoded URLs and their respective selectors for eye care news websites
const newsSites = {
    'aao.org': {
        url: process.env.FETCH_URI_1,
        selectors: {
            headline: 'div.cms_Chrome div.title > a',
            description: 'div.cms_Chrome div.description',
            author: 'div.cms_Chrome div.citation > a',
            image: 'div.cms_Chrome div.pull-right > a > img',
            date: 'div.cms_Chrome div.citation > span',
        },
    },
};

// Helper function to scrape a news page
const scrapeNews = async (siteName, siteConfig) => {
    const { url, selectors } = siteConfig;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    let articles = [];

    try {
        const headlines = await page.$$eval(selectors.headline, (elements) => elements.map((el) => el.innerText));
        const descriptions = await page.$$eval(selectors.description, (elements) => elements.map((el) => el.innerText));
        const authors = await page.$$eval(selectors.author, (elements) => elements.map((el) => el.innerText));
        const images = await page.$$eval(selectors.image, (elements) => elements.map((el) => el.getAttribute('src')));
        const dates = await page.$$eval(selectors.date, (elements) => elements.map((el) => el.innerText));

        await Article.deleteMany({ site: siteName });

        for (let i = 0; i < headlines.length; i++) {
            const article = new Article({
                index: i + 1,
                site: siteName,
                headline: headlines[i],
                description: descriptions[i],
                image: images[i],
                author: authors[i] || 'Author not found',
                date: dates[i] || 'Date not found',
            });
            await article.save();
            articles.push(article);
        }
    } catch (error) {
        console.error('Error extracting data:', error);
    }

    await browser.close();
    return { url, articles };
};

// Function to scrape news for all sites
const scrapeAllNews = async () => {
    try {
        const results = await Promise.all(
            Object.entries(newsSites).map(([siteName, siteConfig]) => scrapeNews(siteName, siteConfig))
        );
        console.log('Scraping completed:', new Date());
    } catch (error) {
        console.error('Error scraping news:', error);
    }
};

// Initial scraping when server starts
scrapeAllNews();

const scrapeInterval = 60 * 60 * 1000; // 10 minutes in milliseconds
setInterval(() => {
    scrapeAllNews();
}, scrapeInterval);

// Endpoint to check status (optional)
app.get('/', (req, res) => {
    res.json({'status':'Server is running and scraping news periodically.'});
});

app.get('/allnews', async(req, res) => {
    const response = await Article.find({})
    res.json(response);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
