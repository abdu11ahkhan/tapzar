import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewCustomerForm from "./NewCustomerForm";

export const dynamic = "force-dynamic";

export default function NewCustomer() {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          customers
        </Link>
        <h1 className="app-h1 mt-2">Set someone up</h1>
        <p className="app-sub mt-1">
          Creates their account and their card together, and hands back the
          login to pass on. For selling in person, where waiting for them to
          sign up is the slow part.
        </p>
      </div>

      <NewCustomerForm />
    </div>
  );
}
