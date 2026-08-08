import Link from "next/link";
import { ShieldCheck, Ban, Search, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ActionButton from "../ActionButton";
import ConfirmByName from "../ConfirmByName";
import { setAdmin, setSuspended, deleteAccount } from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  suspended: boolean;
  referral_code: string | null;
  created_at: string;
};

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, is_admin, suspended, referral_code, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`email.ilike.${term},full_name.ilike.${term}`);
  }

  const { data, count, error } = await query;
  const rows: Row[] = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="app-h1">People</h1>
          <p className="app-sub mt-1">
            {count ?? 0} {count === 1 ? "account" : "accounts"}. Grant admin access or
            suspend someone here.
          </p>
        </div>

        {/* Selling in person: build the account and the card here rather than
            talking someone through signing up while they wait. */}
        <Link href="/admin/users/new" className="app-btn app-btn-primary">
          <UserPlus className="h-3.5 w-3.5" />
          Set someone up
        </Link>

        <form method="get" className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="name or email"
              className="app-input w-56 pl-9"
            />
          </div>
          <button
            type="submit"
            className="app-btn app-btn-primary"
          >
            search
          </button>
        </form>
      </div>

      {error && (
        <div className="app-panel app-panel-pad text-[13px] font-medium text-hotpink">
          {error.message}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="app-panel app-panel-pad text-center text-[13px] text-white/35">
          No accounts yet.
        </p>
      ) : (
        <div className="app-panel overflow-x-auto">
          <table className="app-table w-full md:min-w-[760px]">
            <thead className="border-b border-white/8">
              <tr>
                <th>Person</th>
                <th>Referral</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {rows.map((row) => {
                const isMe = row.id === me?.id;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-white/[0.03]">
                    <td data-label="Person">
                      <p className="font-black">
                        <a href={`/admin/users/${row.id}`} className="hover:text-acid">
                          {row.full_name || "—"}
                        </a>
                        {" "}
                        {isMe && (
                          <span className="ml-2 rounded-full border-2 border-white/20 px-2 py-0.5 text-[10px] font-black uppercase text-white/50">
                            you
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-semibold text-white/40">{row.email}</p>
                    </td>
                    <td data-label="Referral" className="font-mono text-xs text-white/50">
                      {row.referral_code ?? "—"}
                    </td>
                    <td data-label="Status">
                      <div className="flex flex-wrap gap-1.5">
                        {row.is_admin && (
                          <span className="flex items-center gap-1 rounded-full border-2 border-ink bg-acid px-2.5 py-1 text-[10px] font-black uppercase text-ink">
                            <ShieldCheck className="h-3 w-3" />
                            admin
                          </span>
                        )}
                        {row.suspended && (
                          <span className="flex items-center gap-1 rounded-full border-2 border-ink bg-hotpink px-2.5 py-1 text-[10px] font-black uppercase text-white">
                            <Ban className="h-3 w-3" />
                            suspended
                          </span>
                        )}
                        {!row.is_admin && !row.suspended && (
                          <span className="text-xs font-bold text-white/35">member</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Joined" className="text-sm font-semibold tabular-nums text-white/45">
                      {new Date(row.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        {/* Typed confirmation, not a confirm() dialog. Granting
                            admin from a table row is one careless tap, and the
                            muscle memory in a list is to hit Enter. */}
                        <ConfirmByName
                          action={async () => {
                            "use server";
                            return setAdmin(row.id, !row.is_admin);
                          }}
                          expected={row.full_name?.trim() || row.email}
                          variant={row.is_admin ? "danger" : "acid"}
                          title={
                            row.is_admin
                              ? "Remove admin access"
                              : "Give full admin access"
                          }
                          body={
                            row.is_admin
                              ? `${row.email} will lose the console, including orders and every customer's details.`
                              : `${row.email} will be able to see every order and customer, change prices, and edit the site.`
                          }
                          cta={row.is_admin ? "Remove access" : "Make admin"}
                        >
                          {row.is_admin ? "revoke admin" : "make admin"}
                        </ConfirmByName>

                        <ConfirmByName
                          action={async () => {
                            "use server";
                            return setSuspended(row.id, !row.suspended);
                          }}
                          expected={row.full_name?.trim() || row.email}
                          variant="danger"
                          title={row.suspended ? "Restore this account" : "Suspend this account"}
                          body={
                            row.suspended
                              ? `${row.email}'s card goes public again immediately.`
                              : `${row.email}'s card stops being public immediately. Anyone tapping their printed card gets nothing.`
                          }
                          cta={row.suspended ? "Restore" : "Suspend"}
                        >
                          {row.suspended ? "restore" : "suspend"}
                        </ConfirmByName>

                        {/* Not offered for yourself or another admin: the
                            action refuses both, and a button that always
                            fails is worse than no button. */}
                        {!isMe && !row.is_admin && (
                          <ConfirmByName
                            action={async () => {
                              "use server";
                              return deleteAccount(row.id);
                            }}
                            expected={row.email ?? ""}
                            variant="danger"
                            title="Delete permanently"
                            body={`Removes ${row.email} from the database and from Supabase Auth, with their card and everything on it. Their orders are kept for the record. This cannot be undone — type the email address to confirm.`}
                            cta="Delete permanently"
                          >
                            delete
                          </ConfirmByName>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white/40">
            Page {currentPage} of {pages}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <a
                href={`/admin/users?page=${currentPage - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded-full border-2 border-white/20 px-5 py-2.5 text-sm font-black lowercase text-white/70 hover:border-acid hover:text-acid"
              >
                previous
              </a>
            )}
            {currentPage < pages && (
              <a
                href={`/admin/users?page=${currentPage + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded-full border-2 border-white/20 px-5 py-2.5 text-sm font-black lowercase text-white/70 hover:border-acid hover:text-acid"
              >
                next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
