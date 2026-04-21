"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "./useSession";

export interface ActiveCompany {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  plan: string;
  roleName: string;
}

const STORAGE_KEY = "sunat_active_company";

export function useActiveCompany() {
  const { session } = useSession();
  const [activeCompany, setActiveCompanyState] = useState<ActiveCompany | null>(null);

  // Initialize from session + localStorage
  useEffect(() => {
    if (!session?.companyRoles?.length) return;

    const companies: ActiveCompany[] = session.companyRoles.map((cr) => ({
      id: cr.company.id,
      ruc: cr.company.ruc,
      razonSocial: cr.company.razonSocial,
      nombreComercial: cr.company.nombreComercial,
      plan: cr.company.plan,
      roleName: cr.roleName,
    }));

    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const saved = savedId ? companies.find((c) => c.id === savedId) : null;
    const target = saved ?? companies[0] ?? null;

    const run = async () => {
      setActiveCompanyState(target);
    };
    run();
  }, [session]);

  const setActiveCompany = useCallback((company: ActiveCompany) => {
    setActiveCompanyState(company);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, company.id);
    }
  }, []);

  const allCompanies: ActiveCompany[] = (session?.companyRoles ?? []).map((cr) => ({
    id: cr.company.id,
    ruc: cr.company.ruc,
    razonSocial: cr.company.razonSocial,
    nombreComercial: cr.company.nombreComercial,
    plan: cr.company.plan,
    roleName: cr.roleName,
  }));

  return { activeCompany, setActiveCompany, allCompanies };
}
