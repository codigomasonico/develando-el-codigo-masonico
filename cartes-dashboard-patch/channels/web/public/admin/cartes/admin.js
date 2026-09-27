const ENDPOINTS = Object.freeze({
  login: "/.netlify/functions/cartes-admin-login",
  logout: "/.netlify/functions/cartes-admin-logout",
  stats: "/.netlify/functions/cartes-admin-stats"
});

let stats = null;
const $ = (s) => document.querySelector(s);
const loginView = $("#loginView");
const panelView = $("#panelView");
const loginForm = $("#loginForm");
const passwordInput = $("#adminPassword");
const loginError = $("#loginError");
const panelMessage = $("#panelMessage");

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 401) {
    showLogin();
    throw new Error("Sesión expirada.");
  }
  if (!response.ok || !payload?.ok) throw new Error(payload?.message || `Error ${response.status}`);
  return payload;
}

function showLogin() {
  panelView.hidden = true;
  loginView.hidden = false;
  passwordInput.value = "";
  setTimeout(() => passwordInput.focus(), 30);
}
function showPanel() { loginView.hidden = true; panelView.hidden = false; }
function fmtDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function esc(v) { return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function setText(id, value) { $(id).textContent = String(value ?? 0); }

function bars(container, entries) {
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0) || 1;
  container.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <span class="bar-label">${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, value / total * 100))}%"></div></div>
      <span class="bar-value">${esc(value)}</span>
    </div>`).join("");
}

function renderChart(days) {
  const max = Math.max(1, ...days.map((d) => Number(d.queries || 0)));
  $("#dailyChart").innerHTML = days.map((d) => {
    const h = Math.max(2, Math.round((Number(d.queries || 0) / max) * 100));
    return `<div class="chart-col" title="${esc(d.date)}: ${esc(d.queries)} consultas"><div class="chart-bar" style="height:${h}%"></div></div>`;
  }).join("");
}

function renderUsers() {
  const q = $("#userSearch").value.trim().toLowerCase();
  const rows = (stats?.users || []).filter((u) => !q || String(u.user_id).toLowerCase().includes(q));
  $("#usersBody").innerHTML = rows.map((u) => `
    <tr>
      <td><code>${esc(u.user_id)}</code></td>
      <td><span class="chip">${esc(u.plan)}</span></td>
      <td>${esc((u.channels || []).join(", ") || "—")}</td>
      <td>${esc(u.queries)}</td>
      <td>${esc(u.current_cycle_used)} / ${esc(u.current_cycle_limit)}</td>
      <td>${esc(fmtDate(u.last_activity))}</td>
    </tr>`).join("") || '<tr><td colspan="6">No hay usuarios que coincidan.</td></tr>';
}

function render() {
  const s = stats.summary;
  setText("#statUsers", s.users_total);
  setText("#statToday", s.active_today);
  setText("#stat7", s.active_7d);
  setText("#stat30", s.active_30d);
  setText("#statQueriesToday", s.queries_today);
  setText("#statQueries7", s.queries_7d);
  setText("#statQueries30", s.queries_30d);
  setText("#statAvg", s.avg_queries_per_active_30d);
  setText("#reviewsCompleted", s.reviews_completed);
  setText("#reviewsPending", s.reviews_pending);
  $("#generatedAt").textContent = `Actualizado ${fmtDate(stats.generated_at)}`;
  bars($("#channels"), [["Web", stats.channels.web], ["WhatsApp", stats.channels.whatsapp], ["Otros", stats.channels.unknown]]);
  bars($("#plans"), [["Free", stats.plans.gratuito], ["Plus", stats.plans.plus]]);
  const f = stats.consumption.gratuito;
  bars($("#freeConsumption"), [["0", f["0"]], ["1", f["1"]], ["2-5", f["2-5"]], ["6-9", f["6-9"]], ["Límite", f.limit]]);
  renderChart(stats.daily || []);
  renderUsers();
  $("#notes").innerHTML = (stats.notes || []).map((n) => `<p>${esc(n)}</p>`).join("");
}

async function loadStats() {
  panelMessage.hidden = true;
  try {
    const payload = await api(ENDPOINTS.stats);
    stats = payload.stats;
    showPanel();
    render();
  } catch (error) {
    if (!loginView.hidden) return;
    panelMessage.textContent = error.message;
    panelMessage.className = "message message--error";
    panelMessage.hidden = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  try {
    await api(ENDPOINTS.login, { method: "POST", body: JSON.stringify({ password: passwordInput.value }) });
    await loadStats();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  }
});
$("#refreshButton").addEventListener("click", loadStats);
$("#logoutButton").addEventListener("click", async () => {
  try { await api(ENDPOINTS.logout, { method: "POST", body: "{}" }); } catch {}
  showLogin();
});
$("#userSearch").addEventListener("input", renderUsers);
loadStats();
