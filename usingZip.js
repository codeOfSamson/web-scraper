import express from "express";
import { chromium } from "playwright";
import fs from "fs-extra";
import path from "path";
import AdmZip from "adm-zip";
import csv from "csv-parser";

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOAD_DIR = path.join(__dirname, "downloads");

// Ensure the download directory exists
fs.ensureDirSync(DOWNLOAD_DIR);

app.get("/scrape-data", async (req, res) => {
  const keyword = req.query.keyword || "default";
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto("https://example.gov/search"); // Replace with the actual URL
    await page.fill("input[name='search']", keyword);
    await page.click("button[type='submit']");
    
    // Wait for results to load
    await page.waitForSelector("text=檢視資料");
    const firstResult = await page.getByRole("button", { name: "檢視資料" }).nth(1);
    await firstResult.click();
    
    // Wait for download link and click it
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("a[download]"), // Adjust selector if necessary
    ]);

    // Save ZIP file
    const zipPath = path.join(DOWNLOAD_DIR, download.suggestedFilename());
    await download.saveAs(zipPath);
    console.log("Downloaded ZIP:", zipPath);

    // Extract ZIP file
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(DOWNLOAD_DIR, true);
    console.log("ZIP extracted to:", DOWNLOAD_DIR);

    // Find the first CSV file inside
    const extractedFiles = fs.readdirSync(DOWNLOAD_DIR);
    const csvFile = extractedFiles.find(file => file.endsWith(".csv"));
    if (!csvFile) throw new Error("No CSV file found in ZIP");

    const csvPath = path.join(DOWNLOAD_DIR, csvFile);
    console.log("Found CSV:", csvPath);

    // Read CSV and send response
    const results = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => res.json(results));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    await browser.close();
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
