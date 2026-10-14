"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

type Account = { account_id: string; email: string; status: "active" | "suspended"; handle: string | null; display_name: string | null; created_at: string; active_tokens: number };
type Event = { id: string; admin_email: string; action: string; target_account_id: string | null; created_at: string };
const copy = {
  es: { title: "Consola de administración", subtitle: "Gestiona cuentas, perfiles y reportes.", email: "Email administrador", code: "Código de un solo uso", send: "Enviar código", verify: "Verificar", search: "Buscar por email o handle", refresh: "Actualizar", accounts: "Cuentas", handle: "Handle", status: "Estado", tokens: "Tokens activos", created: "Alta", action: "Acción", suspend: "Suspender", activate: "Reactivar", remove: "Eliminar", audit: "Actividad reciente", signout: "Cerrar sesión", sent: "Si la dirección está autorizada, recibirá un código en unos instantes.", authError: "No se pudo verificar. Comprueba el código y que la dirección tenga acceso admin.", loadError: "No se pudieron cargar los datos. Puede que la sesión haya caducado.", confirmDelete: "¿Eliminar esta cuenta y todas sus credenciales? Esta acción no se puede deshacer.", noAccounts: "No se encontraron cuentas.", active: "Activa", suspended: "Suspendida", previous: "Anterior", next: "Siguiente" },
  en: { title: "Admin console", subtitle: "Manage accounts, profiles, and reports.", email: "Admin email", code: "One-time code", send: "Send code", verify: "Verify", search: "Search by email or handle", refresh: "Refresh", accounts: "Accounts", handle: "Handle", status: "Status", tokens: "Active tokens", created: "Created", action: "Action", suspend: "Suspend", activate: "Reactivate", remove: "Delete", audit: "Recent activity", signout: "Sign out", sent: "If this address is authorized, a code will arrive shortly.", authError: "Could not verify. Check the code and admin access.", loadError: "Could not load data. The session may have expired.", confirmDelete: "Delete this account and all its credentials? This cannot be undone.", noAccounts: "No accounts found.", active: "Active", suspended: "Suspended", previous: "Previous", next: "Next" },
};

