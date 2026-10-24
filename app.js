/*
  SETUP:
  1. Replace the URL and Publishable Key below.
  2. Never put a service_role or secret key in browser JavaScript.
*/

const SUPABASE_URL = "https://qkvbukohbmvrgrznerkg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KAXWhjHYNEAlL1UV0O-ibw_r-sMzPbc";

const newsList = document.getElementById("news-list");
document.getElementById("year").textContent = new Date().getFullYear();

if (
  SUPABASE_URL === "https://qkvbukohbmvrgrznerkg.supabase.co" ||
  SUPABASE_PUBLISHABLE_KEY === "sb_publishable_KAXWhjHYNEAlL1UV0O-ibw_r-sMzPbc"
) {
  showMessage(
    "error-message",
    "Setup required: Add your Supabase Project URL and Publishable Key in app.js."
  );
} else {
  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
  loadNews(supabaseClient);
}

function showMessage(className, message) {
  newsList.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = message;
  newsList.appendChild(paragraph);
}

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short"
  });
}

async function loadNews(client) {
  showMessage("loading", "Loading news...");

  const { data, error } = await client
    .from("news")
    .select("id, title, content, image_path, created_at, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase news error:", error);
    showMessage(
      "error-message",
      "Could not load news. Check your Supabase URL, key, news table, and security policies."
    );
    return;
  }

  newsList.replaceChildren();

  if (!data || data.length === 0) {
    showMessage("empty-message", "No news has been published yet.");
    return;
  }

  for (const news of data) {
    const card = document.createElement("article");
    card.className = "news-card";

    if (news.image_path) {
      const { data: imageData, error: imageError } = await client.storage
        .from("news-images")
        .createSignedUrl(news.image_path, 3600);

      if (!imageError && imageData && imageData.signedUrl) {
        const image = document.createElement("img");
        image.className = "news-image";
        image.src = imageData.signedUrl;
        image.alt = news.title || "News image";
        image.loading = "lazy";
        card.appendChild(image);
      } else {
        console.error("Supabase image error:", imageError);
      }
    }

    const content = document.createElement("div");
    content.className = "news-content";

    const title = document.createElement("h2");
    title.textContent = news.title || "Untitled";

    const date = document.createElement("div");
    date.className = "news-date";
    date.textContent = "Published: " +
      formatDate(news.published_at || news.created_at);

    const text = document.createElement("div");
    text.className = "news-text";
    text.textContent = news.content || "";

    content.append(title, date, text);
    card.appendChild(content);
    newsList.appendChild(card);
  }
}
