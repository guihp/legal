import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "./useUserProfile";

export function useCompanyApiMode() {
  const { profile } = useUserProfile();
  const [isOfficialApi, setIsOfficialApi] = useState(false);
  const [loadingApiMode, setLoadingApiMode] = useState(true);

  useEffect(() => {
    let active = true;

    const loadApiMode = async () => {
      if (!profile?.company_id) {
        if (active) {
          setIsOfficialApi(false);
          setLoadingApiMode(false);
        }
        return;
      }

      try {
        setLoadingApiMode(true);

        const { data, error } = await supabase
          .from("companies")
          .select("APIOficial")
          .eq("id", profile.company_id)
          .single();

        if (error) {
          throw error;
        }

        if (active) {
          setIsOfficialApi(Boolean(data?.APIOficial));
        }
      } catch {
        if (active) {
          // fallback seguro: mantém modo não oficial
          setIsOfficialApi(false);
        }
      } finally {
        if (active) {
          setLoadingApiMode(false);
        }
      }
    };

    loadApiMode();

    return () => {
      active = false;
    };
  }, [profile?.company_id]);

  return {
    isOfficialApi,
    loadingApiMode,
  };
}