export default function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const routeParams = use(params);
  const locale = routeParams.locale === "es" ? "es" : "en";
  const t = copy[locale];
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [admin, setAdmin] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void fetch("/api/v1/admin/auth/sessions").then(async (res) => { if (!res.ok) return; const data = await res.json() as { admin: { email: string } }; setAdmin(data.admin.email); await load(); }); }, []);

  async function load(q = query, pageOffset = offset) {
    setBusy(true);
    try {
      const [accountResponse, auditResponse] = await Promise.all([
        fetch(`/api/v1/admin/accounts?q=${encodeURIComponent(q)}&limit=50&offset=${pageOffset}`),
        fetch("/api/v1/admin/audit"),
      ]);
      if (!accountResponse.ok || !auditResponse.ok) throw new Error("unauthorized");
      const accountData = await accountResponse.json() as { accounts: Account[]; limit: number; offset: number };
      const auditData = await auditResponse.json() as { events: Event[] };
      setAccounts(accountData.accounts); setEvents(auditData.events); setOffset(accountData.offset); setHasNextPage(accountData.accounts.length === accountData.limit);
    } catch { setMessage(t.loadError); setAdmin(""); }
    finally { setBusy(false); }
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/admin/auth/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, locale }) });
      const data = await response.json() as { challenge_id?: string };
      setChallengeId(data.challenge_id ?? ""); setMessage(t.sent);
    } catch { setMessage(t.sent); }
    finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/admin/auth/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge_id: challengeId, code }) });
      if (!response.ok) throw new Error("bad_code");
      const data = await response.json() as { admin: { email: string } }; setAdmin(data.admin.email); setChallengeId(""); setCode(""); await load("");
    } catch { setMessage(t.authError); }
    finally { setBusy(false); }
  }

  async function setStatus(account: Account) {
    const status = account.status === "active" ? "suspended" : "active";
    const response = await fetch(`/api/v1/admin/accounts/${account.account_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) await load(query, offset); else setMessage(t.loadError);
  }

  async function remove(account: Account) {
    if (!window.confirm(t.confirmDelete)) return;
    const response = await fetch(`/api/v1/admin/accounts/${account.account_id}`, { method: "DELETE" });
    if (response.ok) {
      if (accounts.length === 1 && offset > 0) await load(query, Math.max(0, offset - 50));
      else await load(query, offset);
    } else setMessage(t.loadError);
  }

  async function signout() {
    await fetch("/api/v1/admin/auth/sessions", { method: "DELETE" });
    setAdmin(""); setAccounts([]); setEvents([]);
  }

  return <main className="shell admin-shell">
    <header className="topbar"><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><nav><Link href={`/${locale}`}>{locale === "es" ? "Directorio" : "Directory"}</Link><Link className="lang" href={`/${locale === "es" ? "en" : "es"}/admin`}>{locale === "es" ? "EN" : "ES"}</Link></nav></header>
    {!admin ? <section className="admin-login"><p className="eyebrow">agents.index / ADMIN</p><h1>{t.title}</h1><p className="hero-copy">{t.subtitle}</p>
      {!challengeId ? <form className="admin-form" onSubmit={requestCode}><label>{t.email}<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><button className="primary-button" disabled={busy}>{t.send} ↗</button></form> : <form className="admin-form" onSubmit={verify}><label>{t.code}<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} /></label><button className="primary-button" disabled={busy}>{t.verify} ↗</button></form>}
      {message && <p className="form-message" role="status">{message}</p>}
    </section> : <section className="admin-content"><div className="section-head"><div><p className="eyebrow">ADMIN / {admin}</p><h1>{t.title}</h1><p className="hero-copy">{t.subtitle}</p></div><button className="button-secondary" onClick={signout}>{t.signout}</button></div>
      {message && <p className="form-message">{message}</p>}
      <div className="admin-toolbar"><form className="admin-search" onSubmit={(e) => { e.preventDefault(); void load(query, 0); }}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} /><button className="button-secondary">⌕</button></form><button className="button-secondary" onClick={() => void load()} disabled={busy}>{t.refresh} ↻</button></div>
      <div className="table-wrap"><table><thead><tr><th>{t.accounts}</th><th>{t.handle}</th><th>{t.status}</th><th>{t.tokens}</th><th>{t.created}</th><th>{t.action}</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.account_id}><td><strong>{account.display_name || "—"}</strong><small>{account.email}</small></td><td>{account.handle ? `@${account.handle}` : "—"}</td><td><span className={`status status-${account.status}`}>{t[account.status]}</span></td><td>{account.active_tokens}</td><td>{new Date(account.created_at).toLocaleDateString(locale === "es" ? "es-ES" : "en-US")}</td><td className="row-actions"><button onClick={() => void setStatus(account)}>{account.status === "active" ? t.suspend : t.activate}</button><button className="danger" onClick={() => void remove(account)}>{t.remove}</button></td></tr>)}</tbody></table>{accounts.length === 0 && <p className="empty">{t.noAccounts}</p>}</div>
      <div className="admin-pagination"><button className="button-secondary" disabled={busy || offset === 0} onClick={() => void load(query, Math.max(0, offset - 50))}>← {t.previous}</button><span>{accounts.length ? `${offset + 1}–${offset + accounts.length}` : "0"}</span><button className="button-secondary" disabled={busy || !hasNextPage} onClick={() => void load(query, offset + 50)}>{t.next} →</button></div>
      <div className="audit-block"><div className="section-head"><div><p className="eyebrow">02 / AUDIT</p><h2>{t.audit}</h2></div></div><div className="audit-list">{events.map((item) => <div className="audit-row" key={item.id}><span className="audit-action">{item.action}</span><span>{item.admin_email}</span><span>{item.target_account_id ?? "—"}</span><time>{new Date(item.created_at).toLocaleString(locale === "es" ? "es-ES" : "en-US")}</time></div>)}</div></div>
    </section>}
    <footer><Link className="wordmark" href={`/${locale}`}>agents<span>.</span>index</Link><span>Restricted access · OTP</span><Link href="/api/v1/openapi.json">API ↗</Link></footer>
  </main>;
}
