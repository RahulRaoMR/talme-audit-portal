import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { AuditError, auditSecondaryClass } from "../components/AuditUi";
export type PortalNotification = { id: string; title: string; message: string; href: string; readAt: string | null; createdAt: string };
export function NotificationsPage() {
  const navigate = useNavigate(); const [notifications, setNotifications] = useState<PortalNotification[]>([]); const [unread, setUnread] = useState(0); const [error, setError] = useState("");
  async function load() { const result = await apiRequest<{ notifications: PortalNotification[]; unread: number }>("/notifications"); setNotifications(result.notifications); setUnread(result.unread); }
  useEffect(() => { void load().catch((caught: Error) => setError(caught.message)); }, []);
  async function open(item: PortalNotification) { try { await apiRequest(`/notifications/${item.id}/read`, { method: "POST" }); navigate(item.href); } catch (caught) { setError((caught as Error).message); } }
  return <div className="mx-auto max-w-4xl space-y-5"><header className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Notifications</h1><p className="mt-1 text-sm text-slate-500">{unread} unread · Audit assignments, CAPA reviews and due dates</p></div><button className={auditSecondaryClass} onClick={() => void load().catch((caught: Error) => setError(caught.message))}>Refresh</button></header><AuditError error={error} /><section className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">{notifications.map((item) => <button key={item.id} onClick={() => void open(item)} className={`block w-full p-5 text-left hover:bg-slate-50 ${item.readAt ? "" : "border-l-4 border-l-brand-600 bg-blue-50/30"}`}><div className="flex flex-wrap justify-between gap-3"><h2 className="text-sm font-semibold">{item.title}</h2><time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></div><p className="mt-2 text-sm text-slate-600">{item.message}</p></button>)}{!notifications.length ? <p className="p-10 text-center text-sm text-slate-500">No notifications yet. Assignments and review decisions will appear here.</p> : null}</section></div>;
}
