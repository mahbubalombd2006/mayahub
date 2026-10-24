/*
  Replace the URL and Publishable Key below.
  Never put a service_role/secret key in browser JavaScript.
  Real security depends on Supabase Auth and RLS policies.
*/
const SUPABASE_URL = "https://qkvbukohbmvrgrznerkg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KAXWhjHYNEAlL1UV0O-ibw_r-sMzPbc";
const BUCKET_NAME = "news-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const loginSection = document.getElementById("login-section");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const newsForm = document.getElementById("news-form");
const newsMessage = document.getElementById("news-message");
const newsItems = document.getElementById("news-items");
const titleInput = document.getElementById("news-title");
const contentInput = document.getElementById("news-content");
const imageInput = document.getElementById("news-image");
const publishButton = document.getElementById("publish-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const formHeading = document.getElementById("form-heading");

let client = null;
let currentUserId = null;
let editingArticle = null;

function setMessage(el, message, kind = "") {
  el.textContent = message;
  el.className = "message" + (kind ? " " + kind : "");
}
function configured() {
  return SUPABASE_URL.startsWith("https://") &&
    SUPABASE_URL.endsWith(".supabase.co") &&
    SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
}
function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-100) || "news-image";
}
function formatDate(value) {
  if (!value) return "Not published";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Date unavailable" :
    d.toLocaleString("en-GB", { dateStyle:"medium", timeStyle:"short" });
}
async function checkSession() {
  const { data, error } = await client.auth.getSession();
  if (error) console.error(error);
  if (data.session) {
    currentUserId = data.session.user.id;
    await showDashboard();
  } else {
    currentUserId = null;
    loginSection.hidden = false;
    dashboard.hidden = true;
  }
}
async function showDashboard() {
  loginSection.hidden = true;
  dashboard.hidden = false;
  setMessage(loginMessage, "");
  await loadArticles();
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) {
    setMessage(loginMessage, "Setup required: Add the Supabase URL and Publishable Key in admin.js.", "error");
    return;
  }
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, "Signing in...");
  const { data, error } = await client.auth.signInWithPassword({
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  });
  button.disabled = false;
  if (error) {
    setMessage(loginMessage, error.message, "error");
    return;
  }
  currentUserId = data.user.id;
  await showDashboard();
});
document.getElementById("logout-button").addEventListener("click", async () => {
  if (client) await client.auth.signOut();
  currentUserId = null;
  editingArticle = null;
  newsForm.reset();
  dashboard.hidden = true;
  loginSection.hidden = false;
  setMessage(loginMessage, "You have been signed out.", "success");
});
document.getElementById("refresh-button").addEventListener("click", loadArticles);
cancelEditButton.addEventListener("click", resetForm);

function resetForm() {
  editingArticle = null;
  newsForm.reset();
  imageInput.required = true;
  publishButton.textContent = "Publish News";
  formHeading.textContent = "Publish News";
  cancelEditButton.hidden = true;
  setMessage(newsMessage, "");
}
async function uploadImage(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Image must be 5 MB or smaller.");
  const path = `${currentUserId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await client.storage.from(BUCKET_NAME).upload(path, file, {
    cacheControl:"3600", upsert:false, contentType:file.type
  });
  if (error) throw error;
  return path;
}
newsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client || !currentUserId) {
    setMessage(newsMessage, "Please log in first.", "error");
    return;
  }
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const file = imageInput.files[0];
  if (!title || !content) {
    setMessage(newsMessage, "Title and full news text are required.", "error");
    return;
  }
  if (!editingArticle && !file) {
    setMessage(newsMessage, "Choose an image for this news article.", "error");
    return;
  }
  publishButton.disabled = true;
  setMessage(newsMessage, "Saving news...");
  const wasEditing = Boolean(editingArticle);
  try {
    let imagePath = wasEditing ? editingArticle.image_path : null;
    if (file) imagePath = await uploadImage(file);
    if (!imagePath) throw new Error("News image is required.");
    if (wasEditing) {
      const { error } = await client.from("news").update({
        title, content, image_path:imagePath, status:"published",
        published_at:editingArticle.published_at || new Date().toISOString()
      }).eq("id", editingArticle.id);
      if (error) throw error;
    } else {
      const { error } = await client.from("news").insert({
        title, content, image_path:imagePath, status:"published",
        published_at:new Date().toISOString()
      });
      if (error) throw error;
    }
    resetForm();
    await loadArticles();
    setMessage(newsMessage, wasEditing ? "News updated successfully." : "News published successfully.", "success");
  } catch (error) {
    console.error(error);
    setMessage(newsMessage, error.message || "Could not save news.", "error");
  } finally {
    publishButton.disabled = false;
  }
});
async function imageUrl(path) {
  if (!path) return "";
  const { data, error } = await client.storage.from(BUCKET_NAME).createSignedUrl(path, 3600);
  if (error) { console.error(error); return ""; }
  return data?.signedUrl || "";
}
async function loadArticles() {
  if (!client || !currentUserId) return;
  newsItems.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Loading articles...";
  newsItems.appendChild(loading);
  const { data, error } = await client.from("news")
    .select("id,title,content,image_path,status,created_at,published_at")
    .order("created_at", { ascending:false });
  if (error) {
    console.error(error);
    newsItems.replaceChildren();
    const p = document.createElement("p");
    p.textContent = "Could not load articles. Check your admin RLS policies.";
    newsItems.appendChild(p);
    return;
  }
  newsItems.replaceChildren();
  if (!data || !data.length) {
    const p = document.createElement("p");
    p.textContent = "No articles yet.";
    newsItems.appendChild(p);
    return;
  }
  for (const article of data) {
    const item = document.createElement("article");
    item.className = "news-item";
    const url = await imageUrl(article.image_path);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = article.title || "News image";
      img.loading = "lazy";
      item.appendChild(img);
    }
    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = article.title || "Untitled";
    const meta = document.createElement("p");
    meta.className = "news-meta";
    meta.textContent = `${article.status} · ${formatDate(article.published_at || article.created_at)}`;
    const actions = document.createElement("div");
    actions.className = "news-actions";
    const edit = document.createElement("button");
    edit.type = "button"; edit.className = "secondary-button"; edit.textContent = "Edit";
    edit.addEventListener("click", () => startEdit(article));
    const del = document.createElement("button");
    del.type = "button"; del.className = "danger-button"; del.textContent = "Delete";
    del.addEventListener("click", () => deleteArticle(article));
    actions.append(edit, del);
    details.append(title, meta, actions);
    item.appendChild(details);
    newsItems.appendChild(item);
  }
}
function startEdit(article) {
  editingArticle = article;
  titleInput.value = article.title || "";
  contentInput.value = article.content || "";
  imageInput.value = "";
  imageInput.required = false;
  publishButton.textContent = "Save Changes";
  formHeading.textContent = "Edit News";
  cancelEditButton.hidden = false;
  setMessage(newsMessage, "Editing article. Select a new image only if you want to replace it.");
  window.scrollTo({ top:0, behavior:"smooth" });
}
async function deleteArticle(article) {
  if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
  const { error } = await client.from("news").delete().eq("id", article.id);
  if (error) {
    console.error(error);
    setMessage(newsMessage, error.message || "Could not delete article.", "error");
    return;
  }
  // Old Storage files are not deleted automatically.
  if (editingArticle?.id === article.id) resetForm();
  setMessage(newsMessage, "Article deleted.", "success");
  await loadArticles();
}
if (!configured()) {
  setMessage(loginMessage, "Setup required: Add your Supabase Project URL and Publishable Key in admin.js.", "error");
} else {
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  checkSession();
}
