const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs-extra");
const path = require("path");
const multer = require("multer");
const csv = require("csv-parser");
const { parseStringPromise } = require("xml2js");

const app = express();
const PORT = 3000;
const DOWNLOAD_DIR = path.resolve("./downloads");

// Ensure download directory exists
fs.ensureDirSync(DOWNLOAD_DIR);

// Multer setup (for handling file uploads if needed later)
const upload = multer({ dest: DOWNLOAD_DIR });

/**
 * Scrape government website, search, download file, and return parsed data.
 */
app.get("/scrape-data", async (req, res) => {
  // const { keyword } = req.query;
  // if (!keyword) {
  //   return res.status(400).json({ error: "Keyword query param is required" });
  // }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    // 1. Go to the government website
    await page.goto("https://data.gov.tw/dataset/77051", { waitUntil: "load" });

    // 2. Search for the keyword
    // await page.fill("input[name='search']", keyword);
    // await page.click("button[type='submit']");
    // await page.waitForSelector(".search-results a");

    // 3. Click the first search result
    const buttons = await page.locator('button');
    // const count = await buttons.count();
    // console.log(`Total buttons found: ${count}`);
    
    // for (let i = 0; i < count; i++) {
    //   const text = await buttons.nth(i).textContent();
    //   console.log(`Button ${i}: ${text}`);
    // }

   //const bananna =  await buttons.nth(14).click()
    

    // 4. Click the download link
    const downloadPromise = page.waitForEvent("download");
    await buttons.nth(14).click()
    const download = await downloadPromise;

    // 5. Save the file
    const filePath = path.join(DOWNLOAD_DIR, download.suggestedFilename());
    await download.saveAs(filePath);
      console.log('fp', filePath)
    // 6. Parse and return the file data
    const fileData = await parseFile(filePath);
    res.json({ fileName: path.basename(filePath), data: fileData });

  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await browser.close();
  }
});

/**
 * Parses CSV or XML files into JSON.
 */
async function parseFile(filePath) {
  console.log('123 ,', filePath)
  if (filePath.endsWith(".csv")) {
    return parseCSV(filePath);
  } else if (filePath.endsWith(".xml")) {
    return parseXML(filePath);
  }
  throw new Error("Unsupported file format");
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

async function parseXML(filePath) {
  const xmlData = await fs.readFile(filePath, "utf-8");
  return parseStringPromise(xmlData);
}

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
