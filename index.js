const puppeteer = require("puppeteer");
const moment = require("moment"); // Install using: npm install moment

function formatDate(dateString) {
  return moment(dateString, [
    "MMMM D, YYYY",
    "D-M-YYYY",
    "YYYY/M/D",
    "YYYY-MM-DD",
    "D MMM YYYY",
  ]).format("MMDDYYYY");
}

async function scrapeHotelPrices({
  cityName,
  cityCode,
  checkin,
  checkout,
  starRating, // New parameter for filtering by star rating
  targetHotelCount = 50,
}) {
  try {
    const today = moment().format("MMDDYYYY");
    checkin = checkin ? formatDate(checkin) : today;
    checkout = checkout
      ? formatDate(checkout)
      : moment(checkin, "MMDDYYYY").add(1, "day").format("MMDDYYYY");

    // Constructing the URL with star rating filter
    let starFilter = starRating
      ? `&filterData=STAR_RATING%7C${starRating}`
      : "";

    const url = `https://www.makemytrip.com/hotels/hotel-listing/?checkin=${checkin}&checkout=${checkout}&city=${cityCode}&country=IN&locusId=${cityCode}&locusType=city&regionNearByExp=3&roomStayQualifier=2e0e&rsc=1e2e0e&searchText=${encodeURIComponent(
      cityName
    )}${starFilter}&sort=reviewRating-desc`;

    console.log(
      `🚀 Launching browser for ${cityName} (${
        starRating || "All"
      }-star hotels)...`
    );
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    console.log("🌐 Navigating to MakeMyTrip homepage...");
    await page.goto("https://www.makemytrip.com/", {
      waitUntil: "domcontentloaded",
    });

    console.log("🧹 Closing login popup...");
    await page.keyboard.press("Escape");
    await new Promise((res) => setTimeout(res, 3000));

    console.log("🏨 Navigating to hotel listings page...");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

    console.log("🔍 Waiting for hotel listings to load...");
    await page.waitForSelector("div.listingRowOuter", { timeout: 15000 });

    let previousCount = 0;
    let prices = [];
    let retries = 0;

    while (prices.length < targetHotelCount && retries < 3) {
      console.log("📜 Scrolling to bottom...");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      console.log(`⏳ Waiting for new hotels to load... (Retry: ${retries})`);
      await new Promise((res) => setTimeout(res, 3000));

      const newPrices = await page.evaluate(() => {
        const cards = Array.from(
          document.querySelectorAll("div.listingRowOuter")
        );
        return cards
          .map((card) => {
            const priceEl = card.querySelector("p.priceText");
            return priceEl
              ? parseInt(priceEl.textContent.replace(/[^\d]/g, ""))
              : null;
          })
          .filter((p) => p !== null);
      });

      prices = newPrices;
      console.log(`🏨 Found ${prices.length} hotels so far...`);

      if (prices.length === previousCount) {
        retries++;
      } else {
        retries = 0;
      }

      previousCount = prices.length;
    }

    const average =
      prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    console.log(`✅ Fetched ${prices.length} prices`);
    console.log(
      `📊 Average price of ${
        starRating || "all"
      }-star hotels in ${cityName}: ₹${Math.round(average)}`
    );

    console.log("🛑 Closing browser...");
    await browser.close();
  } catch (error) {
    console.log("❌ Something went wrong:", error.message);
  }
}

// Example usage with different star ratings
scrapeHotelPrices({
  cityName: "Pune",
  cityCode: "CTPUN",
  checkin: "March 27, 2025",
  checkout: "March 28, 2025",
  starRating: 3, // Fetch only 3-star hotels
  targetHotelCount: 50,
});
